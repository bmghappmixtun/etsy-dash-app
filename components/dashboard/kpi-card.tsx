import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {hint && (
              <p className="text-xs text-muted-foreground">{hint}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "text-xs",
                  trend.value > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : trend.value < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                )}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value}% {trend.label}
              </p>
            )}
          </div>
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
