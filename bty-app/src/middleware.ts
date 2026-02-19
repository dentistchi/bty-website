import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname === "/admin/login") return true;
  if (pathname === "/bty/login") return true;
  if (pathname === "/") return true;
  return false;
}

function copySetCookie(from: NextResponse, to: NextResponse) {
  const setCookie = from.headers.get("set-cookie");
  if (setCookie) {
    to.headers.set("set-cookie", setCookie);
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const base = NextResponse.next();
  base.headers.set("x-mw-hit", "1");
  base.headers.set("x-mw-path", pathname);

  if (!url || !key) {
    base.headers.set("x-mw-env-missing", "1");
    return base;
  }

  if (isPublicPath(pathname)) {
    base.headers.set("x-mw-public", "1");
    return base;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          base.cookies.set(name, value, {
            path: "/",
            sameSite: "lax",
            secure: true,
            httpOnly: true,
            ...options,
          });
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const login = new URL("/bty/login", req.url);
    login.searchParams.set(
      "next",
      req.nextUrl.pathname + req.nextUrl.search
    );

    const redirect = NextResponse.redirect(login);
    copySetCookie(base, redirect);
    redirect.headers.set("x-mw-auth", "no");
    return redirect;
  }

  base.headers.set("x-mw-auth", "yes");
  return base;
}

export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
