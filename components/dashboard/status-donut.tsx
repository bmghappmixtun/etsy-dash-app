"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OrderStatus } from "@prisma/client";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/aftership/status-mapper";

const STATUS_CHART_COLORS: Record<OrderStatus, string> = {
  DELIVERED: "#10b981",
  IN_TRANSIT: "#3b82f6",
  EXCEPTION: "#ef4444",
  PRE_TRANSIT: "#f59e0b",
  FAILED_ATTEMPT: "#f97316",
  AVAILABLE_FOR_PICKUP: "#8b5cf6",
  UNKNOWN: "#71717a",
};

interface DataPoint {
  status: OrderStatus;
  count: number;
}

export function StatusDonut({ data }: { data: DataPoint[] }) {
  const filtered = data.filter((d) => d.count > 0);
  const total = filtered.reduce((acc, d) => acc + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={filtered}
              dataKey="count"
              nameKey="status"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              strokeWidth={0}
            >
              {filtered.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={STATUS_CHART_COLORS[entry.status]}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                const value = Number(item.value ?? 0);
                const status = (item.payload as { status: OrderStatus }).status;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="text-xs font-medium">
                      {ORDER_STATUS_LABELS[status]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {value} orders ({total > 0 ? ((value / total) * 100).toFixed(1) : "0"}%)
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {filtered.map((d) => (
          <div key={d.status} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_CHART_COLORS[d.status] }}
            />
            <span className="text-muted-foreground">
              {ORDER_STATUS_LABELS[d.status]}
            </span>
            <span className="ml-auto font-medium tabular-nums">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
