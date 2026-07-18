import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/etsy/client";
import {
  buildStateCookie,
  buildVerifierCookie,
  generateOAuthState,
  generatePkcePair,
} from "@/lib/etsy/oauth";

/**
 * GET /api/auth/etsy
 * Initiates OAuth flow: generates state + PKCE, sets cookies, redirects to Etsy.
 */
export async function GET() {
  const state = generateOAuthState();
  const { verifier, challenge } = generatePkcePair();

  const stateCookie = buildStateCookie(state);
  const verifierCookie = buildVerifierCookie(verifier);

  const response = NextResponse.redirect(
    getAuthorizationUrl(state, challenge),
  );
  response.cookies.set(stateCookie.name, stateCookie.value, stateCookie.options);
  response.cookies.set(verifierCookie.name, verifierCookie.value, verifierCookie.options);
  return response;
}
