import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rate limiting store (in-memory, resets on restart).
 * For production, replace with Redis or similar.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 req/min per IP
const RATE_LIMIT_API_MAX = 30; // 30 req/min for /api/v1/*

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > max;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // --- Rate Limiting ---
  const isApiV1 = pathname.startsWith("/api/v1");
  const limitKey = isApiV1 ? `api:${ip}` : `page:${ip}`;
  const maxReqs = isApiV1 ? RATE_LIMIT_API_MAX : RATE_LIMIT_MAX_REQUESTS;

  if (isRateLimited(limitKey, maxReqs)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // --- Auth redirects (merged from proxy.ts) ---
  const hasSession =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("hitlaas_token")?.value;

  if (pathname.startsWith("/dashboard")) {
    if (!hasSession) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/auth/")) {
    if (hasSession && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // --- CORS for API routes ---
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = [
      process.env.NEXTAUTH_URL || "http://localhost:3000",
      "https://hitlaas.vercel.app",
      "https://provider.hitlaas.thomasansems.nl",
    ];

    if (allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
    response.headers.set("Access-Control-Max-Age", "86400");

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }

    // --- Request size guard (reject >1MB bodies) ---
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
      return NextResponse.json(
        { error: "Request body too large (max 1MB)" },
        { status: 413 }
      );
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes and pages, skip static assets
    "/((?!_next/static|_next/image|favicon.ico|images/).*)",
  ],
};
