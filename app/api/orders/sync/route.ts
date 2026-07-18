import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { runSyncOrders } from "@/lib/jobs/sync-orders";
import { hasRealEtsyCredentials } from "@/lib/env";

/**
 * POST /api/orders/sync
 * Manually trigger an orders sync. Used from /settings page.
 *
 * Body (optional): { days?: number } — limit sync to orders created in
 * the last N days. Defaults to full sync (first run) or 7 days
 * (incremental).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRealEtsyCredentials()) {
    return NextResponse.json(
      {
        error:
          "Etsy credentials not configured. Set ETSY_API_KEY and ETSY_SHARED_SECRET in .env.local.",
      },
      { status: 400 },
    );
  }

  let days: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.days === "number" && body.days > 0) {
      days = body.days;
    }
  } catch {
    // no body, use default
  }

  try {
    const result = await runSyncOrders({ days });
    return NextResponse.json({ success: true, days, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Sync failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
