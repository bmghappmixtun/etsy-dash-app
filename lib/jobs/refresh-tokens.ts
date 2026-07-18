import { syncLogsRepository } from "../repositories/sync-logs.repository";
import { usersRepository } from "../repositories/users.repository";
import { authService } from "../services/auth.service";
import { refreshAccessToken } from "../etsy/client";
import { logger } from "../logger";

/**
 * Refresh OAuth tokens before they expire. Called every 50 min.
 * Etsy access tokens last 1 hour.
 */

const SAFETY_MARGIN_MS = 10 * 60 * 1000; // refresh if expires within 10 min

export async function runRefreshTokens() {
  const log = await syncLogsRepository.start("TOKEN_REFRESH");
  logger.info("Token refresh started", { logId: log.id });

  let refreshed = 0;
  let failed = 0;

  try {
    const user = await usersRepository.findFirst();
    if (!user) {
      await syncLogsRepository.complete(log.id, {
        status: "SUCCESS",
        metadata: { reason: "No user connected" },
      });
      return { refreshed, failed };
    }

    const expiresAt = new Date(user.tokenExpiresAt).getTime();
    if (expiresAt > Date.now() + SAFETY_MARGIN_MS) {
      await syncLogsRepository.complete(log.id, {
        status: "SUCCESS",
        metadata: { reason: "Token still valid", expiresAt: user.tokenExpiresAt },
      });
      return { refreshed, failed };
    }

    const tokens = authService.getDecryptedTokens(user);
    const refreshed_ = await refreshAccessToken(tokens.refreshToken);
    const newExpiresAt = new Date(Date.now() + refreshed_.expires_in * 1000);

    await authService.saveTokens(
      user.id,
      refreshed_.access_token,
      refreshed_.refresh_token,
      newExpiresAt,
    );

    refreshed = 1;
    await syncLogsRepository.complete(log.id, {
      status: "SUCCESS",
      metadata: { expiresAt: newExpiresAt },
    });

    logger.info("Token refresh complete", { userId: user.id });
    return { refreshed, failed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await syncLogsRepository.complete(log.id, {
      status: "FAILED",
      errorMessage: message,
    });
    logger.error("Token refresh failed", { error: message });
    throw err;
  }
}
