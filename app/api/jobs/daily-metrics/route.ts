import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse, verifyCronRequest } from "@/lib/cron-auth";
import { runComputeDailyMetrics } from "@/lib/jobs/compute-daily-metrics";

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) return unauthorizedResponse();
  try {
    const result = await runComputeDailyMetrics();
    return NextResponse.json({ success: true, date: result.date });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
