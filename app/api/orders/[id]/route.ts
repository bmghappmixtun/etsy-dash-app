import { NextRequest, NextResponse } from "next/server";
import { ordersRepository } from "@/lib/repositories/orders.repository";
import { getSessionUser } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await ordersRepository.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...order,
    etsyReceiptId: order.etsyReceiptId.toString(),
    orderItems: order.orderItems.map((i) => ({
      ...i,
      etsyListingId: i.etsyListingId.toString(),
    })),
  });
}
