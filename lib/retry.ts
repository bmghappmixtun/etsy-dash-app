import { logger } from "./logger";

/**
 * Exponential backoff with jitter for retrying transient API failures.
 *
 * Usage:
 *   const data = await withRetry(() => fetch(url).then(r => r.json()));
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryOn?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULTS = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Default: retry on network errors and 5xx/429 HTTP responses.
 */
function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof Error) {
    // Network/timeout errors
    if (
      error.message.includes("fetch failed") ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("AbortError")
    ) {
      return true;
    }
    // HTTP errors with status
    const status = (error as { status?: number }).status;
    if (status === 429 || (status !== undefined && status >= 500)) {
      return true;
    }
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = DEFAULTS.maxAttempts,
    initialDelayMs = DEFAULTS.initialDelayMs,
    maxDelayMs = DEFAULTS.maxDelayMs,
    backoffFactor = DEFAULTS.backoffFactor,
    retryOn = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !retryOn(error)) {
        throw error;
      }
      const baseDelay = Math.min(
        initialDelayMs * Math.pow(backoffFactor, attempt - 1),
        maxDelayMs,
      );
      // Add ±25% jitter
      const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
      const delay = Math.round(baseDelay + jitter);
      logger.warn(`Retry attempt ${attempt}/${maxAttempts - 1}`, {
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      });
      onRetry?.(attempt, error);
      await sleep(delay);
    }
  }
  // Unreachable
  throw lastError;
}

/**
 * Thrown by API clients when an HTTP call fails. Preserves status for retry logic.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
