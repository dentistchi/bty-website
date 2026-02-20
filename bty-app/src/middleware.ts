import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { forceCookieOptions, getCookieNamesFromHeader, type CookieToSet } from "@/lib/cookie-utils";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isPublicPath(pathname: string) {
  // 정적/내부/API는 통과
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  // 로그인 페이지 자체는 통과 (리다이렉트 루프 방지)
  if (pathname === "/admin/login") return true;
  if (pathname === "/bty/login") return true;

  // 홈
  if (pathname === "/") return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        // NextRequest cookies는 동기
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSet[]) {
        // ✅ forceCookieOptions()가 마지막에 강제되도록 적용
        cookies.forEach((c) => {
          res.cookies.set(c.name, c.value, forceCookieOptions(c.options));
        });
      },
    },
  });

  // ---- diag 헤더 (필요하면 유지) ----
  const cookieHeader = req.headers.get("cookie");
  const names = getCookieNamesFromHeader(cookieHeader);
  res.headers.set("x-auth-diag-cookie-header", cookieHeader ? "1" : "0");
  res.headers.set("x-auth-diag-cookie-names", names.length ? names.join(",") : "none");
  res.headers.set("x-mw-hit", "1");
  // ----------------------------------

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const login = new URL("/bty/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return res;
}

// 보호 경로만
export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
