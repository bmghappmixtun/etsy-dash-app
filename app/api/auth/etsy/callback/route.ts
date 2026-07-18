import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  getMe,
  getShop,
} from "@/lib/etsy/client";
import { getStateCookieName } from "@/lib/etsy/oauth";
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

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(code);

    // Get user info
    const user = await getMe(tokenResponse.access_token);

    // Get shop info — Etsy user may have multiple shops, get the first one
    // For single-shop, we need the active shop. v3 doesn't have a "primary
    // shop" concept, so we list and pick. The receipt endpoint requires
    // explicit shop_id, so we use /users/me first to find shops.
    //
    // Simpler: try to fetch listings to discover shop. Or use the OAuth
    // scope "profile_r" to get a "primary_shop_id" field. v3 users/me
    // response has been expanded to include shop info on some endpoints.
    //
    // For now, fetch the user and use the first transaction. We'll search
    // listings to find the shop_id.

    // Get shop_id via /users/me with includes
    const meWithShop = await fetch(
      "https://api.etsy.com/v3/application/users/me?includes=Shops",
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
          "x-api-key": env.ETSY_API_KEY,
        },
        cache: "no-store",
      },
    );

    let shopId = "";
    let shopName = "";
    if (meWithShop.ok) {
      const meData = (await meWithShop.json()) as { shops?: { shop_id: number; shop_name: string }[] };
      if (meData.shops && meData.shops.length > 0) {
        shopId = String(meData.shops[0].shop_id);
        shopName = meData.shops[0].shop_name;
      }
    }

    if (!shopId) {
      // Fallback: try to find a shop via listings search
      const listingsRes = await fetch(
        `https://api.etsy.com/v3/application/shops?user_id=${user.user_id}`,
        {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
            "x-api-key": env.ETSY_API_KEY,
          },
          cache: "no-store",
        },
      );
      if (listingsRes.ok) {
        const data = (await listingsRes.json()) as {
          results?: { shop_id: number; shop_name: string }[];
        };
        if (data.results && data.results.length > 0) {
          shopId = String(data.results[0].shop_id);
          shopName = data.results[0].shop_name;
        }
      }
    }

    if (!shopId) {
      throw new Error("Could not determine shop_id from Etsy account");
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
    const dbUser = await usersRepository.upsert({
      etsyUserId: String(user.user_id),
      shopId,
      shopName,
      accessToken: enc.accessToken,
      refreshToken: enc.refreshToken,
      tokenExpiresAt,
      scopes: tokenResponse.scope,
    });

    // Set session cookie
    await createSession(dbUser.id);

    // Clear state cookie
    cookieStore.delete(getStateCookieName());

    logger.info("OAuth login complete", {
      userId: dbUser.id,
      shopId,
      shopName,
    });

    // Redirect to dashboard
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/dashboard`);
  } catch (err) {
    logger.error("OAuth callback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed`,
    );
  }
}
