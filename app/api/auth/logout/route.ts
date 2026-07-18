import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/**
 * POST /api/auth/logout
 * Destroys session and redirects to /login.
 */
export async function POST() {
  await destroySession();
  return NextResponse.json({ success: true });
}
