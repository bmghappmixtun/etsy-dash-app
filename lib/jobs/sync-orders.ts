import { syncLogsRepository } from "../repositories/sync-logs.repository";
import { ordersService } from "../services/orders.service";
import { trackingService } from "../services/tracking.service";
import { prisma } from "../db";
import { logger } from "../logger";

/**
 * Sync orders from Etsy. Called by cron /api/jobs/sync-orders every 30 min.
 *
 * First run: fetches everything (no filters)
 * Subsequent runs: uses min_last_modified to catch updates (refunds, cancellations)
 */
export async function runSyncOrders() {
  const log = await syncLogsRepository.start("ORDERS_SYNC");
  logger.info("Sync orders started", { logId: log.id });

  try {
    // Find the most recently updated order to know the cursor
    const latestOrder = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const userCount = await prisma.user.count();
    const isFirstRun = userCount === 0 || !latestOrder;

    // If not first run, sync only orders modified in the last 7 days
    // (Etsy's `min_last_modified` filter)
    const sevenDaysAgo = Math.floor(
      (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000,
    );

    const result = await ordersService.syncFromEtsy(
      isFirstRun
        ? {} // no filter, full sync
        : { minLastModified: sevenDaysAgo }, // incremental: last 7 days
    );

    // Push any missing trackings to AfterShip
    const trackingResult = await trackingService.pushMissingTrackings(50);

    const status =
      result.errorsCount > 0
        ? result.totalSynced > 0
          ? "PARTIAL"
          : "FAILED"
        : "SUCCESS";

    await syncLogsRepository.complete(log.id, {
      status,
      ordersSynced: result.totalSynced,
      errorsCount: result.errorsCount,
      metadata: {
        isFirstRun,
        trackingsPushed: trackingResult.pushed,
        syncWindow: isFirstRun ? "all" : "last 7 days",
      },
    });

    logger.info("Sync orders complete", {
      synced: result.totalSynced,
      errors: result.errorsCount,
      trackingsPushed: trackingResult.pushed,
    });

    return { synced: result.totalSynced, errors: result.errorsCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await syncLogsRepository.complete(log.id, {
      status: "FAILED",
      errorMessage: message,
    });
    logger.error("Sync orders failed", { error: message });
    throw err;
  }
}
