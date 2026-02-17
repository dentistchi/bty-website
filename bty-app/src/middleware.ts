import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ 1) 절대 건드리면 안 되는 경로들
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/assets") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2")
  ) {
    return NextResponse.next();
  }

  // ✅ 2) BTY 영역은 rewrite/locale 처리에서 완전 제외 (핵심)
  if (pathname === "/bty" || pathname.startsWith("/bty/")) {
    return NextResponse.next();
  }

  // ✅ 3) (예) locale rewrite/redirect 같은 게 있다면 여기서만 처리
  // 지금은 일단 안전하게 pass-through로 두고,
  // 네 기존 로직이 있다면 이 아래에만 두면 돼.
  return NextResponse.next();
}

// ✅ matcher도 같이 안전하게
export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
