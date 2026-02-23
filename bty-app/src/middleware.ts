import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

const AUTH_COOKIE_BASE = "sb-mveycersmqfiuddslnrj-auth-token";
const AUTH_COOKIE_PATHS = [
  "/",
  "/api",
  "/en",
  "/ko",
  "/en/bty",
  "/ko/bty",
  "/en/bty-arena",
  "/ko/bty-arena",
];

function expireAuthCookies(res: NextResponse, host: string) {
  const names = [
    AUTH_COOKIE_BASE,
    `${AUTH_COOKIE_BASE}.0`,
    `${AUTH_COOKIE_BASE}.1`,
    `${AUTH_COOKIE_BASE}.2`,
    `${AUTH_COOKIE_BASE}.3`,
  ];
  const opts = {
    domain: host,
    expires: new Date(0),
    maxAge: 0,
    secure: true,
    httpOnly: true,
    sameSite: "lax" as const,
  };

  for (const path of AUTH_COOKIE_PATHS) {
    for (const name of names) {
      res.cookies.set(name, "", { ...opts, path });
    }
  }
  res.headers.set("x-auth-logout-cookie-names", names.join(","));
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
    expireAuthCookies(res, req.nextUrl.hostname);
    return res;
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const res = NextResponse.next();

  const hostname = req.nextUrl.hostname;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, {
            ...(options ?? {}),
            path: "/",
            domain: hostname,
            sameSite: "lax",
            secure: true,
            httpOnly: true,
          });
        });
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

  res.headers.set("x-mw-hit", "1");
  return res;
}

export const config = {
  matcher: ["/", "/en", "/en/:path*", "/ko", "/ko/:path*", "/bty/:path*", "/train/:path*", "/admin/:path*"],
};
