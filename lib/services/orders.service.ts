import { ordersRepository } from "../repositories/orders.repository";
import { authService } from "./auth.service";
import { getCountryInfo } from "../countries";
import { iterateReceipts } from "../etsy/client";
import {
  type EtsyReceipt,
  getCurrencyCode,
  mapEtsyReceiptStatusToApp,
  moneyToNumber,
} from "../etsy/types";
import { logger } from "../logger";

/**
 * Orders service: orchestrates fetching orders from Etsy + persisting to DB.
 */

export const ordersService = {
  /**
   * Sync orders from Etsy to local DB. Idempotent.
   * Uses min_created for full sync, or min_last_modified for incremental.
   */
  async syncFromEtsy(
    options: {
      minCreated?: number; // unix seconds, for first sync
      minLastModified?: number; // unix seconds, for incremental sync
    } = {},
  ) {
    const user = await authService.getAuthenticatedUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    let totalSynced = 0;
    let errorsCount = 0;

    for await (const batch of iterateReceipts(
      user.accessToken,
      user.shopId,
      {
        minCreated: options.minCreated,
        minLastModified: options.minLastModified,
      },
    )) {
      for (const receipt of batch) {
        try {
          await this.upsertReceipt(receipt);
          totalSynced++;
        } catch (err) {
          errorsCount++;
          logger.error("Failed to upsert receipt", {
            receiptId: receipt.receipt_id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return { totalSynced, errorsCount };
  },

  /**
   * Map an Etsy receipt to our schema and upsert.
   */
  async upsertReceipt(receipt: EtsyReceipt) {
    const country = getCountryInfo(receipt.country_iso);
    const createdAt = new Date(receipt.create_timestamp * 1000);

    // Pick tracking from first shipment, or top-level fields
    const shipment = receipt.shipments?.[0];
    const trackingNumber =
      shipment?.tracking_code ?? receipt.shipping_tracking_code ?? null;
    const trackingCarrier =
      shipment?.carrier_name ?? receipt.shipping_tracking_provider ?? null;

    // Map Etsy's status to our app's status enum
    const appStatus = mapEtsyReceiptStatusToApp(
      receipt.status,
      receipt.was_shipped,
      receipt.was_delivered,
    );

    return ordersRepository.upsert({
      etsyReceiptId: BigInt(receipt.receipt_id),
      buyerName: receipt.name,
      buyerEmail: receipt.buyer_email,
      country: country.code,
      countryName: country.name,
      // Money conversion: amount / divisor (Etsy returns sub-units like pennies)
      price: moneyToNumber(receipt.grandtotal),
      currency: getCurrencyCode(receipt.grandtotal) || receipt.currency_code,
      createdAt,
      trackingNumber,
      trackingCarrier,
      status: appStatus,
      receiptStatus: receipt.status, // store Etsy's raw status for reference
      items: (receipt.transactions ?? []).map((t) => ({
        etsyListingId: BigInt(t.listing_id),
        title: t.title,
        quantity: t.quantity,
        price: moneyToNumber(t.price),
        variation: t.variations?.[0]?.value ?? null,
      })),
    });
  },
};
