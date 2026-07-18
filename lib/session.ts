import { cookies } from "next/headers";
import { env } from "./env";
import { sign, verify } from "./crypto";
import { prisma } from "./db";

/**
 * Session management.
 *
 * Single-user app: when the user logs in via OAuth, we set a signed cookie
 * containing the userId. No DB session table needed — invalidating a session
 * means clearing the cookie.
 *
 * Cookie format: `${userId}.${hmacSignature}` base64url-encoded
 */

const COOKIE_NAME = "etsy_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function encode(userId: string): string {
  const sig = sign(userId);
  return `${userId}.${sig}`;
}

function decode(value: string): string | null {
  const idx = value.lastIndexOf(".");
  if (idx === -1) return null;
  const userId = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  if (!verify(userId, sig)) return null;
  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encode(userId), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME);
  if (!cookie) return null;

  const userId = decode(cookie.value);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      etsyUserId: true,
      shopId: true,
      shopName: true,
      tokenExpiresAt: true,
    },
  });

  return user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
