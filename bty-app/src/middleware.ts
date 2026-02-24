import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { expireAuthCookiesHard, reassertAuthCookiesPathRoot } from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const LOCALES = ["en", "ko"] as const;

function getLocale(pathname: string): (typeof LOCALES)[number] | null {
  if (pathname.startsWith("/en") || pathname === "/en") return "en";
  if (pathname.startsWith("/ko") || pathname === "/ko") return "ko";
  return null;
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname === "/") return true;

  const locale = getLocale(pathname);
  if (locale) {
    if (pathname === `/${locale}` || pathname === `/${locale}/`) return true;
    if (pathname === `/${locale}/admin/login`) return true;
    if (pathname === `/${locale}/bty/login`) return true;
    if (pathname === `/${locale}/bty/logout`) return true;
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/en", req.url), 307);
  }

  const locale = getLocale(pathname);
  if (!locale) {
    if (pathname.startsWith("/bty") || pathname.startsWith("/train") || pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL(`/en${pathname}`, req.url), 307);
    }
    return NextResponse.next();
  }

  if (pathname === `/${locale}/bty/logout`) {
    const next = req.nextUrl.searchParams.get("next") || `/${locale}/bty`;
    const login = new URL(`/${locale}/bty/login`, req.url);
    login.searchParams.set("next", next);

    const res = NextResponse.redirect(login, 303);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Clear-Site-Data", '"cookies"');
    res.headers.set("x-mw-hit", "1");

    expireAuthCookiesHard(req, res);
    return res;
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        for (const { name, value, options } of cookies) {
          const o = (options ?? {}) as Record<string, unknown>;
          const maxAge = typeof o.maxAge === "number" ? o.maxAge : undefined;
          const expiresRaw = o.expires;
          const expires =
            expiresRaw instanceof Date
              ? expiresRaw
              : typeof expiresRaw === "string"
                ? new Date(expiresRaw)
                : undefined;

          res.cookies.set(name, value, {
            path: "/",
            sameSite: "lax",
            secure: true,
            httpOnly: true,
            ...(typeof maxAge === "number" ? { maxAge } : {}),
            ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
          });
        }

        res.headers.set("x-cookie-writer", "middleware");
        res.headers.set("x-auth-set-cookie-count", String(cookies.length));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const login = new URL(`/${locale}/bty/login`, req.url);
    login.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // 요청에 있는 인증 쿠키를 Path=/ 로 다시 설정 (다른 path로 덮어쓰여진 것 복구)
  reassertAuthCookiesPathRoot(req, res);
  res.headers.set("x-mw-hit", "1");
  res.headers.set("x-mw-user", "1");
  res.headers.set("x-mw-path", pathname);
  return res;
}

export const config = {
  matcher: ["/", "/en", "/en/:path*", "/ko", "/ko/:path*", "/bty/:path*", "/train/:path*", "/admin/:path*"],
};
