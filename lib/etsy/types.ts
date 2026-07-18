/**
 * Etsy API v3 types — only the fields we use.
 * https://developers.etsy.com/documentation/reference
 */

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
  total_price: number; // decimal as string
  subtotal: number;
  total_shipping_cost: number;
  total_tax_cost: number;
  total_vat_cost: number;
  discount_amt: number;
  grandtotal: number;
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
  create_timestamp: number; // unix seconds
  update_timestamp: number;
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
  price: number;
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
