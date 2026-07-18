import { env } from "../env";
import { ApiError, withRetry } from "../retry";
import { etsyLimiter } from "../rate-limit";
import { logger } from "../logger";
import type {
  EtsyReceipt,
  EtsyReceiptsResponse,
  EtsyShop,
  EtsyTokenResponse,
  EtsyUser,
} from "./types";

/**
 * Etsy API v3 client.
 * All requests go through rate limiter + retry middleware.
 *
 * Docs: https://developers.etsy.com/documentation/reference
 */

const API_BASE = "https://api.etsy.com/v3/application";

async function etsyFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    accessToken?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const { method = "GET", accessToken, body, query } = options;

  await etsyLimiter.acquire();

  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const headers: Record<string, string> = {
    "x-api-key": env.ETSY_API_KEY,
    Accept: "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  return withRetry(async () => {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // Disable Next.js fetch cache for API calls
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
        `Etsy API ${method} ${path} failed: ${res.status} ${res.statusText}`,
        res.status,
        parsed,
        resHeaders,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  });
}

// =====================================================
// OAuth
// =====================================================

export function getAuthorizationUrl(state: string): string {
  const url = new URL("https://www.etsy.com/oauth/connect");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.ETSY_REDIRECT_URI);
  url.searchParams.set("scope", env.ETSY_SCOPES);
  url.searchParams.set("client_id", env.ETSY_API_KEY);
  url.searchParams.set("state", state);
  url.searchParams.set(
    "code_challenge",
    "code_challenge_method=plain",
  ); // Etsy supports plain PKCE; we don't actually use it but Etsy recommends setting it
  return url.toString();
}

export async function exchangeCodeForToken(
  code: string,
): Promise<EtsyTokenResponse> {
  const res = await fetch(
    "https://api.etsy.com/v3/public/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.ETSY_API_KEY,
        client_secret: env.ETSY_SHARED_SECRET,
        code,
        redirect_uri: env.ETSY_REDIRECT_URI,
      }).toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(
      `Etsy token exchange failed: ${res.status}`,
      res.status,
      text,
    );
  }

  return (await res.json()) as EtsyTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<EtsyTokenResponse> {
  const res = await fetch(
    "https://api.etsy.com/v3/public/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.ETSY_API_KEY,
        client_secret: env.ETSY_SHARED_SECRET,
        refresh_token: refreshToken,
      }).toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(
      `Etsy token refresh failed: ${res.status}`,
      res.status,
      text,
    );
  }

  return (await res.json()) as EtsyTokenResponse;
}

// =====================================================
// API calls
// =====================================================

export async function getMe(accessToken: string): Promise<EtsyUser> {
  return etsyFetch<EtsyUser>("/users/me", { accessToken });
}

export async function getShop(
  shopId: string | number,
  accessToken: string,
): Promise<EtsyShop> {
  return etsyFetch<EtsyShop>(`/shops/${shopId}`, { accessToken });
}

/**
 * Fetch receipts with automatic pagination.
 * Yields each batch as it arrives.
 *
 * Filters:
 * - minCreated / maxCreated: filter by creation time
 * - minLastModified / maxLastModified: filter by last modification (catches refunds, cancellations)
 */
export async function* iterateReceipts(
  accessToken: string,
  shopId: string | number,
  options: {
    minCreated?: number;
    maxCreated?: number;
    minLastModified?: number;
    maxLastModified?: number;
    wasShipped?: boolean;
    wasDelivered?: boolean;
  } = {},
): AsyncGenerator<EtsyReceipt[], void, void> {
  const limit = 100;
  let offset = 0;
  let total: number | null = null;

  while (total === null || offset < total) {
    const params: Record<string, string | number | undefined> = {
      limit,
      offset,
      was_paid: "true",
    };
    if (options.minCreated) params.min_created = options.minCreated;
    if (options.maxCreated) params.max_created = options.maxCreated;
    if (options.minLastModified) params.min_last_modified = options.minLastModified;
    if (options.maxLastModified) params.max_last_modified = options.maxLastModified;
    if (options.wasShipped !== undefined) params.was_shipped = String(options.wasShipped);
    if (options.wasDelivered !== undefined) params.was_delivered = String(options.wasDelivered);

    const res = await etsyFetch<EtsyReceiptsResponse>(
      `/shops/${shopId}/receipts`,
      { accessToken, query: params },
    );

    if (total === null) total = res.count;
    if (res.results.length === 0) break;

    yield res.results;
    offset += res.results.length;

    // Safety: prevent infinite loop (Etsy offset cap is 12000)
    if (offset > 10000) {
      logger.warn("Reached 10k receipt limit, stopping pagination");
      break;
    }
  }
}

export async function getReceipt(
  shopId: string | number,
  receiptId: number,
  accessToken: string,
): Promise<EtsyReceipt> {
  return etsyFetch<EtsyReceipt>(
    `/shops/${shopId}/receipts/${receiptId}`,
    { accessToken },
  );
}
