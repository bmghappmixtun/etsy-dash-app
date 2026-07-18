"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CarrierFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  carriers: { carrier: string; count: number }[];
}

export function CarrierFilter({
  value,
  onChange,
  carriers,
}: CarrierFilterProps) {
  return (
    <Select
      value={value ?? "all"}
      onValueChange={(v) => onChange(v === "all" ? undefined : v)}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="All carriers" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All carriers</SelectItem>
        {carriers.map((c) => (
          <SelectItem key={c.carrier} value={c.carrier}>
            {c.carrier.toUpperCase()} ({c.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
