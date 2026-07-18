import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { OrdersLineChart } from "@/components/dashboard/orders-line-chart";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { CountryBarChart } from "@/components/dashboard/country-bar-chart";
import { AnalyticsFilters } from "./_components/analytics-filters";
import { analyticsService } from "@/lib/services/analytics.service";
import { formatCurrency } from "@/lib/utils";
import {
  Globe,
  Package,
  TrendingUp,
  Truck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ range?: "7" | "30" | "90" | "365" }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const days = params.range ? parseInt(params.range, 10) : 90;

  const filters = {
    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
  };

  const [overview, countries, timeSeries, carriers] = await Promise.all([
    analyticsService.getOverview(filters),
    analyticsService.getCountries(filters),
    analyticsService.getTimeSeries(days),
    analyticsService.getCarriers(filters),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Deep dive into your shop performance
          </p>
        </div>
        <AnalyticsFilters currentRange={params.range} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          label="Exception rate"
          value={`${overview.exceptionPct.toFixed(1)}%`}
          icon={AlertTriangle}
          hint={`${overview.exception} orders`}
        />
      </div>

      {/* Time series */}
      <Card>
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

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Top countries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CountryBarChart data={countries} />
          </CardContent>
        </Card>
      </div>

      {/* Carriers table */}
      {carriers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Carriers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {carriers.map((c) => (
                <div
                  key={c.carrier}
                  className="flex flex-col rounded-md border p-3"
                >
                  <span className="text-xs uppercase text-muted-foreground">
                    {c.carrier}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">
                    {c.count}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {((c.count / overview.total) * 100).toFixed(1)}% of orders
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
