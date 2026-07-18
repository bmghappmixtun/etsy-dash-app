import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { env } from "@/lib/env";

/**
 * POST /api/auth/dev-login
 * DEV ONLY: signs in as the seed user without OAuth.
 * Disabled in production.
 */
export async function POST() {
  if (env.NODE_ENV === "production") {
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
