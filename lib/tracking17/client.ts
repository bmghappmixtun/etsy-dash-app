/**
 * 17TRACK API v2.4 client.
 * https://api.17track.net/en/doc
 *
 * Replaces AfterShip. 3400+ carriers including La Poste Tunisienne.
 * Webhook-based push (auto-tracking every 6-12h after first sync).
 */

import { createHash, createHmac } from "crypto";
import { env } from "../env";
import { ApiError, withRetry } from "../retry";
import { logger } from "../logger";
import type {
  SeventeenTrackGetTrackInfoResponse,
  SeventeenTrackRegisterRequest,
  SeventeenTrackResponse,
  SeventeenTrackTracking,
  SeventeenTrackWebhookPayload,
} from "./types";

const BASE_URL = "https://api.17track.net/track/v2.4";

/**
 * Generic 17TRACK API call.
 */
async function trackFetch<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "17token": env.TRACKING17_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  // 17TRACK may return 200 with error code in body, or non-200
  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON
    }
    throw new ApiError(
      `17TRACK ${endpoint} failed: ${res.status} ${res.statusText}`,
      res.status,
      parsed,
    );
  }

  const data = (await res.json()) as SeventeenTrackResponse<T>;
  if (data.code !== 0) {
    throw new ApiError(
      `17TRACK ${endpoint} error code ${data.code}: ${data.msg || "unknown"}`,
      400,
      data,
    );
  }
  return data.data as T;
}

/**
 * Register 1-40 tracking numbers.
 * Returns the accepted + rejected lists.
 */
export async function registerTrackings(
  items: SeventeenTrackRegisterRequest[],
): Promise<SeventeenTrackGetTrackInfoResponse> {
  if (items.length === 0) {
    return { accepted: [], rejected: [] };
  }
  if (items.length > 40) {
    throw new Error("17TRACK: max 40 tracking numbers per request");
  }

  return withRetry(() =>
    trackFetch<SeventeenTrackGetTrackInfoResponse>("/register", items),
  );
}

/**
 * Register a single tracking number with auto-detection.
 */
export async function registerTracking(
  number: string,
  options: {
    tag?: string;
    remark?: string;
    finalCarrier?: number;
  } = {},
): Promise<{ accepted: SeventeenTrackTracking[]; rejected: unknown[] }> {
  const result = await registerTrackings([
    {
      number,
      carrier: 0, // auto-detect
      auto_detection: true,
      ...(options.tag && { tag: options.tag.slice(0, 100) }),
      ...(options.remark && { remark: options.remark.slice(0, 1000) }),
      ...(options.finalCarrier && { final_carrier: options.finalCarrier }),
      track_status_notify: true,
    },
  ]);
  return { accepted: result.accepted, rejected: result.rejected };
}

/**
 * Get tracking info for up to 40 specific tracking numbers.
 */
export async function getTrackInfo(
  items: { number: string; carrier?: number }[],
): Promise<SeventeenTrackGetTrackInfoResponse> {
  if (items.length === 0) {
    return { accepted: [], rejected: [] };
  }
  return withRetry(() =>
    trackFetch<SeventeenTrackGetTrackInfoResponse>("/gettrackinfo", items),
  );
}

/**
 * Get the list of all registered trackings.
 * Supports pagination via page (1-based).
 */
export async function getTrackList(
  options: { page?: number; pageSize?: number } = {},
): Promise<{ trackings: SeventeenTrackTracking[]; total: number }> {
  const result = await withRetry(() =>
    trackFetch<{
      trackings: SeventeenTrackTracking[];
      total?: number;
    }>("/gettracklist", {
      page: options.page ?? 1,
      page_size: options.pageSize ?? 100,
    }),
  );
  return { trackings: result.trackings ?? [], total: result.total ?? 0 };
}

/**
 * Change carrier assignment for a tracking (max 5 times per tracking).
 */
export async function changeCarrier(
  number: string,
  newCarrier: number,
  oldCarrier?: number,
): Promise<SeventeenTrackGetTrackInfoResponse> {
  return withRetry(() =>
    trackFetch<SeventeenTrackGetTrackInfoResponse>("/changeinfo", {
      number,
      carrier_new: newCarrier,
      ...(oldCarrier && { carrier_old: oldCarrier }),
    }),
  );
}

/**
 * Change carrier or register if not yet registered.
 * Handles the "already registered" case by calling changeinfo instead.
 */
export async function registerOrChangeCarrier(
  number: string,
  desiredCarrier: number,
  remark?: string,
): Promise<{ carrier: number; action: "registered" | "changed" | "noop" }> {
  // First try to register
  const result = await registerTrackings([
    {
      number,
      carrier: desiredCarrier,
      auto_detection: false,
      track_status_notify: true,
      ...(remark && { remark: remark.slice(0, 1000) }),
    },
  ]);

  const accepted = result.accepted[0];
  if (accepted?.carrier) {
    return { carrier: accepted.carrier, action: "registered" };
  }

  // Check rejected - if "already registered" with different carrier, change it
  const rejected = result.rejected[0] as
    | { carrier?: number; error?: { code?: number } }
    | undefined;

  if (rejected?.error?.code === -18019901) {
    // Already registered - if carrier is different, change it
    if (rejected.carrier && rejected.carrier !== desiredCarrier) {
      try {
        await changeCarrier(number, desiredCarrier, rejected.carrier);
        return { carrier: desiredCarrier, action: "changed" };
      } catch (err) {
        // If change fails, return current carrier
        return { carrier: rejected.carrier, action: "noop" };
      }
    }
    // Already registered with correct carrier
    return { carrier: rejected.carrier ?? desiredCarrier, action: "noop" };
  }

  // Other rejection
  return { carrier: desiredCarrier, action: "noop" };
}

/**
 * Delete a tracking registration.
 */
export async function deleteTracking(
  number: string,
  carrier: number,
): Promise<{ ok: boolean }> {
  await withRetry(() =>
    trackFetch<{ ok: boolean }>("/deletetrack", {
      number,
      carrier,
    }),
  );
  return { ok: true };
}

/**
 * Health check: validate the API key works.
 */
export async function ping(): Promise<boolean> {
  try {
    await getTrackList({ page: 1, pageSize: 1 });
    return true;
  } catch (err) {
    logger.warn("17TRACK ping failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Verify the signature on a webhook push from 17TRACK.
 *
 * 17TRACK includes a `sign` header with SHA256(rawBody + "/" + apiKey).
 * This must be verified BEFORE processing the webhook to prevent spoofing.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signHeader: string | null,
  apiKey: string = env.TRACKING17_API_KEY,
): boolean {
  if (!signHeader) return false;

  const myStr = rawBody + "/" + apiKey;
  const mySign = createHash("sha256").update(myStr, "utf8").digest("hex");

  // Timing-safe comparison
  if (mySign.length !== signHeader.length) return false;
  let result = 0;
  for (let i = 0; i < mySign.length; i++) {
    result |= mySign.charCodeAt(i) ^ signHeader.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Parse a webhook payload after signature verification.
 */
export function parseWebhookPayload(
  body: unknown,
): SeventeenTrackWebhookPayload | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (obj.event !== "TRACKING_UPDATED") return null;
  if (!obj.data || typeof obj.data !== "object") return null;
  return obj as unknown as SeventeenTrackWebhookPayload;
}
