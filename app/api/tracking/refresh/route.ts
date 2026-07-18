import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { runRefreshTracking } from "@/lib/jobs/refresh-tracking";

/**
 * POST /api/tracking/refresh
 * Manually trigger tracking refresh. Used from /orders/[id] and /settings.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRefreshTracking();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Refresh failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
