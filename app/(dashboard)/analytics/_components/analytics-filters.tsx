"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AnalyticsFilters({
  currentRange,
}: {
  currentRange?: "7" | "30" | "90" | "365";
}) {
  const router = useRouter();

  const onChange = (value: string) => {
    const params = new URLSearchParams();
    if (value !== "90") params.set("range", value);
    router.push(`/analytics${params.toString() ? "?" + params.toString() : ""}`);
  };

  return (
    <Select
      value={currentRange ?? "90"}
      onValueChange={onChange}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
        <SelectItem value="90">Last 90 days</SelectItem>
        <SelectItem value="365">Last 365 days</SelectItem>
      </SelectContent>
    </Select>
  );
}
