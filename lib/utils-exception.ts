/**
 * Format a human-readable reason for an order in EXCEPTION or terminal state.
 *
 * Priority:
 *  1. Etsy's receiptStatus (most reliable for "Canceled" / "Refunded")
 *  2. Latest tracking event description (for in-flight exceptions)
 *  3. Latest tracking event sub_status
 *  4. Generic "Exception" fallback
 */
export function getExceptionReason(
  receiptStatus: string | null | undefined,
  lastEvent: {
    status?: string | null;
    description?: string | null;
    location?: string | null;
  } | null
): { label: string; detail?: string } {
  // 1. Etsy-level reason (refund/cancel)
  if (receiptStatus) {
    const r = receiptStatus.toLowerCase();
    if (r === "canceled" || r === "cancelled") {
      return { label: "Canceled by buyer" };
    }
    if (r === "fully refunded") {
      return { label: "Fully refunded" };
    }
    if (r === "partially refunded") {
      return { label: "Partially refunded" };
    }
  }

  // 2. 17TRACK event description
  if (lastEvent?.description) {
    const desc = lastEvent.description.trim();
    if (desc && desc.toLowerCase() !== "unknown") {
      return {
        label: desc,
        detail: lastEvent.location || undefined,
      };
    }
  }

  // 3. 17TRACK sub_status (raw code)
  if (lastEvent?.status && lastEvent.status.toLowerCase() !== "unknown") {
    return { label: lastEvent.status };
  }

  // 4. Fallback
  return { label: "Exception" };
}
