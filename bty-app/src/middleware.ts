import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hardenCookieOptions } from "@/lib/cookie-defaults";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  // 로그인 페이지는 무조건 통과 (루프 방지)
  if (pathname === "/bty/login") return true;
  if (pathname === "/admin/login") return true;

  // 홈은 공개
  if (pathname === "/") return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  // 보호 경로에서만 실행
  const res = NextResponse.next();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: unknown }>) {
        // ✅ setAll 들어온 순간은 "무언가 쿠키를 쓰려는 상황"이므로,
        //    우리가 강제 옵션으로 최종 덮어쓰기
        for (const { name, value, options } of cookies) {
          res.cookies.set(name, value, hardenCookieOptions(options));
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // 미들웨어가 실제로 맞았는지 확인용
  res.headers.set("x-mw-hit", "1");

  if (!user) {
    const login = new URL("/bty/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return res;
}

export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
