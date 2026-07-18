import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasRealAfterShipCredentials, hasRealEtsyCredentials } from "@/lib/env";
import { syncLogsRepository } from "@/lib/repositories/sync-logs.repository";
import { ping as afterShipPing } from "@/lib/aftership/client";

/**
 * GET /api/health
 * Health check for the dashboard. Returns status of all integrations.
 */
export async function GET() {
  const checks = await Promise.allSettled([
    // DB
    prisma.$queryRaw`SELECT 1`.then(() => ({ status: "up" as const })),
    // AfterShip
    hasRealAfterShipCredentials()
      ? afterShipPing().then((ok) =>
          ok ? ({ status: "up" as const }) : ({ status: "down" as const }),
        )
      : Promise.resolve({ status: "unconfigured" as const }),
  ]);

  const [dbResult, afterShipResult] = checks;
  const etsyConfigured = hasRealEtsyCredentials();

  // Last sync times
  const [lastOrdersSync, lastTrackingSync, lastTokenSync] = await Promise.all([
    syncLogsRepository.getLastByType("ORDERS_SYNC"),
    syncLogsRepository.getLastByType("TRACKING_REFRESH"),
    syncLogsRepository.getLastByType("TOKEN_REFRESH"),
  ]);

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    integrations: {
      database:
        dbResult.status === "fulfilled"
          ? dbResult.value
          : { status: "down", error: String(dbResult.reason) },
      etsy: etsyConfigured
        ? { status: "configured" }
        : { status: "unconfigured" },
      aftership:
        afterShipResult.status === "fulfilled"
          ? afterShipResult.value
          : {
              status: "down",
              error: String(
                afterShipResult.status === "rejected"
                  ? afterShipResult.reason
                  : "unknown",
              ),
            },
    },
    lastSync: {
      orders: lastOrdersSync
        ? {
            at: lastOrdersSync.startedAt,
            status: lastOrdersSync.status,
            ordersSynced: lastOrdersSync.ordersSynced,
          }
        : null,
      tracking: lastTrackingSync
        ? {
            at: lastTrackingSync.startedAt,
            status: lastTrackingSync.status,
            updated: lastTrackingSync.trackingUpdated,
          }
        : null,
      tokens: lastTokenSync
        ? {
            at: lastTokenSync.startedAt,
            status: lastTokenSync.status,
          }
        : null,
    },
  });
}
