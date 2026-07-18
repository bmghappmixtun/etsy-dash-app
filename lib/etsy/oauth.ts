import { createHash, randomBytes } from "crypto";
import { generateToken } from "../crypto";

/**
 * OAuth state parameter: random token + HMAC signature.
 * Stored in an httpOnly cookie, verified on callback.
 *
 * Also stores PKCE code_verifier in a separate cookie (sent on token exchange).
 */

const STATE_COOKIE = "etsy_oauth_state";
const VERIFIER_COOKIE = "etsy_oauth_verifier";
const STATE_TTL_SECONDS = 600; // 10 minutes

export function generateOAuthState(): string {
  return generateToken(24);
}

/**
 * PKCE: generate a code_verifier and its S256 code_challenge.
 * code_verifier: 43-128 chars from [A-Z, a-z, 0-9, -, ., _, ~]
 * code_challenge: BASE64URL(SHA256(code_verifier))
 */
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { verifier, challenge };
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

export function buildVerifierCookie(verifier: string): {
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
    name: VERIFIER_COOKIE,
    value: verifier,
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

export function getVerifierCookieName(): string {
  return VERIFIER_COOKIE;
}
