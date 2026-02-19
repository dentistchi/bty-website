import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { normalizeSupabaseCookieOptions } from "@/lib/cookie-options";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CookieToSet = { name: string; value: string; options?: Record<string, any> };

function isPublicPath(pathname: string) {
  // 정적/내부/헬스/API는 통과
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  // 로그인 페이지는 무조건 통과(리다이렉트 루프 방지)
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
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: CookieToSet[]) {
        if (!cookies?.length) return;
        for (const { name, value, options } of cookies) {
          res.cookies.set(name, value, normalizeSupabaseCookieOptions(options as any));
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const login = new URL("/bty/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  res.headers.set("x-mw-hit", "1");
  return res;
}

export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
