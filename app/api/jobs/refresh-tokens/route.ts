import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse, verifyCronRequest } from "@/lib/cron-auth";
import { runRefreshTokens } from "@/lib/jobs/refresh-tokens";

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) return unauthorizedResponse();
  try {
    const result = await runRefreshTokens();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
