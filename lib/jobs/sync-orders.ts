import { syncLogsRepository } from "../repositories/sync-logs.repository";
import { ordersService } from "../services/orders.service";
import { trackingService } from "../services/tracking.service";
import { logger } from "../logger";

/**
 * Sync orders from Etsy. Called by cron /api/jobs/sync-orders every 30 min.
 * On first run, fetches everything; subsequently only last 7 days.
 */

export async function runSyncOrders() {
  const log = await syncLogsRepository.start("ORDERS_SYNC");
  logger.info("Sync orders started", { logId: log.id });

  try {
    // For first sync, fetch everything (no minCreated)
    const userCount = await (
      await import("../db")
    ).prisma.user.count();

    const result = await ordersService.syncFromEtsy({});

    // Push any missing trackings to AfterShip
    const trackingResult = await trackingService.pushMissingTrackings(50);

    const status =
      result.errorsCount > 0 ? (result.totalSynced > 0 ? "PARTIAL" : "FAILED") : "SUCCESS";

    await syncLogsRepository.complete(log.id, {
      status,
      ordersSynced: result.totalSynced,
      errorsCount: result.errorsCount,
      metadata: {
        isFirstRun: userCount === 0,
        trackingsPushed: trackingResult.pushed,
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
