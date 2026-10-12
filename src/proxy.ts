import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

type PublicApiRule = { methods: readonly string[] | "*"; pattern: RegExp };
export const PUBLIC_API_ALLOWLIST: readonly PublicApiRule[] = [
  { methods: "*", pattern: /^\/api\/auth(?:\/|$)/ },
  { methods: ["GET"], pattern: /^\/api\/health$/ },
  { methods: ["GET"], pattern: /^\/api\/explore(?:\/|$)/ },
  { methods: ["GET"], pattern: /^\/api\/profiles\/(?:check-username|[^/]+)$/ },
  { methods: ["GET"], pattern: /^\/api\/users\/[^/]+\/(?:followers|following)$/ },
  { methods: ["GET"], pattern: /^\/api\/posts\/[^/]+$/ },
  { methods: ["GET"], pattern: /^\/api\/post-images\/[^/]+$/ },
  { methods: ["GET"], pattern: /^\/api\/comments$/ },
  { methods: ["GET"], pattern: /^\/api\/public-decks\/[^/]+$/ },
  { methods: ["POST"], pattern: /^\/api\/trial\/generate$/ },
  { methods: ["POST", "DELETE"], pattern: /^\/api\/(?:jobs|post-images)\/cleanup$/ },
  { methods: ["POST"], pattern: /^\/api\/quiz\/[^/]+\/submit$/ },
] as const;

const PROTECTED_PAGE_PREFIXES = ["/home", "/saved", "/notifications", "/desk", "/decks", "/settings", "/trash", "/tulis", "/onboarding", "/app"] as const;
export function isPublicApiRequest(pathname: string, method: string) { return PUBLIC_API_ALLOWLIST.some(rule => rule.pattern.test(pathname) && (rule.methods === "*" || rule.methods.includes(method))); }
export function isProtectedPage(pathname: string) { return pathname === "/profile" || PROTECTED_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)); }
function safeNext(request: NextRequest) { const value = `${request.nextUrl.pathname}${request.nextUrl.search}`; return value.startsWith("/") && !value.startsWith("//") ? value : "/home"; }
function hasTrustedOrigin(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin"); if (!origin) return true;
  const trusted = new Set([request.nextUrl.origin, process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined].filter(Boolean));
  return trusted.has(origin);
}

export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(getSessionCookie(request)); const { pathname } = request.nextUrl;
  if (pathname === "/" && hasSessionCookie) return NextResponse.redirect(new URL("/home", request.url));
  if (pathname.startsWith("/api/")) {
    if (!isPublicApiRequest(pathname, request.method) && !hasSessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (!isPublicApiRequest(pathname, request.method) && !hasTrustedOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    return NextResponse.next();
  }
  if (isProtectedPage(pathname) && !hasSessionCookie) { const login = new URL("/login", request.url); login.searchParams.set("next", safeNext(request)); return NextResponse.redirect(login); }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/api/:path*", "/home/:path*", "/saved/:path*", "/notifications/:path*", "/desk/:path*", "/decks/:path*", "/settings/:path*", "/trash/:path*", "/tulis/:path*", "/onboarding/:path*", "/profile", "/app/:path*"] };
