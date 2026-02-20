import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { forceCookieOptions } from "@/lib/cookie-options";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isPublicPath(pathname: string) {
  // 정적/내부/API는 통과
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  // 로그인 페이지는 통과 (루프 방지)
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
  const isHttps = req.nextUrl.protocol === "https:";

  // supabase/ssr createServerClient 쿠키 브릿지
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        // NextRequest cookies는 동기
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        // cookiesToSet 타입은 라이브러리 버전마다 달라질 수 있어 any로 받고,
        // 우리가 옵션을 마지막에 강제해서 Cloudflare/OpenNext에서도 흔들림 방지
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, forceCookieOptions(options, { isHttps }) as any);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const login = new URL("/bty/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // 디버그 헤더(원하면 유지, 아니면 제거 가능)
  res.headers.set("x-mw-hit", "1");
  return res;
}

// 로그인 필수로 막을 경로만 matcher로 지정
export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
