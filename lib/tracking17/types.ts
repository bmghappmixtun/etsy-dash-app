/**
 * 17TRACK API v2.4 types.
 * https://api.17track.net/en/doc
 *
 * Replaces AfterShip for better coverage (3400+ carriers incl. La Poste Tunisienne).
 */

import type { OrderStatus } from "@prisma/client";

/**
 * 9 main statuses from 17TRACK v2 API.
 * In v2.2+ returned as string under `latest_status.status`.
 * In v1 returned as numeric `e` code.
 */
export type SeventeenTrackMainStatus =
  | "NotFound"
  | "InfoReceived"
  | "InTransit"
  | "Expired"
  | "AvailableForPickup"
  | "OutForDelivery"
  | "DeliveryFailure"
  | "Delivered"
  | "Exception";

/**
 * 27 sub-statuses from 17TRACK (under `latest_status.sub_status`).
 * Includes critical customs/security codes.
 */
export type SeventeenTrackSubStatus =
  // NotFound
  | "NotFound_Other"
  | "NotFound_InvalidCode"
  // InfoReceived
  | "InfoReceived"
  // InTransit
  | "InTransit_PickedUp"
  | "InTransit_Other"
  | "InTransit_Departure"
  | "InTransit_Arrival"
  // Expired
  | "Expired_Other"
  // AvailableForPickup
  | "AvailableForPickup_Other"
  // OutForDelivery
  | "OutForDelivery_Other"
  // DeliveryFailure (KEY for customs fees!)
  | "DeliveryFailure_Other"
  | "DeliveryFailure_NoBody"
  | "DeliveryFailure_Security" // CUSTOMS CLEARANCE / FEE
  | "DeliveryFailure_Rejected"
  | "DeliveryFailure_InvalidAddress"
  // Delivered
  | "Delivered_Other"
  // Exception (KEY for customs)
  | "Exception_Other"
  | "Exception_Returning"
  | "Exception_Returned"
  | "Exception_NoBody"
  | "Exception_Security" // CUSTOMS / SECURITY / FEE
  | "Exception_Damage"
  | "Exception_Rejected"
  | "Exception_Delayed"
  | "Exception_Lost"
  | "Exception_Destroyed"
  | "Exception_Cancel"
  // Tracked (deprecated, kept for legacy)
  | "Tracked";

export type SeventeenTrackTrackingStatus = "Tracking" | "Stopped";
export type SeventeenTrackPushStatus = "NotPushed" | "Success" | "Failure";

/**
 * Track info from 17TRACK gettrackinfo response.
 */
export interface SeventeenTrackTrackInfo {
  shipping_provider?: unknown;
  latest_status?: {
    status?: SeventeenTrackMainStatus;
    sub_status?: SeventeenTrackSubStatus;
    sub_status_descr?: string;
  };
  tracking_status?: SeventeenTrackTrackingStatus;
  sync_status?: boolean;
  track_time?: string; // ISO 8601
  push_time?: string;
  push_status?: SeventeenTrackPushStatus;
  push_status_code?: number;
  stop_track_time?: string;
  stop_track_reason?: "Expired" | "ByRequest" | "InvalidCarrier";
  is_retracked?: boolean;
  milestones?: Array<{
    stage?: string;
    status?: SeventeenTrackMainStatus;
    sub_status?: SeventeenTrackSubStatus;
    description?: string;
    location?: string;
    time?: string;
  }>;
  origin_info?: unknown;
  destination_info?: unknown;
  service_type?: string;
  weight?: string;
  est_delivery_time?: string;
  tracking_event_list?: Array<{
    status?: SeventeenTrackMainStatus;
    sub_status?: SeventeenTrackSubStatus;
    description?: string;
    location?: string;
    time_iso8601?: string;
    time_utc?: string;
  }>;
}

/**
 * Single tracking record as returned by 17TRACK.
 */
export interface SeventeenTrackTracking {
  number: string;
  carrier?: number; // carrier code (e.g. 21051 for La Poste Tunisienne)
  track_info?: SeventeenTrackTrackInfo;
  /** Tag passed at registration */
  tag?: string;
  /** Remark passed at registration */
  remark?: string;
}

/**
 * Response wrapper from 17TRACK API.
 */
export interface SeventeenTrackResponse<T> {
  code: number; // 0 = success, negative = error
  msg?: string;
  data?: T;
}

/**
 * gettrackinfo response: array of tracking records.
 */
export interface SeventeenTrackGetTrackInfoResponse {
  accepted: SeventeenTrackTracking[];
  rejected: Array<{
    number: string;
    carrier?: number;
    error?: {
      code: number;
      message: string;
    };
  }>;
}

/**
 * Webhook push payload (event: TRACKING_UPDATED).
 */
export interface SeventeenTrackWebhookPayload {
  event: "TRACKING_UPDATED";
  data: SeventeenTrackGetTrackInfoResponse;
}

/**
 * Request body to register tracking numbers.
 */
export interface SeventeenTrackRegisterRequest {
  number: string;
  carrier?: number; // 0 = auto-detect
  final_carrier?: number;
  auto_detection?: boolean;
  tag?: string;
  remark?: string;
  param?: string;
  track_status_notify?: boolean;
}
