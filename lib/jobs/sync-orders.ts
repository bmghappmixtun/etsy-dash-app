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
 * With { days: N }: limits to orders created in the last N days (for backfill
 * of partial history, e.g. days=90)
 */
export async function runSyncOrders(options: { days?: number } = {}) {
  const log = await syncLogsRepository.start("ORDERS_SYNC");
  logger.info("Sync orders started", { logId: log.id, days: options.days });

  try {
    // Find the most recently updated order to know the cursor
    const latestOrder = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const userCount = await prisma.user.count();
    const isFirstRun = userCount === 0 || !latestOrder;

    let syncFilter: { minCreated?: number; minLastModified?: number } = {};
    let syncWindow: string;

    if (typeof options.days === "number" && options.days > 0) {
      // Backfill mode: limit by creation date
      const minCreated = Math.floor(
        (Date.now() - options.days * 24 * 60 * 60 * 1000) / 1000,
      );
      syncFilter = { minCreated };
      syncWindow = `last ${options.days} days (backfill)`;
    } else if (isFirstRun) {
      syncFilter = {};
      syncWindow = "all (first run)";
    } else {
      // Incremental: orders modified in the last 7 days
      const sevenDaysAgo = Math.floor(
        (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000,
      );
      syncFilter = { minLastModified: sevenDaysAgo };
      syncWindow = "last 7 days (incremental)";
    }

    const result = await ordersService.syncFromEtsy(syncFilter);

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
        days: options.days,
        trackingsPushed: trackingResult.pushed,
        syncWindow,
      },
    });

    logger.info("Sync orders complete", {
      synced: result.totalSynced,
      errors: result.errorsCount,
      trackingsPushed: trackingResult.pushed,
      syncWindow,
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
