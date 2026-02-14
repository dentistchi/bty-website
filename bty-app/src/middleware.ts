import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminRole } from "@/lib/roles";

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

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Auth routes: always pass through (callback, reset-password, etc.) — never redirect to /admin/login
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // CORS for API only
  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
    }
    const res = NextResponse.next();
    Object.entries(corsHeaders(request)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Admin routes: allow /admin/login without auth
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const nextPath = url.pathname + url.search;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(nextPath)}`, request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: { path?: string; maxAge?: number; domain?: string; sameSite?: "lax" | "strict" | "none"; secure?: boolean }) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: { path?: string }) {
          response.cookies.set({ name, value: "", maxAge: 0, ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(nextPath)}`, request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isAdminRole(profile.role)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return response;
}

export const config = {
  runtime: "experimental-edge",
  matcher: ["/api/:path*", "/admin/:path*", "/journey/:path*"],
};
