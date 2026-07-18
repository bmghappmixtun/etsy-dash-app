import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { runSyncOrders } from "@/lib/jobs/sync-orders";
import { hasRealEtsyCredentials } from "@/lib/env";

/**
 * POST /api/orders/sync
 * Manually trigger an orders sync. Used from /settings page.
 */
export async function POST() {
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

  try {
    const result = await runSyncOrders();
    return NextResponse.json({ success: true, ...result });
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
