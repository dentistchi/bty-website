import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { mergeCookieOptions } from "@/lib/cookie-options";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isPublicPath(pathname: string) {
  // 정적/내부/API는 통과
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  // 로그인 페이지는 반드시 통과 (여기서 막히면 무한 리다이렉트)
  if (pathname === "/admin/login") return true;
  if (pathname === "/bty/login") return true;

  // 홈
  if (pathname === "/") return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, any> }>) {
        for (const { name, value, options } of cookies as Array<{
          name: string;
          value: string;
          options?: Record<string, any>;
        }>) {
          res.cookies.set(name, value, mergeCookieOptions(options));
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const login = new URL("/bty/login", req.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  res.headers.set("x-mw-hit", "1");
  return res;
}

export const config = {
  // 로그인 필수로 막을 경로만
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
