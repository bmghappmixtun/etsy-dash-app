/**
 * Lightweight logger. In production, replace with Sentry.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Order synced", { orderId: "123" });
 *   logger.error("Failed to sync", { error: e });
 */

type Meta = Record<string, unknown>;

function format(level: string, msg: string, meta?: Meta) {
  const ts = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] ${level} ${msg}${metaStr}`;
}

export const logger = {
  debug(msg: string, meta?: Meta) {
    if (process.env.NODE_ENV === "development") {
      console.log(format("DEBUG", msg, meta));
    }
  },
  info(msg: string, meta?: Meta) {
    console.log(format("INFO", msg, meta));
  },
  warn(msg: string, meta?: Meta) {
    console.warn(format("WARN", msg, meta));
  },
  error(msg: string, meta?: Meta) {
    console.error(format("ERROR", msg, meta));
    // TODO: forward to Sentry when SENTRY_DSN is set
  },
};
