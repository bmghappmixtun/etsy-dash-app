import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Verify the Authorization header on cron endpoints.
 * Vercel Cron sends the secret in Authorization: Bearer ${CRON_SECRET}.
 */

export function verifyCronRequest(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (env.NODE_ENV === "production") {
    return auth === expected;
  }
  // In dev, accept any non-empty bearer or skip
  return auth.startsWith("Bearer ");
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
