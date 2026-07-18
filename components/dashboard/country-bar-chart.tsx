"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCountryInfo } from "@/lib/countries";

interface DataPoint {
  country: string;
  count: number;
}

export function CountryBarChart({ data }: { data: DataPoint[] }) {
  const enriched = data.slice(0, 10).map((d) => ({
    ...d,
    name: getCountryInfo(d.country).flag,
    fullName: getCountryInfo(d.country).name,
  }));

  if (enriched.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={enriched} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="name"
          className="text-xs"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          className="text-xs"
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0].payload;
            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="text-xs font-medium">
                  {item.name} {item.fullName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.count} orders
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
