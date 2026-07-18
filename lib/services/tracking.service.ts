import { ordersRepository } from "../repositories/orders.repository";
import { trackingRepository } from "../repositories/tracking.repository";
import { authService } from "./auth.service";
import * as afterShip from "../aftership/client";
import { mapAfterShipStatus } from "../aftership/status-mapper";
import { logger } from "../logger";
import type { Order } from "@prisma/client";

/**
 * Tracking service: pushes tracking numbers to AfterShip and pulls updates.
 */

const TRACKING_REFRESH_BATCH = 25;

export const trackingService = {
  /**
   * Push a single order's tracking to AfterShip. Idempotent.
   * Skipped if order has no tracking number.
   */
  async pushTrackingForOrder(order: Order) {
    if (!order.trackingNumber) return null;
    if (order.trackingSlug && order.trackingNumber) {
      // Already pushed — just check status
      return afterShip.getTrackingByNumber(
        order.trackingSlug,
        order.trackingNumber,
      );
    }
    try {
      return await afterShip.createTracking(order.trackingNumber, {
        slug: order.trackingCarrier ?? undefined,
        title: `Order ${order.etsyReceiptId}`,
        orderId: order.id,
      });
    } catch (err) {
      logger.warn("AfterShip create tracking failed", {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  },

  /**
   * Refresh tracking status for all non-delivered orders.
   * Returns counts of updated orders and inserted events.
   */
  async refreshAll() {
    const orders = await ordersRepository.listForTrackingRefresh(
      TRACKING_REFRESH_BATCH,
    );
    let updated = 0;
    let eventsAdded = 0;
    let errors = 0;

    for (const order of orders) {
      if (!order.trackingNumber) continue;

      // Make sure we have the carrier slug
      let slug = order.trackingSlug;
      if (!slug) {
        const tracking = await this.pushTrackingForOrder(order);
        if (tracking) {
          slug = tracking.slug;
        }
      }
      if (!slug) {
        errors++;
        continue;
      }

      const tracking = await afterShip
        .getTrackingByNumber(slug, order.trackingNumber)
        .catch((err) => {
          logger.warn("getTrackingByNumber failed", {
            orderId: order.id,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        });
      if (!tracking) {
        errors++;
        continue;
      }

      // Update order status
      const newStatus = mapAfterShipStatus(tracking.tag);
      const updateData: Parameters<typeof ordersRepository.updateTracking>[1] =
        {
          status: newStatus,
          lastTrackingUpdate: new Date(),
        };

      if (newStatus === "DELIVERED" && tracking.shipment_delivery_date) {
        updateData.deliveryDate = new Date(tracking.shipment_delivery_date);
      }
      if (
        (newStatus === "IN_TRANSIT" || newStatus === "DELIVERED") &&
        tracking.shipment_pickup_date &&
        !order.shippedDate
      ) {
        updateData.shippedDate = new Date(tracking.shipment_pickup_date);
      }

      await ordersRepository.updateTracking(order.id, updateData);

      // Append new events (deduped via @@unique)
      if (tracking.checkpoints?.length) {
        const events = tracking.checkpoints
          .filter((cp) => cp.checkpoint_time)
          .map((cp) => ({
            status: cp.tag,
            appStatus: mapAfterShipStatus(cp.tag),
            description: cp.message,
            location: cp.location ?? null,
            eventDate: new Date(cp.checkpoint_time!),
          }));
        eventsAdded += await trackingRepository.appendEvents(order.id, events);
      }

      updated++;
    }

    return { updated, eventsAdded, errors };
  },

  /**
   * Push tracking for newly synced orders (those with no trackingSlug yet).
   * Called after orders sync.
   */
  async pushMissingTrackings(limit: number = 100) {
    const { prisma } = await import("../db");
    const orders = await prisma.order.findMany({
      where: {
        trackingNumber: { not: null },
        trackingSlug: null,
      },
      take: limit,
    });

    let pushed = 0;
    for (const order of orders) {
      const tracking = await this.pushTrackingForOrder(order);
      if (tracking) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            trackingSlug: tracking.slug,
            trackingCarrier: tracking.slug,
            lastTrackingUpdate: new Date(),
          },
        });
        pushed++;
      }
    }
    return { pushed, total: orders.length };
  },
};
