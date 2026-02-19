import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieToSet } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api")) return true;

  if (pathname === "/admin/login") return true;
  if (pathname === "/bty/login") return true;
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
      setAll(cookies: CookieToSet[]) {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, {
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
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  res.headers.set("x-mw-hit", "1");
  return res;
}

export const config = {
  matcher: ["/train/:path*", "/bty/:path*", "/admin/:path*"],
};
