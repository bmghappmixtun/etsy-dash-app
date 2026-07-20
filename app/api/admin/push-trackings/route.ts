import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import * as tracking17 from "@/lib/tracking17/client";
import { buildRegisterItem } from "@/lib/tracking17/etsy-mapping";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/push-trackings
 * One-time batch push of all existing trackings to 17TRACK.
 * Uses Etsy's trackingCarrier (destination carrier) to map to 17TRACK codes.
 * Admin-only. After deploy of 17TRACK integration, call this once.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: ?force=true to re-push even orders that already have trackingSlug
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const where = force
    ? { trackingNumber: { not: null } }
    : { trackingNumber: { not: null }, trackingSlug: null };

  const total = await prisma.order.count({ where });
  console.log(
    `[push-trackings] Starting batch push of ${total} orders${force ? " (force)" : ""}`,
  );

  let pushed = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;
  const BATCH = 40;

  while (true) {
    const orders = await prisma.order.findMany({
      where,
      take: BATCH,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) break;

    // Build items with Etsy → 17TRACK carrier mapping
    const items = orders
      .filter((o) => o.trackingNumber)
      .map((o) =>
        buildRegisterItem(o.trackingNumber as string, o.trackingCarrier, {
          tag: `etsy-${o.etsyReceiptId.toString().slice(0, 20)}`,
          remark: `Etsy receipt ${o.etsyReceiptId}`,
        }),
      );

    // Track carriers per tracking number (filled by each register call)
    const carrierByNumber = new Map<string, number>();

    try {
      // Use registerOrChangeCarrier per item to handle the "already
      // registered with wrong carrier" case (calls changeinfo internally).
      // 17TRACK limits changeinfo to 5 changes per tracking.
      for (const item of items) {
        const desiredCarrier = item.carrier ?? 0;
        if (desiredCarrier === 0) {
          // No desired carrier - just register with auto-detect
          const result = await tracking17.registerTrackings([item]);
          const accepted = result.accepted[0];
          const rejected = result.rejected[0] as
            | { carrier?: number; error?: { code?: number } }
            | undefined;
          if (accepted?.carrier) {
            carrierByNumber.set(item.number, accepted.carrier);
          } else if (rejected?.error?.code === -18019901 && rejected.carrier) {
            carrierByNumber.set(item.number, rejected.carrier);
          } else {
            logger.warn("17TRACK rejected", {
              number: item.number,
              error: rejected?.error,
            });
            errors++;
          }
        } else {
          const { carrier, action } =
            await tracking17.registerOrChangeCarrier(
              item.number,
              desiredCarrier,
              item.remark,
            );
          if (action !== "noop" || carrier) {
            carrierByNumber.set(item.number, carrier);
          }
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
              trackingCarrier: order.trackingCarrier || String(carrier),
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
    forced: force,
  });
}
