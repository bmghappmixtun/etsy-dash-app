import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  parseWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/tracking17/client";
import { mapSeventeenTrackStatus } from "@/lib/tracking17/status-mapper";

/**
 * POST /api/tracking/webhook
 * Receives tracking updates from 17TRACK.
 *
 * Flow:
 * 1. Read raw body (before JSON parse, for signature verification)
 * 2. Verify HMAC signature using `sign` header
 * 3. Parse payload
 * 4. For each updated tracking: update Order status + create TrackingEvent
 * 5. Return 200 OK within 5 seconds (or 17TRACK marks as Failure)
 *
 * Note: we don't require auth (the signature is the auth)
 */
export async function POST(req: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    const signHeader = req.headers.get("sign");

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signHeader)) {
      logger.warn("17TRACK webhook signature invalid", {
        hasSign: !!signHeader,
        bodyLength: rawBody.length,
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    // Parse JSON
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Parse 17TRACK payload
    const payload = parseWebhookPayload(body);
    if (!payload) {
      return NextResponse.json(
        { error: "Not a TRACKING_UPDATED event" },
        { status: 400 },
      );
    }

    logger.info("17TRACK webhook received", {
      accepted: payload.data.accepted.length,
      rejected: payload.data.rejected.length,
    });

    // Process each accepted tracking
    let updated = 0;
    let eventsAdded = 0;
    const errors: Array<{ number: string; error: string }> = [];

    for (const tracking of payload.data.accepted) {
      try {
        const { number, track_info, carrier } = tracking;
        if (!track_info) continue;

        const main = track_info.latest_status?.status;
        const sub = track_info.latest_status?.sub_status;
        const appStatus = mapSeventeenTrackStatus(main, sub);

        // Find the order by tracking number
        const order = await prisma.order.findFirst({
          where: { trackingNumber: number },
          select: { id: true, status: true, trackingCarrier: true },
        });

        if (!order) {
          // Order not found in our DB (might have been deleted, or tracking is not for us)
          continue;
        }

        // Update order status + tracking info
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: appStatus,
            trackingSlug: carrier ? String(carrier) : order.trackingCarrier,
            trackingCarrier: carrier
              ? String(carrier)
              : order.trackingCarrier,
            lastTrackingUpdate: new Date(),
            shippedDate: track_info.est_delivery_time
              ? undefined // don't override if set
              : undefined,
            deliveryDate:
              appStatus === "DELIVERED" ? new Date() : undefined,
          },
        });

        // Create a TrackingEvent for the latest status
        if (track_info.latest_status) {
          const eventTime =
            track_info.tracking_event_list?.[0]?.time_iso8601
              ? new Date(track_info.tracking_event_list[0].time_iso8601)
              : new Date();
          await prisma.trackingEvent.create({
            data: {
              orderId: order.id,
              status: track_info.latest_status.sub_status ?? "Unknown",
              appStatus,
              description:
                track_info.latest_status.sub_status_descr ??
                track_info.latest_status.status ??
                "Tracking updated",
              location:
                track_info.tracking_event_list?.[0]?.location ?? null,
              eventDate: eventTime,
            },
          });
          eventsAdded++;
        }

        updated++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push({ number: tracking.number, error: errMsg });
        logger.error("17TRACK webhook: failed to process tracking", {
          number: tracking.number,
          error: errMsg,
        });
      }
    }

    // Log to sync_logs for visibility
    try {
      await prisma.syncLog.create({
        data: {
          type: "TRACKING_REFRESH",
          status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
          ordersSynced: updated,
          metadata: {
            source: "17track-webhook",
            accepted: payload.data.accepted.length,
            rejected: payload.data.rejected.length,
            eventsAdded,
            errors,
          },
        },
      });
    } catch (err) {
      logger.error("Failed to write sync log", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Return 200 quickly (17TRACK requires < 5s response)
    return NextResponse.json({
      success: true,
      updated,
      eventsAdded,
      errors: errors.length,
    });
  } catch (err) {
    logger.error("17TRACK webhook handler error", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Still return 200 to avoid 17TRACK retries on our errors
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
