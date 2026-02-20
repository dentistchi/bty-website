import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hardenCookieOptions } from "@/lib/cookie-defaults";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CookieToSetLocal = { name: string; value: string; options?: any };

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  // ✅ 로그인 페이지는 무조건 통과 (여기서 막히면 무한리다이렉트/쿠키폭증 발생)
  if (pathname === "/admin/login") return true;
  if (pathname === "/bty/login") return true;

  // 공개 홈
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
      setAll(cookies: CookieToSetLocal[]) {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, hardenCookieOptions(options));
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const login = new URL("/bty/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // 디버그용
  res.headers.set("x-mw-hit", "1");
  return res;
}

export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
