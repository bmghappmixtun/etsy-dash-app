"use client";

import * as React from "react";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { format } from "date-fns";
import { ArrowUpRight, Search } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./status-badge";
import { formatCurrency, daysBetween } from "@/lib/utils";
import { getCountryInfo } from "@/lib/countries";

interface OrderRow {
  id: string;
  etsyReceiptId: string;
  buyerName: string;
  country: string;
  countryName: string;
  price: string;
  currency: string;
  createdAt: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  status: OrderStatus;
  lastTrackingUpdate: string | null;
  deliveryDate: string | null;
  shippedDate: string | null;
}

interface OrdersTableProps {
  orders: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onSearchChange?: (query: string) => void;
  searchValue?: string;
}

export function OrdersTable({
  orders,
  total,
  page,
  pageSize,
  totalPages,
  isLoading,
  onPageChange,
  onSearchChange,
  searchValue = "",
}: OrdersTableProps) {
  return (
    <div className="space-y-3">
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search buyer name or tracking number..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last update</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const country = getCountryInfo(order.country);
                const deliveryDays =
                  order.shippedDate && order.deliveryDate
                    ? daysBetween(order.shippedDate, order.deliveryDate)
                    : null;
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-mono text-xs">
                        #{order.etsyReceiptId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.buyerName}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span>{country.flag}</span>
                        <span className="text-xs text-muted-foreground">
                          {order.country}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {order.trackingNumber ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-xs">
                            {order.trackingNumber.slice(0, 16)}
                            {order.trackingNumber.length > 16 ? "…" : ""}
                          </div>
                          <div className="text-xs uppercase text-muted-foreground">
                            {order.trackingCarrier ?? "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        {order.lastTrackingUpdate
                          ? format(
                              new Date(order.lastTrackingUpdate),
                              "MMM d, HH:mm",
                            )
                          : "—"}
                      </div>
                      {deliveryDays !== null && (
                        <div className="text-xs text-muted-foreground">
                          {deliveryDays}d to deliver
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(order.price, order.currency)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
