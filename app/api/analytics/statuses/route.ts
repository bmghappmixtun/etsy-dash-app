import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ordersRepository } from "@/lib/repositories/orders.repository";
import { getSessionUser } from "@/lib/session";

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const counts = await ordersRepository.getStatusCounts({
    ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
    ...(parsed.data.endDate && { endDate: new Date(parsed.data.endDate) }),
  });
  return NextResponse.json({ counts });
}
