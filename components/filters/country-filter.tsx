"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CountryFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  countries: { country: string; countryName: string }[];
}

export function CountryFilter({
  value,
  onChange,
  countries,
}: CountryFilterProps) {
  return (
    <Select
      value={value ?? "all"}
      onValueChange={(v) => onChange(v === "all" ? undefined : v)}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All countries" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All countries</SelectItem>
        {countries.map((c) => (
          <SelectItem key={c.country} value={c.country}>
            {c.country} — {c.countryName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
