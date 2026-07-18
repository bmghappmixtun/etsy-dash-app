import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ordersRepository } from "@/lib/repositories/orders.repository";
import { formatCurrency, daysBetween } from "@/lib/utils";
import { getCountryInfo } from "@/lib/countries";
import { RefreshButton } from "./_components/refresh-button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await ordersRepository.findById(id);
  if (!order) notFound();

  const country = getCountryInfo(order.country);
  const totalItems = order.orderItems.reduce((acc, i) => acc + i.quantity, 0);
  const deliveryDays =
    order.shippedDate && order.deliveryDate
      ? daysBetween(order.shippedDate, order.deliveryDate)
      : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Back button */}
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to orders
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Order #{order.etsyReceiptId.toString()}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {format(order.createdAt, "MMMM d, yyyy 'at' HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {order.trackingNumber && (
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.aftership.com/track/${order.trackingCarrier ?? ""}/${order.trackingNumber}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Track on AfterShip
              </a>
            </Button>
          )}
          <RefreshButton orderId={order.id} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Customer + Shipping */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-muted p-2">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{order.buyerName}</p>
                <p className="text-sm text-muted-foreground">
                  {country.flag} {country.name} ({order.country})
                </p>
              </div>
            </div>
            {order.buyerEmail && (
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Mail className="h-4 w-4" />
                </div>
                <a
                  href={`mailto:${order.buyerEmail}`}
                  className="text-sm text-brand hover:underline"
                >
                  {order.buyerEmail}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{totalItems}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-base">
                {formatCurrency(order.price.toString(), order.currency)}
              </span>
            </div>
            <Separator />
            {order.shippedDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Shipped
                </span>
                <span className="text-xs">
                  {format(order.shippedDate, "MMM d")}
                </span>
              </div>
            )}
            {order.deliveryDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Delivered
                </span>
                <span className="text-xs">
                  {format(order.deliveryDate, "MMM d")}
                </span>
              </div>
            )}
            {deliveryDays !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Delivery time
                </span>
                <span className="text-xs font-medium">{deliveryDays} days</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.orderItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-md bg-muted p-2">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  {item.variation && (
                    <p className="text-xs text-muted-foreground">
                      {item.variation}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">×{item.quantity}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(item.price.toString(), order.currency)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tracking timeline */}
      {order.trackingEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracking timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l border-border ml-2 pl-6">
              {order.trackingEvents.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border">
                    {event.appStatus === "DELIVERED" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Circle className="h-2 w-2 fill-current text-muted-foreground" />
                    )}
                  </span>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={event.appStatus} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(event.eventDate, "MMM d, yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm">{event.description}</p>
                    {event.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
