import { env } from "../env";
import { ApiError, withRetry } from "../retry";
import { afterShipLimiter } from "../rate-limit";
import { logger } from "../logger";
import type {
  AfterShipCreateTrackingBody,
  AfterShipTracking,
  AfterShipTrackingResponse,
  AfterShipTrackingsResponse,
} from "./types";

/**
 * AfterShip API v4 client.
 * Docs: https://www.aftership.com/docs/tracking
 */

async function afterShipFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const { method = "GET", body, query } = options;

  await afterShipLimiter.acquire();

  const url = new URL(`${env.AFTERSHIP_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  return withRetry(async () => {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        "as-api-key": env.AFTERSHIP_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // not JSON
      }
      // Build a headers map for ApiError (for retry-after support)
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key.toLowerCase()] = value;
      });
      throw new ApiError(
        `AfterShip ${method} ${path} failed: ${res.status} ${res.statusText}`,
        res.status,
        parsed,
        resHeaders,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  });
}

/**
 * Create a tracking on AfterShip.
 * Idempotent: same (slug, tracking_number) returns the existing tracking.
 */
export async function createTracking(
  trackingNumber: string,
  options: { slug?: string; title?: string; orderId?: string } = {},
): Promise<AfterShipTracking> {
  const body: AfterShipCreateTrackingBody = {
    tracking: {
      tracking_number: trackingNumber,
      ...(options.slug && { slug: options.slug }),
      ...(options.title && { title: options.title }),
      ...(options.orderId && { order_id: options.orderId }),
    },
  };
  const res = await afterShipFetch<AfterShipTrackingResponse>("/trackings", {
    method: "POST",
    body,
  });
  return res.data.tracking;
}

/**
 * Get a single tracking by ID.
 */
export async function getTracking(
  id: string,
): Promise<AfterShipTracking | null> {
  try {
    const res = await afterShipFetch<AfterShipTrackingResponse>(
      `/trackings/${id}`,
    );
    return res.data.tracking;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Get a tracking by carrier slug + tracking number.
 */
export async function getTrackingByNumber(
  slug: string,
  trackingNumber: string,
): Promise<AfterShipTracking | null> {
  try {
    const res = await afterShipFetch<AfterShipTrackingResponse>(
      `/trackings/${encodeURIComponent(slug)}/${encodeURIComponent(trackingNumber)}`,
    );
    return res.data.tracking;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * List all trackings (used to detect existing ones).
 */
export async function listTrackings(
  options: { limit?: number; page?: number } = {},
): Promise<AfterShipTracking[]> {
  const res = await afterShipFetch<AfterShipTrackingsResponse>("/trackings", {
    query: {
      limit: options.limit ?? 100,
      page: options.page ?? 1,
    },
  });
  return res.data.trackings;
}

/**
 * Health check: validate the API key works.
 */
export async function ping(): Promise<boolean> {
  try {
    await listTrackings({ limit: 1 });
    return true;
  } catch (err) {
    logger.warn("AfterShip ping failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
