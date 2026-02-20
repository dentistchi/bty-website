import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  if (pathname === "/admin/login") return true;
  if (pathname === "/bty/login") return true;
  if (pathname === "/bty/logout") return true;

  if (pathname === "/") return true;
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

  if (pathname === "/bty/logout") {
    const next = req.nextUrl.searchParams.get("next") || "/bty";

    const login = new URL("/bty/login", req.url);
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
