import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const allowed =
    origin.includes("localhost") ||
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
  if (request.nextUrl.pathname.startsWith("/api/") && request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
  }

  // /admin/* protection handled by layout (getServerSession) to avoid Edge/Node
  // session mismatch and redirect loops

  const res = NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    Object.entries(corsHeaders(request)).forEach(([k, v]) =>
      res.headers.set(k, v)
    );
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
