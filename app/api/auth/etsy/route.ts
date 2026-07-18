import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/etsy/client";
import {
  buildStateCookie,
  generateOAuthState,
} from "@/lib/etsy/oauth";

/**
 * GET /api/auth/etsy
 * Initiates OAuth flow: generates state, sets cookie, redirects to Etsy.
 */
export async function GET() {
  const state = generateOAuthState();
  const cookie = buildStateCookie(state);

  const response = NextResponse.redirect(getAuthorizationUrl(state));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
