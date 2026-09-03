/**
 * Etsy Open API v3 types.
 * https://developers.etsy.com/documentation/reference
 *
 * IMPORTANT: Money values are returned in sub-units (pennies for USD).
 * The actual value = amount / divisor.
 * Example: {amount: 500, divisor: 100, currency_code: "USD"} = $5.00
 */

export interface EtsyMoney {
  amount: number; // integer in sub-units
  divisor: number; // 100 for USD/EUR/GBP, 1 for JPY
  currency_code: string;
}

/**
 * Helper to convert EtsyMoney to a plain number.
 */
export function moneyToNumber(m: EtsyMoney | number | null | undefined): number {
  if (m == null) return 0;
  if (typeof m === "number") return m;
  if (typeof m === "object" && "amount" in m && "divisor" in m) {
    return m.amount / m.divisor;
  }
  return 0;
}

export function getCurrencyCode(
  m: EtsyMoney | string | null | undefined,
): string {
  if (!m) return "USD";
  if (typeof m === "string") return m;
  if (typeof m === "object" && "currency_code" in m) return m.currency_code;
  return "USD";
}

/**
 * Receipt status values returned by Etsy.
 * See https://developers.etsy.com/documentation/essentials/definitions
 */
export type EtsyReceiptStatus =
  | "open"
  | "paid"
  | "completed"
  | "payment processing"
  | "canceled"
  | "fully refunded"
  | "partially refunded";

export interface EtsyTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
  scope: string;
}

export interface EtsyUser {
  user_id: number;
  primary_email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface EtsyShop {
  shop_id: number;
  shop_name: string;
  title: string | null;
  currency_code: string;
}

export interface EtsyReceipt {
  receipt_id: number;
  receipt_type: number;
  order_id: number | null;
  currency_code: string;
  total_price: EtsyMoney;
  subtotal: EtsyMoney;
  total_shipping_cost: EtsyMoney;
  total_tax_cost: EtsyMoney;
  total_vat_cost: EtsyMoney;
  discount_amt: EtsyMoney;
  grandtotal: EtsyMoney;
  buyer_email: string;
  buyer_user_id: number | null;
  name: string;
  first_line: string;
  second_line: string | null;
  city: string;
  state: string | null;
  zip: string;
  country_iso: string; // ISO-3166-1 alpha-2
  shipping_method: string | null;
  shipping_tracking_code: string | null;
  shipping_tracking_provider: string | null;
  payment_method: string;
  payment_email: string | null;
  message_from_buyer: string | null;
  message_from_seller: string | null;
  was_paid: boolean;
  was_shipped: boolean;
  was_delivered: boolean | null;
  status: EtsyReceiptStatus;
  create_timestamp: number; // unix seconds
  created_timestamp: number; // alias sometimes
  update_timestamp: number;
  last_modified_timestamp: number;
  expected_ship_date: number | null;
  shipments: EtsyShipment[];
  transactions: EtsyTransaction[];
}

export interface EtsyShipment {
  shipment_id: number;
  carrier_name: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  shipped_timestamp: number | null;
  deliver_timestamp: number | null;
  receipt_shipping_id: number;
}

export interface EtsyTransaction {
  transaction_id: number;
  title: string;
  description: string;
  quantity: number;
  price: EtsyMoney;
  listing_id: number;
  variations: { property_id: number; value: string }[] | null;
  product_data: Record<string, unknown> | null;
}

export interface EtsyReceiptsResponse {
  count: number;
  results: EtsyReceipt[];
  params: Record<string, string>;
  type: string;
  pagination: Record<string, unknown>;
}

/**
 * Map Etsy receipt status to our app's OrderStatus enum.
 * Note: this maps the *receipt* (order) state, not the *tracking* state.
 * Tracking state is handled by AfterShip status mapper.
 */
export function mapEtsyReceiptStatusToApp(
  status: EtsyReceiptStatus,
  wasShipped: boolean,
  wasDelivered: boolean | null,
):
  | "DELIVERED"
  | "IN_TRANSIT"
  | "PRE_TRANSIT"
  | "EXCEPTION"
  | "FAILED_ATTEMPT"
  | "AVAILABLE_FOR_PICKUP"
  | "UNKNOWN" {
  if (status === "canceled") return "EXCEPTION";
  if (status === "fully refunded" || status === "partially refunded")
    return "EXCEPTION";
  // Etsy "Completed" = order is done from Etsy's side. Even if was_shipped/
  // was_delivered flags are false (carrier didn't ping back), the order is
  // terminal. Trust this signal as the primary "delivered" source.
  if (status === "Completed") return "DELIVERED";
  if (wasDelivered === true) return "DELIVERED";
  if (wasShipped) return "IN_TRANSIT";
  if (status === "paid") return "PRE_TRANSIT";
  return "UNKNOWN";
}
