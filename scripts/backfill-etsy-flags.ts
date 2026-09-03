/**
 * Backfill wasShipped / wasDelivered from Etsy for existing orders.
 *
 * Run with: npx tsx scripts/backfill-etsy-flags.ts
 */
import { prisma } from "../lib/db";
import { authService } from "../lib/services/auth.service";
import { getReceipt } from "../lib/etsy/client";
import { logger } from "../lib/logger";

async function main() {
  const user = await authService.getAuthenticatedUser();
  if (!user) throw new Error("No authenticated user");

  const shopId = user.shopId;

  // Find orders in the last 90 days that haven't been marked
  const orders = await prisma.order.findMany({
    where: {
      wasDelivered: false,
      createdAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, etsyReceiptId: true, status: true, receiptStatus: true },
  });

  logger.info(`Found ${orders.length} orders to backfill (90d window)`);

  let updated = 0;
  let changed = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      const receipt = await getReceipt(
        shopId,
        Number(order.etsyReceiptId),
        user.accessToken,
      );
      const wasShipped = Boolean(receipt.was_shipped);
      const wasDelivered = Boolean(receipt.was_delivered);

      if (!wasShipped && !wasDelivered) continue; // no Etsy update

      const data: {
        wasShipped: boolean;
        wasDelivered: boolean;
        status?: "DELIVERED";
        deliveryDate?: Date;
      } = { wasShipped, wasDelivered };

      // If Etsy says delivered but our status differs, fix it
      if (wasDelivered && order.status !== "DELIVERED") {
        data.status = "DELIVERED";
        data.deliveryDate = new Date();
        changed++;
      }

      await prisma.order.update({
        where: { id: order.id },
        data,
      });
      updated++;

      if (updated % 20 === 0) {
        logger.info(`  Progress: ${updated}/${orders.length}`);
      }
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Backfill error on ${order.id}`, { error: msg });
    }
  }

  logger.info(`Backfill complete. Updated: ${updated}, Status changed to DELIVERED: ${changed}, Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
