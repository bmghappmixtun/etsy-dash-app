import type { OrderStatus } from "@prisma/client";
import type { AfterShipTag } from "./types";

/**
 * AfterShip tag → our app status.
 * Source: https://www.aftership.com/docs/tracking
 */

export const AFTERSHIP_TAG_TO_APP_STATUS: Record<AfterShipTag, OrderStatus> = {
  Delivered: "DELIVERED",
  InTransit: "IN_TRANSIT",
  OutForDelivery: "IN_TRANSIT",
  AvailableForPickup: "AVAILABLE_FOR_PICKUP",
  AttemptFail: "FAILED_ATTEMPT",
  Exception: "EXCEPTION",
  InfoReceived: "PRE_TRANSIT",
  Pending: "PRE_TRANSIT",
  Expired: "EXCEPTION",
};

export function mapAfterShipStatus(tag: AfterShipTag): OrderStatus {
  return AFTERSHIP_TAG_TO_APP_STATUS[tag] ?? "UNKNOWN";
}

/**
 * Human-readable labels for our app statuses.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DELIVERED: "Delivered",
  IN_TRANSIT: "In Transit",
  EXCEPTION: "Exception",
  PRE_TRANSIT: "Pre-Transit",
  FAILED_ATTEMPT: "Failed Attempt",
  AVAILABLE_FOR_PICKUP: "Available for Pickup",
  UNKNOWN: "Unknown",
  // New statuses from 17TRACK integration (July 2026)
  OUT_FOR_DELIVERY: "Out for Delivery",
  CUSTOMS_HOLD: "Held by Customs",
  RETURNING: "Returning",
  RETURNED: "Returned",
  DAMAGED: "Damaged",
  LOST: "Lost",
  REJECTED: "Rejected",
  DESTROYED: "Destroyed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  DELIVERED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  IN_TRANSIT: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  EXCEPTION: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  PRE_TRANSIT: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  FAILED_ATTEMPT: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  AVAILABLE_FOR_PICKUP: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  UNKNOWN: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  OUT_FOR_DELIVERY: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  CUSTOMS_HOLD: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  RETURNING: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  RETURNED: "bg-purple-600/15 text-purple-800 dark:text-purple-200 border-purple-600/30",
  DAMAGED: "bg-red-600/15 text-red-800 dark:text-red-200 border-red-600/30",
  LOST: "bg-red-700/15 text-red-900 dark:text-red-100 border-red-700/30",
  REJECTED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  DESTROYED: "bg-zinc-700/15 text-zinc-900 dark:text-zinc-100 border-zinc-700/30",
  CANCELLED: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};
