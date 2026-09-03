import { Suspense } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  TrendingUp,
  Truck,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { OrdersLineChart } from "@/components/dashboard/orders-line-chart";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { CountryBarChart } from "@/components/dashboard/country-bar-chart";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { analyticsService } from "@/lib/services/analytics.service";
import { ordersRepository } from "@/lib/repositories/orders.repository";
import { formatCurrency, relativeTime } from "@/lib/utils";
import { getCountryInfo } from "@/lib/countries";
import { getExceptionReason } from "@/lib/utils-exception";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Default: last 30 days
  const filters = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  };

  const [overview, countries, timeSeries, needsAttention, recent] =
    await Promise.all([
      analyticsService.getOverview(filters),
      analyticsService.getCountries(filters),
      analyticsService.getTimeSeries(30),
      ordersRepository.list({
        status: "EXCEPTION",
        pageSize: 5,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
      ordersRepository.list({
        pageSize: 8,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    ]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Last 30 days · {format(new Date(), "MMM d, yyyy 'at' HH:mm")}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total orders"
          value={overview.total}
          icon={Package}
          hint={`${formatCurrency(overview.revenue, "USD")} revenue`}
        />
        <KpiCard
          label="Delivered"
          value={`${overview.deliveredPct.toFixed(1)}%`}
          icon={CheckCircle2}
          hint={`${overview.delivered} orders`}
        />
        <KpiCard
          label="In transit"
          value={`${overview.inTransitPct.toFixed(1)}%`}
          icon={Truck}
          hint={`${overview.inTransit} orders`}
        />
        <KpiCard
          label="Exceptions"
          value={`${overview.exceptionPct.toFixed(1)}%`}
          icon={AlertTriangle}
          hint={`${overview.exception} orders`}
        />
        <KpiCard
          label="Avg delivery"
          value={
            overview.avgDeliveryDays !== null
              ? `${overview.avgDeliveryDays.toFixed(1)}d`
              : "—"
          }
          icon={Clock}
          hint="shipped → delivered"
        />
      </div>

      {/* Needs attention */}
      {needsAttention.items.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Needs attention
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders?status=EXCEPTION">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsAttention.items.map((order) => {
              const country = getCountryInfo(order.country);
              const lastEvent = order.trackingEvents?.[0] ?? null;
              const reason = getExceptionReason(order.receiptStatus, lastEvent);
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs shrink-0">
                      #{order.etsyReceiptId.toString()}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {order.buyerName}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {country.flag} {order.country}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-destructive font-medium">
                          {reason.label}
                        </span>
                        {reason.detail && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground truncate">
                              {reason.detail}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={order.status} />
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(order.lastTrackingUpdate)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Orders over time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrdersLineChart data={timeSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonut
              data={Object.entries({
                DELIVERED: overview.delivered,
                IN_TRANSIT: overview.inTransit,
                EXCEPTION: overview.exception,
                PRE_TRANSIT: overview.preTransit,
              }).map(([status, count]) => ({
                status: status as never,
                count,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top countries</CardTitle>
          </CardHeader>
          <CardContent>
            <CountryBarChart data={countries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No orders yet.{" "}
                <Link
                  href="/settings"
                  className="text-brand underline-offset-4 hover:underline"
                >
                  Sync your shop
                </Link>{" "}
                to get started.
              </p>
            ) : (
              recent.items.map((order) => {
                const country = getCountryInfo(order.country);
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{order.etsyReceiptId.toString()}
                      </span>
                      <span className="truncate">{order.buyerName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs">{country.flag}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
