import { syncLogsRepository } from "../repositories/sync-logs.repository";
import { trackingService } from "../services/tracking.service";
import { logger } from "../logger";

/**
 * Refresh tracking for non-delivered orders. Called every hour.
 */

export async function runRefreshTracking() {
  const log = await syncLogsRepository.start("TRACKING_REFRESH");
  logger.info("Tracking refresh started", { logId: log.id });

  try {
    const result = await trackingService.refreshAll();

    await syncLogsRepository.complete(log.id, {
      status: result.errors > 0 ? "PARTIAL" : "SUCCESS",
      trackingUpdated: result.updated,
      errorsCount: result.errors,
    });

    logger.info("Tracking refresh complete", result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await syncLogsRepository.complete(log.id, {
      status: "FAILED",
      errorMessage: message,
    });
    logger.error("Tracking refresh failed", { error: message });
    throw err;
  }
}
