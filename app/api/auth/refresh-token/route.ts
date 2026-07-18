import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { usersRepository } from "@/lib/repositories/users.repository";
import { authService } from "@/lib/services/auth.service";
import { refreshAccessToken } from "@/lib/etsy/client";
import { hasRealEtsyCredentials } from "@/lib/env";

/**
 * POST /api/auth/refresh-token
 * Manually refresh the OAuth token. Used from /settings page.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRealEtsyCredentials()) {
    return NextResponse.json(
      { error: "Etsy credentials not configured" },
      { status: 400 },
    );
  }

  try {
    const dbUser = await usersRepository.findById(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tokens = authService.getDecryptedTokens(dbUser);
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    await authService.saveTokens(
      dbUser.id,
      refreshed.access_token,
      refreshed.refresh_token,
      expiresAt,
    );

    return NextResponse.json({ success: true, expiresAt });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Token refresh failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
