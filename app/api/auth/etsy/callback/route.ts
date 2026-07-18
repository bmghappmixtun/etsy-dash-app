import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/lib/etsy/client";
import { getStateCookieName, getVerifierCookieName } from "@/lib/etsy/oauth";
import { authService } from "@/lib/services/auth.service";
import { usersRepository } from "@/lib/repositories/users.repository";
import { createSession } from "@/lib/session";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/etsy/callback
 * OAuth callback: exchanges code for tokens, fetches user info, stores.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent(error)}`,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?error=missing_params`,
    );
  }

  // Verify state
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(getStateCookieName());
  if (!stateCookie || stateCookie.value !== state) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`,
    );
  }

  // Read PKCE code_verifier (Etsy requires it on token exchange)
  const verifierCookie = cookieStore.get(getVerifierCookieName());
  if (!verifierCookie) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?error=missing_verifier`,
    );
  }

  try {
    // Exchange code for tokens (with PKCE verifier)
    const tokenResponse = await exchangeCodeForToken(code, verifierCookie.value);

    // Get user info from env vars (Personal Access apps don't have
    // profile_r/shops_r scope, so /users/me returns 403). For single-user
    // apps we hardcode shop_id + user_id in Vercel env.
    const shopId = env.ETSY_SHOP_ID;
    const userId = env.ETSY_USER_ID;
    const shopName = env.ETSY_SHOP_NAME || "Etsy Shop";

    if (!shopId || !userId) {
      throw new Error(
        "ETSY_SHOP_ID and ETSY_USER_ID must be set in environment variables",
      );
    }

    // Encrypt tokens
    const enc = authService.encryptTokens(
      tokenResponse.access_token,
      tokenResponse.refresh_token,
    );

    // Compute token expiry
    const tokenExpiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000,
    );

    // Upsert user (single-user: delete + create)
    // Note: Etsy doesn't return scope in token response, so use env var
    const dbUser = await usersRepository.upsert({
      etsyUserId: userId,
      shopId,
      shopName,
      accessToken: enc.accessToken,
      refreshToken: enc.refreshToken,
      tokenExpiresAt,
      scopes: env.ETSY_SCOPES,
    });

    // Set session cookie
    await createSession(dbUser.id);

    // Clear state + verifier cookies
    cookieStore.delete(getStateCookieName());
    cookieStore.delete(getVerifierCookieName());

    logger.info("OAuth login complete", {
      userId: dbUser.id,
      shopId,
      shopName,
    });

    // Redirect to dashboard
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/dashboard`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : '';
    logger.error("OAuth callback failed", {
      error: errMsg,
      stack: errStack,
    });
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed&msg=${encodeURIComponent(errMsg.slice(0, 1500))}`,
    );
  }
}
