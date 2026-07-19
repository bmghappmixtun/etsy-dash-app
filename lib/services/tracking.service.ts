import { ordersRepository } from "../repositories/orders.repository";
import { trackingRepository } from "../repositories/tracking.repository";
import { authService } from "./auth.service";
import * as tracking17 from "../tracking17/client";
import { mapSeventeenTrackStatus } from "../tracking17/status-mapper";
import { logger } from "../logger";
import { hasRealTracking17Credentials } from "../env";
import { prisma } from "../db";
import type { Order } from "@prisma/client";

/**
 * Tracking service: pushes tracking numbers to 17TRACK and pulls updates.
 * 17TRACK auto-pushes via webhook (we listen at /api/tracking/webhook).
 * We also poll for active orders to keep statuses fresh.
 */

const TRACKING_REFRESH_BATCH = 25;

export const trackingService = {
  /**
   * Push a single order's tracking to 17TRACK. Idempotent.
   * Skipped if order has no tracking number or no API key.
   */
  async pushTrackingForOrder(order: Order) {
    if (!order.trackingNumber) return null;
    if (!hasRealTracking17Credentials()) {
      logger.warn("17TRACK not configured, skipping push");
      return null;
    }

    try {
      const result = await tracking17.registerTracking(order.trackingNumber, {
        tag: `etsy-receipt-${order.etsyReceiptId}`,
        remark: `Etsy order ${order.etsyReceiptId}`,
      });

      if (result.accepted.length > 0) {
        const accepted = result.accepted[0];
        return {
          slug: accepted.carrier ? String(accepted.carrier) : null,
          track_info: accepted.track_info,
        };
      }
      // Handle "already registered" as success
      if (result.rejected.length > 0) {
        const rej = result.rejected[0] as {
          number?: string;
          carrier?: number;
          error?: { code?: number; message?: string };
        };
        // -18019901 = already registered (success case)
        if (rej.error?.code === -18019901) {
          return {
            slug: rej.carrier ? String(rej.carrier) : null,
            track_info: undefined,
          };
        }
        logger.warn("17TRACK rejected tracking", {
          number: order.trackingNumber,
          error: rej.error,
        });
        return null;
      }
      return null;
    } catch (err) {
      logger.warn("17TRACK register tracking failed", {
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
    if (!hasRealTracking17Credentials()) {
      logger.warn("17TRACK not configured, skipping refresh");
      return { updated: 0, eventsAdded: 0, errors: 0 };
    }

    const orders = await ordersRepository.listForTrackingRefresh(
      TRACKING_REFRESH_BATCH,
    );
    let updated = 0;
    let eventsAdded = 0;
    let errors = 0;

    for (const order of orders) {
      if (!order.trackingNumber) continue;

      // Make sure tracking is registered
      let carrier = order.trackingSlug;
      if (!carrier) {
        const tracking = await this.pushTrackingForOrder(order);
        if (tracking?.slug) {
          carrier = tracking.slug;
        }
      }
      if (!carrier) {
        errors++;
        continue;
      }

      // Get current status from 17TRACK
      try {
        // 17TRACK may need a few seconds to propagate registration,
        // so first try with carrier (most common case). If rejected
        // as "not registered", try once more without carrier (will work
        // for tracking numbers that were registered in earlier session).
        let result = await tracking17.getTrackInfo([
          { number: order.trackingNumber, carrier: Number(carrier) },
        ]);

        // Fallback: try without carrier
        if (result.accepted.length === 0 && carrier) {
          result = await tracking17.getTrackInfo([
            { number: order.trackingNumber },
          ]);
        }

        if (result.accepted.length === 0) {
          // Not found — might be invalid number or not yet registered
          // (17TRACK can take a few seconds to propagate registration)
          if (result.rejected.length > 0) {
            const errCode = result.rejected[0].error?.code;
            if (errCode === -18019902) {
              // Not registered yet — skip silently, next refresh will pick up
              logger.debug("17TRACK tracking not yet registered", {
                number: order.trackingNumber,
              });
            } else {
              logger.debug("17TRACK getTrackInfo rejected", {
                number: order.trackingNumber,
                error: result.rejected[0].error,
              });
            }
          }
          continue;
        }

        const accepted = result.accepted[0];
        const trackInfo = accepted.track_info;
        if (!trackInfo?.latest_status) {
          continue;
        }

        const main = trackInfo.latest_status.status;
        const sub = trackInfo.latest_status.sub_status;
        const appStatus = mapSeventeenTrackStatus(main, sub);

        // Update order if status changed
        if (order.status !== appStatus) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: appStatus,
              trackingSlug: String(accepted.carrier ?? carrier),
              lastTrackingUpdate: new Date(),
              deliveryDate:
                appStatus === "DELIVERED" ? new Date() : undefined,
            },
          });
          updated++;
        } else {
          // Just update timestamp
          await prisma.order.update({
            where: { id: order.id },
            data: { lastTrackingUpdate: new Date() },
          });
        }

        // Insert latest event
        if (trackInfo.tracking_event_list?.[0]) {
          const evt = trackInfo.tracking_event_list[0];
          await prisma.trackingEvent.create({
            data: {
              orderId: order.id,
              status: evt.sub_status ?? evt.status ?? "Unknown",
              appStatus,
              description: evt.description ?? `Status: ${appStatus}`,
              location: evt.location ?? null,
              eventDate: evt.time_iso8601
                ? new Date(evt.time_iso8601)
                : new Date(),
            },
          });
          eventsAdded++;
        }
      } catch (err) {
        logger.warn("17TRACK getTrackInfo failed", {
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }

    return { updated, eventsAdded, errors };
  },

  /**
   * Push any missing trackings to 17TRACK.
   * Returns counts of pushed and total attempted.
   */
  async pushMissingTrackings(limit: number = 100) {
    if (!hasRealTracking17Credentials()) {
      return { pushed: 0, total: 0 };
    }

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
