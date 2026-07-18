import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ordersRepository } from "@/lib/repositories/orders.repository";
import { getSessionUser } from "@/lib/session";
import { hasRealEtsyCredentials } from "@/lib/env";

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  country: z.string().optional(),
  status: z
    .enum([
      "DELIVERED",
      "IN_TRANSIT",
      "EXCEPTION",
      "PRE_TRANSIT",
      "FAILED_ATTEMPT",
      "AVAILABLE_FOR_PICKUP",
      "UNKNOWN",
    ])
    .optional(),
  carrier: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  sortBy: z
    .enum(["createdAt", "deliveryDate", "lastTrackingUpdate", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await ordersRepository.list({
    ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
    ...(parsed.data.endDate && { endDate: new Date(parsed.data.endDate) }),
    ...(parsed.data.country && { country: parsed.data.country }),
    ...(parsed.data.status && { status: parsed.data.status }),
    ...(parsed.data.carrier && { carrier: parsed.data.carrier }),
    ...(parsed.data.search && { search: parsed.data.search }),
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    sortBy: parsed.data.sortBy,
    sortOrder: parsed.data.sortOrder,
  });

  // Serialize BigInt as string
  const items = result.items.map((o) => ({
    ...o,
    etsyReceiptId: o.etsyReceiptId.toString(),
  }));

  return NextResponse.json({
    items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    hasEtsyCreds: hasRealEtsyCredentials(),
  });
}
