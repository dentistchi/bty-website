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
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api")) return false;
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

function expireAuthCookies(res: NextResponse, host: string) {
  const base = "sb-mveycersmqfiuddslnrj-auth-token";
  const names = [base, `${base}.0`, `${base}.1`, `${base}.2`, `${base}.3`];

  for (const name of names) {
    res.cookies.set(name, "", {
      path: "/",
      domain: host,
      expires: new Date(0),
      maxAge: 0,
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
    res.cookies.set(name, "", {
      path: "/api",
      domain: host,
      expires: new Date(0),
      maxAge: 0,
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
  }
  res.headers.set("x-auth-logout-cookie-names", names.join(","));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/en", req.url), 307);
  }

  // API routes: run Supabase cookie refresh only (no redirect; APIs return 401 JSON)
  if (pathname.startsWith("/api")) {
    const res = NextResponse.next();
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
              sameSite: "lax",
              secure: true,
              httpOnly: true,
            });
          });
        },
      },
    });
    await supabase.auth.getUser();
    res.headers.set("x-mw-hit", "1");
    return res;
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

  res.headers.set("x-mw-hit", "1");
  res.headers.set("x-mw-user", user ? "1" : "0");
  res.headers.set("x-mw-path", pathname);

  if (!user) {
    const login = new URL(`/${locale}/bty/login`, req.url);
    login.searchParams.set("next", pathname + req.nextUrl.search);
    const redirectRes = NextResponse.redirect(login, 303);
    redirectRes.headers.set("Cache-Control", "no-store");
    redirectRes.headers.set("x-mw-hit", "1");
    redirectRes.headers.set("x-mw-user", "0");
    redirectRes.headers.set("x-mw-path", pathname);
    for (const c of res.cookies.getAll()) {
      redirectRes.cookies.set(c.name, c.value, { path: "/", sameSite: "lax", secure: true, httpOnly: true });
    }
    return redirectRes;
  }

  return res;
}

export const config = {
  matcher: ["/", "/en", "/en/:path*", "/ko", "/ko/:path*", "/bty/:path*", "/train/:path*", "/admin/:path*", "/api/:path*"],
};
