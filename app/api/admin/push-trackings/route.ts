import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import * as tracking17 from "@/lib/tracking17/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/push-trackings
 * One-time batch push of all existing trackings to 17TRACK.
 * Admin-only. After deploy of 17TRACK integration, call this once.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: limit to active user only (single-user app)
  const total = await prisma.order.count({
    where: { trackingNumber: { not: null } },
  });
  console.log(`[push-trackings] Starting batch push of ${total} orders`);

  let pushed = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;
  const BATCH = 40;

  while (true) {
    const orders = await prisma.order.findMany({
      where: { trackingNumber: { not: null } },
      take: BATCH,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) break;

    const items = orders
      .filter((o) => o.trackingNumber)
      .map((o) => ({
        number: o.trackingNumber as string,
        carrier: 0,
        auto_detection: true,
        tag: `etsy-${o.etsyReceiptId.toString().slice(0, 20)}`,
        remark: `Etsy receipt ${o.etsyReceiptId}`,
        track_status_notify: true,
      }));

    try {
      const result = await tracking17.registerTrackings(items);

      const carrierByNumber = new Map<string, number>();
      for (const acc of result.accepted) {
        if (acc.carrier) carrierByNumber.set(acc.number, acc.carrier);
      }
      for (const rej of result.rejected) {
        if (rej.error?.code === -18019901 && rej.carrier) {
          carrierByNumber.set(rej.number, rej.carrier);
        } else {
          logger.warn("17TRACK rejected", {
            number: rej.number,
            error: rej.error,
          });
          errors++;
        }
      }

      for (const order of orders) {
        if (!order.trackingNumber) continue;
        const carrier = carrierByNumber.get(order.trackingNumber);
        if (carrier) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              trackingSlug: String(carrier),
              trackingCarrier: String(carrier),
              lastTrackingUpdate: new Date(),
            },
          });
          pushed++;
        } else {
          skipped++;
        }
      }
    } catch (err) {
      logger.error("Batch push error", {
        error: err instanceof Error ? err.message : String(err),
      });
      errors += orders.length;
    }

    offset += BATCH;
  }

  return NextResponse.json({
    success: true,
    total,
    pushed,
    skipped,
    errors,
  });
}
