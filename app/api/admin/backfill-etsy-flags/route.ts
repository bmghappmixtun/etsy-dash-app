import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/services/auth.service";
import { getReceipt } from "@/lib/etsy/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/backfill-etsy-flags
 *
 * One-time endpoint to backfill wasShipped/wasDelivered for existing orders
 * from Etsy. Safe to call multiple times (idempotent).
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
      wasDelivered: false,
      createdAt: {
        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, etsyReceiptId: true, status: true },
    take: limit,
  });

  logger.info(`Backfill: processing ${orders.length} orders (${days}d window, limit ${limit})`);

  let updated = 0;
  let statusChanged = 0;
  const errors: Array<{ id: string; error: string }> = [];
  const samples: Array<{
    etsyReceiptId: string;
    was_shipped: unknown;
    was_delivered: unknown;
    status: string;
    wasShipped: boolean;
    wasDelivered: boolean;
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

      // DEBUG: collect sample receipts for inspection
      if (samples.length < 5) {
        samples.push({
          etsyReceiptId: order.etsyReceiptId.toString(),
          was_shipped: receipt.was_shipped,
          was_delivered: receipt.was_delivered,
          status: receipt.status,
          wasShipped,
          wasDelivered,
        });
      }

      if (!wasShipped && !wasDelivered) continue;

      const data: {
        wasShipped: boolean;
        wasDelivered: boolean;
        status?: "DELIVERED";
        deliveryDate?: Date;
      } = { wasShipped, wasDelivered };

      if (wasDelivered && order.status !== "DELIVERED") {
        data.status = "DELIVERED";
        data.deliveryDate = new Date();
        statusChanged++;
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
