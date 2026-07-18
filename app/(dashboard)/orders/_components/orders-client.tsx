"use client";

import * as React from "react";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { DateRangeFilter, dateRangeToDates, type DateRange } from "@/components/filters/date-range-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { CountryFilter } from "@/components/filters/country-filter";
import { CarrierFilter } from "@/components/filters/carrier-filter";
import { Card, CardContent } from "@/components/ui/card";
import type { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface OrderRow {
  id: string;
  etsyReceiptId: string;
  buyerName: string;
  country: string;
  countryName: string;
  price: string;
  currency: string;
  createdAt: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  status: OrderStatus;
  lastTrackingUpdate: string | null;
  deliveryDate: string | null;
  shippedDate: string | null;
}

interface OrdersResponse {
  items: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function OrdersClient() {
  const [dateRange, setDateRange] = React.useState<DateRange>("30");
  const [status, setStatus] = React.useState<OrderStatus | undefined>();
  const [country, setCountry] = React.useState<string | undefined>();
  const [carrier, setCarrier] = React.useState<string | undefined>();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<OrdersResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [countries, setCountries] = React.useState<
    { country: string; countryName: string }[]
  >([]);
  const [carriers, setCarriers] = React.useState<
    { carrier: string; count: number }[]
  >([]);
  const [syncing, setSyncing] = React.useState(false);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  React.useEffect(() => {
    setPage(1);
  }, [dateRange, status, country, carrier, debouncedSearch]);

  // Fetch filter options once
  React.useEffect(() => {
    Promise.all([
      fetch("/api/analytics/countries").then((r) => r.json()),
      fetch("/api/orders?pageSize=1").then((r) => r.json()).catch(() => null),
    ])
      .then(([c, _]) => {
        if (c.countries) setCountries(c.countries);
      })
      .catch(() => {});
    // Load carriers via direct DB query through API
    fetch("/api/orders?pageSize=100")
      .then((r) => r.json())
      .then((d) => {
        const carrierMap = new Map<string, number>();
        d.items?.forEach((o: OrderRow) => {
          if (o.trackingCarrier) {
            carrierMap.set(
              o.trackingCarrier,
              (carrierMap.get(o.trackingCarrier) ?? 0) + 1,
            );
          }
        });
        setCarriers(
          Array.from(carrierMap.entries()).map(([carrier, count]) => ({
            carrier,
            count,
          })),
        );
      })
      .catch(() => {});
  }, []);

  // Fetch orders
  React.useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    const dates = dateRangeToDates(dateRange);
    if (dates.start) params.set("startDate", dates.start.toISOString());
    if (dates.end) params.set("endDate", dates.end.toISOString());
    if (status) params.set("status", status);
    if (country) params.set("country", country);
    if (carrier) params.set("carrier", carrier);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    params.set("pageSize", "25");

    fetch(`/api/orders?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [dateRange, status, country, carrier, debouncedSearch, page]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/orders/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.synced} orders`);
      // Refresh
      setPage(1);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const hasFilters = status || country || carrier || debouncedSearch;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <StatusFilter value={status} onChange={setStatus} />
            <CountryFilter
              value={country}
              onChange={setCountry}
              countries={countries}
            />
            <CarrierFilter
              value={carrier}
              onChange={setCarrier}
              carriers={carriers}
            />
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatus(undefined);
                  setCountry(undefined);
                  setCarrier(undefined);
                  setSearch("");
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <OrdersTable
        orders={data?.items ?? []}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        totalPages={data?.totalPages ?? 1}
        isLoading={isLoading}
        onPageChange={setPage}
        onSearchChange={setSearch}
        searchValue={search}
      />
    </div>
  );
}
