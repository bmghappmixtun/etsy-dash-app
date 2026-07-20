/**
 * Maps Etsy trackingCarrier names → 17TRACK carrier codes (numeric).
 *
 * The Etsy `trackingCarrier` field is the DESTINATION country carrier
 * (e.g. "Royal Mail" for UK orders, "La Poste" for France orders),
 * NOT the originating carrier (which is La Poste Tunisienne).
 *
 * When registering tracking numbers with 17TRACK, we use this mapping
 * to tell 17TRACK which carrier to query.
 *
 * If a carrier is not in this map, 17TRACK will auto-detect (often
 * misidentifying Tunisia Post tracking as "La Poste De Tunisia").
 *
 * Source: https://res.17track.net/asset/carrier/info/apicarrier.all.json
 * Last updated: July 19, 2026
 */

import type { SeventeenTrackRegisterRequest } from "./types";

/**
 * Map of normalized Etsy carrier name → 17TRACK carrier key.
 * Normalized = lowercase, trimmed, common aliases collapsed.
 */
const ETSY_TO_17TRACK: Record<string, number> = {
  // Postal services (main carriers for THMWorks orders)
  "la poste": 6051, // La Poste (Colissimo), France
  "la poste (france)": 6051,
  "colissimo": 6051,
  "royal mail": 11031, // Royal Mail, UK
  "canada post": 3041, // Canada Post
  "swiss post": 19251, // Swiss Post
  "an post": 9051, // An Post, Ireland
  "dhl germany": 7041, // DHL Paket
  "dhl paket": 7041,
  "deutsche post": 7044, // Deutsche Post Mail
  "poste italiane": 9071, // Poste Italiane
  "correos - espana": 19181, // Correos Spain
  "correos": 19181, // Spain
  "correios de portugal (ctt)": 16101, // CTT Portugal
  "ctt": 16101,
  "austrian post": 1161, // Austrian Post
  "postnl": 14041, // PostNL, Netherlands
  "postnl domestic": 14041,
  "postnord": 4011, // PostNord Denmark
  "parcelforce worldwide": 11033, // Parcelforce
  "qatar post": 17011, // Q-Post Qatar
  "landmark global": 100021, // Landmark Global
  "la poste tunisienne": 20101, // La Poste De Tunisia
  // Common international carriers (fallback)
  usps: 21051,
  "usps api": 21051,
  ups: 100002,
  "ups api": 100002,
  fedex: 100003,
  "dhl express": 100001,
  "dhl ecommerce": 7047,
  tnt: 100024,
};

/**
 * Normalize an Etsy trackingCarrier string for lookup.
 * Handles case differences, "Correos - Espana" vs "correos de espana", etc.
 */
function normalizeEtsyCarrierName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    // Normalize common variants
    .replace("correos de españa", "correos - espana")
    .replace("correos de espana", "correos - espana")
    .replace("la poste de france", "la poste")
    .replace("la poste française", "la poste")
    .replace("la poste francaise", "la poste");
}

/**
 * Map an Etsy trackingCarrier string to a 17TRACK carrier code.
 * Returns null if no match (will use 0 = auto-detect).
 */
export function etsyCarrierTo17Track(etsyCarrier: string | null | undefined): number | null {
  if (!etsyCarrier) return null;

  // Try exact match first
  const exact = ETSY_TO_17TRACK[etsyCarrier];
  if (exact) return exact;

  // Try normalized match
  const normalized = normalizeEtsyCarrierName(etsyCarrier);
  const match = ETSY_TO_17TRACK[normalized];
  if (match) return match;

  // Try partial match (e.g. "Royal Mail International" → contains "royal mail")
  const lower = etsyCarrier.toLowerCase();
  for (const [key, code] of Object.entries(ETSY_TO_17TRACK)) {
    if (lower.includes(key) || key.includes(lower)) {
      return code;
    }
  }

  return null; // will fall back to auto-detect
}

/**
 * Build a 17TRACK register request item from an order's tracking info.
 * Uses Etsy's trackingCarrier if available, otherwise auto-detect.
 */
export function buildRegisterItem(
  trackingNumber: string,
  etsyCarrier: string | null | undefined,
  options: { tag?: string; remark?: string } = {},
): SeventeenTrackRegisterRequest {
  const carrier = etsyCarrierTo17Track(etsyCarrier);

  return {
    number: trackingNumber,
    carrier: carrier ?? 0, // 0 = auto-detect fallback
    auto_detection: carrier === null, // only auto-detect if no mapping
    track_status_notify: true,
    ...(options.tag && { tag: options.tag.slice(0, 100) }),
    ...(options.remark && { remark: options.remark.slice(0, 1000) }),
  };
}
