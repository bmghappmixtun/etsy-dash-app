"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DateRange = "7" | "30" | "90" | "all";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DateRange)}>
      <SelectTrigger className="w-[160px]">
        <Calendar className="mr-1 h-3.5 w-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
        <SelectItem value="90">Last 90 days</SelectItem>
        <SelectItem value="all">All time</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function dateRangeToDates(range: DateRange): {
  start?: Date;
  end?: Date;
} {
  if (range === "all") return {};
  const days = parseInt(range, 10);
  return {
    start: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    end: new Date(),
  };
}
