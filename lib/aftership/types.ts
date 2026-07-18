/**
 * AfterShip API v4 types.
 * https://www.aftership.com/docs/tracking
 */

import type { OrderStatus } from "@prisma/client";

export interface AfterShipTracking {
  id: string;
  created_at: string;
  updated_at: string;
  last_updated_at: string;
  tracking_number: string;
  slug: string; // carrier slug, e.g. "usps", "dhl"
  active: boolean;
  android: string[];
  custom_fields: Record<string, string> | null;
  customer_name: string | null;
  delivery_time: number | null; // minutes
  destination_country_iso3: string | null;
  emails: string[];
  expected_delivery: string | null;
  ios: string[];
  note: string | null;
  order_id: string | null;
  order_id_path: string | null;
  order_number: string | null;
  origin_country_iso3: string | null;
  shipment_package_count: number;
  shipment_pickup_date: string | null;
  shipment_delivery_date: string | null;
  shipment_type: string | null;
  shipment_weight: number | null;
  shipment_weight_unit: string | null;
  signed_by: string | null;
  smses: string[];
  source: string;
  status: AfterShipStatus;
  tag: AfterShipTag;
  title: string | null;
  tracked_count: number;
  checkpoints: AfterShipCheckpoint[];
}

export type AfterShipTag =
  | "Pending"
  | "InfoReceived"
  | "InTransit"
  | "OutForDelivery"
  | "AttemptFail"
  | "Delivered"
  | "AvailableForPickup"
  | "Exception"
  | "Expired";

export interface AfterShipStatus {
  id: string;
  object_created_at: string;
  updated_at: string;
  date: string | null;
  yealy: number | null;
  month: number | null;
  day: number | null;
  time: string | null;
  timezone: string | null;
  location: string | null;
  city: string | null;
  province: string | null;
  country_iso3: string | null;
  zip: string | null;
  longitude: number | null;
  latitude: number | null;
  message: string;
  tag: AfterShipTag;
  subtag: string | null;
  subtag_message: string | null;
  status: string;
}

export interface AfterShipCheckpoint {
  slug: string;
  city: string | null;
  created_at: string;
  location: string | null;
  country_iso3: string | null;
  message: string;
  country_name: string | null;
  updated_at: string;
  status: string;
  tag: AfterShipTag;
  subtag: string | null;
  subtag_message: string | null;
  checkpoint_time: string | null;
  state: string | null;
}

export interface AfterShipTrackingsResponse {
  meta: { code: number };
  data: { trackings: AfterShipTracking[] };
}

export interface AfterShipTrackingResponse {
  meta: { code: number };
  data: { tracking: AfterShipTracking };
}

export interface AfterShipCreateTrackingBody {
  tracking: {
    tracking_number: string;
    slug?: string; // carrier slug; if omitted AfterShip tries to detect
    title?: string;
    order_id?: string;
    customer_name?: string;
  };
}
