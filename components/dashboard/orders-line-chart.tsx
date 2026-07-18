"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

interface DataPoint {
  date: string;
  orders: number;
  delivered: number;
}

export function OrdersLineChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-muted"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), "MMM d")}
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
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="text-xs font-medium">
                  {format(parseISO(String(label)), "MMM d, yyyy")}
                </div>
                {payload.map((p) => (
                  <div
                    key={String(p.dataKey)}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="capitalize">{String(p.dataKey)}:</span>
                    <span className="font-medium">{p.value}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="orders"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="delivered"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
