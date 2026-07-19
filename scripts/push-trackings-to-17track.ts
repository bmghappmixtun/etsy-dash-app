/**
 * Push all existing orders with tracking numbers to 17TRACK.
 * Run once after deploying the 17TRACK integration.
 *
 * Usage:
 *   npx tsx scripts/push-trackings-to-17track.ts
 *   (or via the API endpoint with auth)
 */
import { prisma } from "../lib/db";
import { trackingService } from "../lib/services/tracking.service";
import { logger } from "../lib/logger";

async function main() {
  console.log("Pushing all orders with tracking to 17TRACK...");

  const total = await prisma.order.count({
    where: { trackingNumber: { not: null } },
  });
  console.log(`Found ${total} orders with tracking numbers`);

  let pushed = 0;
  const BATCH = 50;
  let offset = 0;

  while (true) {
    const orders = await prisma.order.findMany({
      where: { trackingNumber: { not: null } },
      take: BATCH,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) break;

    for (const order of orders) {
      const result = await trackingService.pushTrackingForOrder(order);
      if (result) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            trackingSlug: result.slug,
            trackingCarrier: result.slug,
            lastTrackingUpdate: new Date(),
          },
        });
        pushed++;
      }
    }

    offset += BATCH;
    console.log(`  Progress: ${pushed}/${total} pushed (offset ${offset})`);
  }

  console.log(`Done: ${pushed}/${total} trackings registered with 17TRACK`);
}

main()
  .catch((err) => {
    logger.error("push-trackings-to-17track failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
