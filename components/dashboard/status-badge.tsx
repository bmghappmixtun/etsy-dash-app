import type { OrderStatus } from "@prisma/client";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from "@/lib/aftership/status-mapper";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        ORDER_STATUS_COLORS[status],
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
