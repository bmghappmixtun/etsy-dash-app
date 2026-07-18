import { ordersRepository } from "../repositories/orders.repository";
import { authService } from "./auth.service";
import { getCountryInfo } from "../countries";
import { iterateReceipts } from "../etsy/client";
import type { EtsyReceipt } from "../etsy/types";
import { logger } from "../logger";

/**
 * Orders service: orchestrates fetching orders from Etsy + persisting to DB.
 */

export const ordersService = {
  /**
   * Sync orders from Etsy to local DB. Idempotent.
   * @param minCreated - unix seconds; if not provided, fetches all
   */
  async syncFromEtsy(options: { minCreated?: number } = {}) {
    const user = await authService.getAuthenticatedUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    let totalSynced = 0;
    let errorsCount = 0;

    for await (const batch of iterateReceipts(
      user.accessToken,
      user.shopId,
      { minCreated: options.minCreated },
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

    return ordersRepository.upsert({
      etsyReceiptId: BigInt(receipt.receipt_id),
      buyerName: receipt.name,
      buyerEmail: receipt.buyer_email,
      country: country.code,
      countryName: country.name,
      price: parseFloat(receipt.grandtotal.toString()),
      currency: receipt.currency_code,
      createdAt,
      trackingNumber,
      trackingCarrier,
      status: "UNKNOWN", // Updated by tracking service
      items: (receipt.transactions ?? []).map((t) => ({
        etsyListingId: BigInt(t.listing_id),
        title: t.title,
        quantity: t.quantity,
        price: parseFloat(t.price.toString()),
        variation: t.variations?.[0]?.value ?? null,
      })),
    });
  },
};
