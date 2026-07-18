import { generateToken } from "../crypto";

/**
 * OAuth state parameter: random token + HMAC signature.
 * Stored in an httpOnly cookie, verified on callback.
 */

const STATE_COOKIE = "etsy_oauth_state";
const STATE_TTL_SECONDS = 600; // 10 minutes

export function generateOAuthState(): string {
  return generateToken(24);
}

export function buildStateCookie(state: string): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
} {
  return {
    name: STATE_COOKIE,
    value: state,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_SECONDS,
    },
  };
}

export function getStateCookieName(): string {
  return STATE_COOKIE;
}
