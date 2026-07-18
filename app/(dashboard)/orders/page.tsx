import { Suspense } from "react";
import { OrdersClient } from "./_components/orders-client";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Browse, search and filter your Etsy orders.
        </p>
      </div>

      <Suspense>
        <OrdersClient />
      </Suspense>
    </div>
  );
}
