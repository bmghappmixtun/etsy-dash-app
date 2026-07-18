import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  KeyRound,
  Truck,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { syncLogsRepository } from "@/lib/repositories/sync-logs.repository";
import { relativeTime, formatDateTime } from "@/lib/utils";
import { HealthRefreshButton } from "./_components/health-refresh-button";

export const metadata = { title: "API Status" };
export const dynamic = "force-dynamic";

interface HealthData {
  status: string;
  timestamp: string;
  integrations: {
    database: { status: string; error?: string };
    etsy: { status: string };
    aftership: { status: string; error?: string };
  };
  lastSync: {
    orders: { at: Date; status: string; ordersSynced: number } | null;
    tracking: { at: Date; status: string; updated: number } | null;
    tokens: { at: Date; status: string } | null;
  };
}

async function getHealth(): Promise<HealthData> {
  // Direct DB checks (faster than going through /api/health)
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`.then(() => ({ status: "up" as const })),
  ]);

  const dbResult = checks[0];

  const [user, lastOrdersSync, lastTrackingSync, lastTokenSync] =
    await Promise.all([
      prisma.user.findFirst(),
      syncLogsRepository.getLastByType("ORDERS_SYNC"),
      syncLogsRepository.getLastByType("TRACKING_REFRESH"),
      syncLogsRepository.getLastByType("TOKEN_REFRESH"),
    ]);

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    integrations: {
      database:
        dbResult.status === "fulfilled"
          ? dbResult.value
          : {
              status: "down",
              error: String(
                dbResult.status === "rejected" ? dbResult.reason : "unknown",
              ),
            },
      etsy: { status: user ? "configured" : "not_connected" },
      aftership: {
        status: process.env.AFTERSHIP_API_KEY?.startsWith("dev_")
          ? "unconfigured"
          : "configured",
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
        ? { at: lastTokenSync.startedAt, status: lastTokenSync.status }
        : null,
    },
  };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "up" || status === "configured" || status === "SUCCESS") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (status === "down" || status === "FAILED") {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  if (status === "unconfigured" || status === "not_connected") {
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  }
  return <Clock className="h-4 w-4 text-blue-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const variant: "success" | "destructive" | "warning" | "info" | "outline" =
    status === "up" || status === "configured" || status === "SUCCESS"
      ? "success"
      : status === "down" || status === "FAILED"
        ? "destructive"
        : status === "unconfigured" || status === "not_connected"
          ? "warning"
          : "info";
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function ApiStatusPage() {
  const health = await getHealth();

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Status</h1>
          <p className="text-sm text-muted-foreground">
            Health of all integrations and background jobs
          </p>
        </div>
        <HealthRefreshButton />
      </div>

      <p className="text-xs text-muted-foreground">
        Last checked: {formatDateTime(health.timestamp)}
      </p>

      {/* Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database
              </span>
              <StatusIcon status={health.integrations.database.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <StatusBadge status={health.integrations.database.status} />
            {health.integrations.database.error && (
              <p className="text-xs text-destructive">
                {health.integrations.database.error}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Etsy
              </span>
              <StatusIcon status={health.integrations.etsy.status} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={health.integrations.etsy.status} />
            <p className="text-xs text-muted-foreground mt-2">
              OAuth + receipts API
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                AfterShip
              </span>
              <StatusIcon status={health.integrations.aftership.status} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={health.integrations.aftership.status} />
            <p className="text-xs text-muted-foreground mt-2">
              Shipment tracking
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cron jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Background jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Orders sync (every 30 min)
              </p>
              <p className="font-medium mt-1">
                {health.lastSync.orders
                  ? relativeTime(health.lastSync.orders.at)
                  : "Never"}
              </p>
              {health.lastSync.orders && (
                <p className="text-xs text-muted-foreground">
                  {health.lastSync.orders.ordersSynced} orders ·{" "}
                  {health.lastSync.orders.status}
                </p>
              )}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Truck className="h-3 w-3" />
                Tracking refresh (every 1h)
              </p>
              <p className="font-medium mt-1">
                {health.lastSync.tracking
                  ? relativeTime(health.lastSync.tracking.at)
                  : "Never"}
              </p>
              {health.lastSync.tracking && (
                <p className="text-xs text-muted-foreground">
                  {health.lastSync.tracking.updated} updated ·{" "}
                  {health.lastSync.tracking.status}
                </p>
              )}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Token refresh (every 50 min)
              </p>
              <p className="font-medium mt-1">
                {health.lastSync.tokens
                  ? relativeTime(health.lastSync.tokens.at)
                  : "Never"}
              </p>
              {health.lastSync.tokens && (
                <p className="text-xs text-muted-foreground">
                  {health.lastSync.tokens.status}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
