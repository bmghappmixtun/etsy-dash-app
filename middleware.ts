import { NextRequest, NextResponse } from "next/server";

/**
 * Auth middleware.
 *
 * Single-user app: we use a session cookie set on login. This middleware
 * checks for that cookie on protected routes and redirects to /login if
 * missing. Actual decryption/validation happens in lib/session.ts.
 *
 * Public routes:
 *   /login
 *   /api/auth/* (needed for OAuth flow)
 *   /api/jobs/* (cron endpoints with their own auth)
 *   /api/health
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/etsy",
  "/api/auth/etsy/callback",
  "/api/auth/logout",
  "/api/auth/refresh-token",
  "/api/auth/dev-login",
  "/api/health",
  "/api/jobs",
  "/api/admin/backfill-etsy-flags", // one-time backfill, gated by ?token=
];

const SESSION_COOKIE = "etsy_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow static files and Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
