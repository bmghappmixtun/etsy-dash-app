import { syncLogsRepository } from "../repositories/sync-logs.repository";
import { analyticsService } from "../services/analytics.service";
import { logger } from "../logger";

/**
 * Compute daily metrics for yesterday (or specified date).
 * Called at 23:55 every day.
 */

export async function runComputeDailyMetrics(date?: Date) {
  const log = await syncLogsRepository.start("DAILY_METRICS");
  logger.info("Daily metrics computation started", { logId: log.id });

  try {
    const targetDate = date ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await analyticsService.computeDailyMetrics(targetDate);

    await syncLogsRepository.complete(log.id, {
      status: "SUCCESS",
      metadata: {
        date: result.date,
        totalOrders: result.totalOrders,
      },
    });

    logger.info("Daily metrics complete", { date: result.date });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await syncLogsRepository.complete(log.id, {
      status: "FAILED",
      errorMessage: message,
    });
    logger.error("Daily metrics failed", { error: message });
    throw err;
  }
}
