/**
 * Middleware Next.js : sécurisation iframe (CSP frame-ancestors).
 * Pages /s/* avec ?embed=1 : autoriser l’embed (frame-ancestors *).
 * Autres pages : frame-ancestors 'self' pour limiter le clickjacking.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const response = NextResponse.next();

  if (url.pathname.startsWith("/s/") && url.searchParams.get("embed") === "1") {
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
  } else {
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/s/:path*", "/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
