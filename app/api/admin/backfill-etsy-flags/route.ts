import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/services/auth.service";
import { getReceipt } from "@/lib/etsy/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { mapEtsyReceiptStatusToApp } from "@/lib/etsy/types";

/**
 * POST /api/admin/backfill-etsy-flags
 *
 * One-time endpoint to backfill wasShipped/wasDelivered for existing orders
 * from Etsy. Safe to call multiple times (idempotent).
 *
 * Note: Etsy's `was_shipped` / `was_delivered` flags are unreliable (only set
 * when carrier pings back). We use `receiptStatus === "Completed"` as the
 * primary signal for "delivered" via mapEtsyReceiptStatusToApp().
 *
 * Auth: simple shared-secret query param. Set to "disposable" - delete this
 * endpoint after the backfill is complete.
 *
 * Usage: curl -X POST "https://etsy-dash-app.vercel.app/api/admin/backfill-etsy-flags?token=disposable&days=90"
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (token !== "disposable") {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const days = Number(url.searchParams.get("days") || "90");
  const limit = Number(url.searchParams.get("limit") || "200");

  const user = await authService.getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      // Skip orders that already have a final status (delivered/exceptions)
      status: { notIn: ["DELIVERED", "EXCEPTION", "CANCELLED", "RETURNED", "DESTROYED", "REJECTED", "LOST"] },
      // Also skip if Etsy receiptStatus is already terminal
      receiptStatus: { notIn: ["Completed", "completed", "Canceled", "canceled"] },
      createdAt: {
        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, etsyReceiptId: true, status: true, deliveryDate: true },
    take: limit,
  });

  logger.info(`Backfill: processing ${orders.length} orders (${days}d window, limit ${limit})`);

  let updated = 0;
  let statusChanged = 0;
  const errors: Array<{ id: string; error: string }> = [];
  const samples: Array<{
    etsyReceiptId: string;
    etsyStatus: string;
    wasShipped: boolean;
    wasDelivered: boolean;
    mappedAppStatus: string;
    wasUpdated: boolean;
  }> = [];

  for (const order of orders) {
    try {
      const receipt = await getReceipt(
        user.shopId,
        Number(order.etsyReceiptId),
        user.accessToken,
      );
      const wasShipped = Boolean(receipt.was_shipped);
      const wasDelivered = Boolean(receipt.was_delivered);
      // Use the new mapping that trusts Etsy's "Completed" status
      const mappedStatus = mapEtsyReceiptStatusToApp(
        receipt.status,
        wasShipped,
        wasDelivered,
      );

      if (samples.length < 5) {
        samples.push({
          etsyReceiptId: order.etsyReceiptId.toString(),
          etsyStatus: receipt.status,
          wasShipped,
          wasDelivered,
          mappedAppStatus: mappedStatus,
          wasUpdated: false,
        });
      }

      const data: {
        wasShipped: boolean;
        wasDelivered: boolean;
        status?: typeof mappedStatus;
        deliveryDate?: Date;
      } = { wasShipped, wasDelivered };

      // If the mapped status differs from current, update it
      if (mappedStatus !== order.status) {
        data.status = mappedStatus;
        if (mappedStatus === "DELIVERED" && !order.deliveryDate) {
          data.deliveryDate = new Date();
        }
        statusChanged++;
        if (samples.length > 0 && samples[samples.length - 1].etsyReceiptId === order.etsyReceiptId.toString()) {
          samples[samples.length - 1].wasUpdated = true;
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data,
      });
      updated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ id: order.id, error: msg });
      logger.error(`Backfill error on ${order.id}`, { error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    processed: orders.length,
    updated,
    statusChanged,
    errors: errors.length,
    sampleErrors: errors.slice(0, 3),
    samples,
  });
}

