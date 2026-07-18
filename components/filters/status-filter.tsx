"use client";

import * as React from "react";
import type { OrderStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_LABELS } from "@/lib/aftership/status-mapper";

const STATUS_VALUES: OrderStatus[] = [
  "DELIVERED",
  "IN_TRANSIT",
  "EXCEPTION",
  "PRE_TRANSIT",
  "FAILED_ATTEMPT",
  "AVAILABLE_FOR_PICKUP",
];

interface StatusFilterProps {
  value?: OrderStatus;
  onChange: (value: OrderStatus | undefined) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <Select
      value={value ?? "all"}
      onValueChange={(v) =>
        onChange(v === "all" ? undefined : (v as OrderStatus))
      }
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {STATUS_VALUES.map((s) => (
          <SelectItem key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
