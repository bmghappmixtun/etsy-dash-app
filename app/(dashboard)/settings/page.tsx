import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { syncLogsRepository } from "@/lib/repositories/sync-logs.repository";
import { hasRealAfterShipCredentials, hasRealEtsyCredentials } from "@/lib/env";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { SyncButton } from "./_components/sync-button";
import { TokenRefreshButton } from "./_components/token-refresh-button";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await prisma.user.findFirst({
    select: {
      id: true,
      shopId: true,
      shopName: true,
      etsyUserId: true,
      tokenExpiresAt: true,
      updatedAt: true,
    },
  });

  const [recentSyncs, lastOrdersSync, lastTrackingSync, lastTokenSync] =
    await Promise.all([
      syncLogsRepository.listRecent(undefined, 10),
      syncLogsRepository.getLastByType("ORDERS_SYNC"),
      syncLogsRepository.getLastByType("TRACKING_REFRESH"),
      syncLogsRepository.getLastByType("TOKEN_REFRESH"),
    ]);

  const hasEtsy = hasRealEtsyCredentials();
  const hasAfterShip = hasRealAfterShipCredentials();

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your shop connection and sync status
        </p>
      </div>

      {/* Etsy connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Etsy connection</span>
            {user ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="warning">Not connected</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasEtsy && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Etsy API keys not configured</p>
              <p className="text-xs mt-1">
                Set <code className="text-xs">ETSY_API_KEY</code> and{" "}
                <code className="text-xs">ETSY_SHARED_SECRET</code> in your
                environment to enable OAuth.
              </p>
            </div>
          )}

          {user ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Shop name</p>
                  <p className="font-medium">{user.shopName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Shop ID</p>
                  <p className="font-mono text-xs">{user.shopId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Etsy user ID</p>
                  <p className="font-mono text-xs">{user.etsyUserId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Token expires</p>
                  <p className="text-xs">
                    {formatDateTime(user.tokenExpiresAt)}
                    <span className="text-muted-foreground ml-1">
                      ({relativeTime(user.tokenExpiresAt)})
                    </span>
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/api/auth/etsy">Reconnect</Link>
                </Button>
                <TokenRefreshButton />
              </div>
            </div>
          ) : (
            <Button asChild variant="brand" disabled={!hasEtsy}>
              <Link href="/api/auth/etsy">Connect with Etsy</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* AfterShip */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>AfterShip integration</span>
            {hasAfterShip ? (
              <Badge variant="success">Configured</Badge>
            ) : (
              <Badge variant="warning">Not configured</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {hasAfterShip ? (
            <p>
              API key configured. Tracking numbers from new orders will be
              automatically pushed to AfterShip.
            </p>
          ) : (
            <p>
              Set <code className="text-xs">AFTERSHIP_API_KEY</code> in your
              environment to enable shipment tracking.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Last orders sync</p>
              <p className="font-medium">
                {lastOrdersSync
                  ? relativeTime(lastOrdersSync.startedAt)
                  : "Never"}
              </p>
              {lastOrdersSync && (
                <p className="text-xs text-muted-foreground">
                  {lastOrdersSync.ordersSynced} orders ·{" "}
                  {lastOrdersSync.status}
                </p>
              )}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                Last tracking refresh
              </p>
              <p className="font-medium">
                {lastTrackingSync
                  ? relativeTime(lastTrackingSync.startedAt)
                  : "Never"}
              </p>
              {lastTrackingSync && (
                <p className="text-xs text-muted-foreground">
                  {lastTrackingSync.trackingUpdated} updated ·{" "}
                  {lastTrackingSync.status}
                </p>
              )}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Last token refresh</p>
              <p className="font-medium">
                {lastTokenSync ? relativeTime(lastTokenSync.startedAt) : "Never"}
              </p>
              {lastTokenSync && (
                <p className="text-xs text-muted-foreground">
                  {lastTokenSync.status}
                </p>
              )}
            </div>
          </div>
          <SyncButton disabled={!user || !hasEtsy} />
        </CardContent>
      </Card>

      {/* Recent sync history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync history</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSyncs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No sync history yet
            </p>
          ) : (
            <div className="space-y-1">
              {recentSyncs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs">{log.type}</span>
                    <Badge
                      variant={
                        log.status === "SUCCESS"
                          ? "success"
                          : log.status === "FAILED"
                            ? "destructive"
                            : log.status === "RUNNING"
                              ? "info"
                              : "warning"
                      }
                    >
                      {log.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    {log.ordersSynced > 0 && (
                      <span>{log.ordersSynced} orders</span>
                    )}
                    {log.trackingUpdated > 0 && (
                      <span>{log.trackingUpdated} tracking</span>
                    )}
                    <span>{relativeTime(log.startedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
