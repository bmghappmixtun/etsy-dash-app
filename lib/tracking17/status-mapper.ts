/**
 * Status mapper: 17TRACK → our app OrderStatus enum.
 *
 * 17TRACK has 9 main + 27 sub statuses. We map them to:
 * - Pre-existing OrderStatus enum (in Prisma schema)
 * - New statuses we need to add: CUSTOMS_HOLD, RETURNING, RETURNED, DAMAGED, LOST, etc.
 *
 * Customs-related codes are CRITICAL for the user (La Poste Tunisienne → customs hold is common).
 */

import type { OrderStatus } from "@prisma/client";
import type {
  SeventeenTrackMainStatus,
  SeventeenTrackSubStatus,
} from "./types";

/**
 * Map 17TRACK main status + sub_status to our app's OrderStatus.
 * Falls back to UNKNOWN if no match.
 *
 * Customs sub-statuses (Exception_Security, DeliveryFailure_Security) → CUSTOMS_HOLD
 */
export function mapSeventeenTrackStatus(
  main: SeventeenTrackMainStatus | undefined,
  sub: SeventeenTrackSubStatus | undefined,
): OrderStatus {
  if (!main) return "UNKNOWN";

  // Customs hold (most important for Tunisia Post users)
  if (sub === "Exception_Security" || sub === "DeliveryFailure_Security") {
    return "CUSTOMS_HOLD" as OrderStatus;
  }

  switch (main) {
    case "NotFound":
      return "UNKNOWN";
    case "InfoReceived":
      return "PRE_TRANSIT";
    case "InTransit":
      return "IN_TRANSIT";
    case "AvailableForPickup":
      return "AVAILABLE_FOR_PICKUP";
    case "OutForDelivery":
      return "OUT_FOR_DELIVERY" as OrderStatus;
    case "Delivered":
      return "DELIVERED";
    case "DeliveryFailure":
      return "FAILED_ATTEMPT";
    case "Exception":
      // Sub-status differentiates the type of exception
      switch (sub) {
        case "Exception_Returning":
          return "RETURNING" as OrderStatus;
        case "Exception_Returned":
          return "RETURNED" as OrderStatus;
        case "Exception_Damage":
          return "DAMAGED" as OrderStatus;
        case "Exception_Lost":
          return "LOST" as OrderStatus;
        case "Exception_Rejected":
          return "REJECTED" as OrderStatus;
        case "Exception_Destroyed":
          return "DESTROYED" as OrderStatus;
        case "Exception_Cancel":
          return "CANCELLED" as OrderStatus;
        case "Exception_Delayed":
        case "Exception_Other":
        case "Exception_NoBody":
        default:
          return "EXCEPTION";
      }
    case "Expired":
      return "EXCEPTION";
    default:
      return "UNKNOWN";
  }
}

/**
 * Get a human-readable description for a (main, sub) pair.
 */
export function getStatusDescription(
  main: SeventeenTrackMainStatus | undefined,
  sub: SeventeenTrackSubStatus | undefined,
): string {
  if (!main) return "No status yet";
  if (sub) return sub; // sub is already a human-readable string
  return main;
}
