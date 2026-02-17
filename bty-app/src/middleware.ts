import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const allowed =
    origin.includes("localhost") ||
    origin.endsWith(".workers.dev") ||
    origin.endsWith(".pages.dev") ||
    origin.endsWith("today-me.pages.dev") ||
    origin.endsWith("dear-me.pages.dev") ||
    origin.endsWith("bty-website.pages.dev");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : request.nextUrl.origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth routes: always pass through (callback, reset-password, etc.)
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // CORS for API only
  if (pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
    }
    const res = NextResponse.next();
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Admin login page: allow without auth
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Protected routes: /bty and /admin
  const isProtected =
    pathname === "/bty" ||
    pathname.startsWith("/bty/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (!isProtected) return NextResponse.next();

  // Supabase 세션 쿠키(sb-*-auth-token) 존재 여부만 1차 체크
  const hasAuthCookie = req.cookies.getAll().some((c) => c.name.includes("-auth-token"));

  if (!hasAuthCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/bty/:path*", "/admin/:path*"],
};
