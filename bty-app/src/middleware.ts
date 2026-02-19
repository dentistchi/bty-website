import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAllFromNextRequest, withSupabaseCookieDefaults } from "@/lib/supabase-cookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// /bty/login, /bty/login/ 등 변형에도 무조건 통과 → redirect loop 방지
function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  if (pathname.startsWith("/admin/login")) return true;
  if (pathname.startsWith("/bty/login")) return true;

  if (pathname === "/") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  // matcher로 들어온 요청만 여기 도착
  const res = NextResponse.next();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return getAllFromNextRequest(req);
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, any> }>) {
        for (const { name, value, options } of cookies) {
          // ✅ 절대 덮어써지지 않는 기본값
          res.cookies.set(name, value, withSupabaseCookieDefaults(req, options));
        }
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

  res.headers.set("x-mw-hit", "1");
  return res;
}

export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
