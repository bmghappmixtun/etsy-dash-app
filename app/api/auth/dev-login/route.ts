import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { env } from "@/lib/env";

/**
 * POST /api/auth/dev-login
 * Signs in as the seed user without OAuth.
 *
 * - In development: always enabled.
 * - In production: enabled ONLY if ENABLE_DEMO_LOGIN=true is set.
 *   This is useful for demos before real Etsy credentials are configured.
 *   Set it, log in, then unset it.
 */
export async function POST() {
  const isDev = env.NODE_ENV !== "production";
  const demoEnabled = env.SEED_DATA === true; // re-using SEED_DATA flag

  if (!isDev && !demoEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.findFirst();
  if (!user) {
    return NextResponse.json(
      { error: "No user found. Run `npm run db:seed` first." },
      { status: 404 },
    );
  }

  await createSession(user.id);
  return NextResponse.json({ success: true, userId: user.id });
}
