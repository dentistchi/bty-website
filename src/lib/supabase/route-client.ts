import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { authCookieSecureForRequest } from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Whitelist-only cookie setter: path="/" always, no domain; only expires/maxAge from options. */
export function setAuthCookie(
  res: NextResponse,
  name: string,
  value: string,
  options: Record<string, unknown> | undefined,
  secure: boolean,
) {
  const expires = options && "expires" in options ? (options as { expires?: Date }).expires : undefined;
  const maxAge = options && "maxAge" in options ? (options as { maxAge?: number }).maxAge : undefined;

  res.cookies.set(name, value, {
    path: "/",
    sameSite: "lax",
    secure,
    httpOnly: true,
    ...(expires != null ? { expires } : {}),
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  });
}

/**
 * App Router Route Handlers: `NextRequest.cookies` can miss cookies that are visible on the
 * incoming request as parsed by `cookies()` from `next/headers` (same Cookie header, different wiring).
 * Supabase SSR must see `sb-*-auth-token` here or `getUser()` returns null → 401 on `/api/*`.
 */
export function mergeCookiesForRouteHandler(
  req: NextRequest,
  headerStore: { getAll(): { name: string; value: string }[] },
): { name: string; value: string }[] {
  const merged = new Map<string, string>();
  for (const c of req.cookies.getAll()) merged.set(c.name, c.value);
  for (const c of headerStore.getAll()) merged.set(c.name, c.value);
  return [...merged.entries()].map(([name, value]) => ({ name, value }));
}

export function createSupabaseRouteClient(req: NextRequest, res: NextResponse) {
  const secure = authCookieSecureForRequest(req);
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          const names = cookiesToSet.map((c) => c.name).slice(0, 12);
          res.headers.set("x-cookie-writer", "route-client");
          res.headers.set("x-cookie-write-count", String(cookiesToSet.length));
          res.headers.set("x-cookie-write-names", names.join(","));
          res.headers.set("x-cookie-write-path", "/");
          res.headers.set("x-cookie-path-enforced", "/");
        } catch {}
        cookiesToSet.forEach(({ name, value, options }) => {
          setAuthCookie(res, name, value, options, secure);
        });
      },
    },
  });
}

/** Copy Set-Cookie from Supabase refresh (tmp/base response) onto any JSON response — fixes 401 without losing session refresh on Edge. */
export function mergeAuthCookiesFromResponse(from: NextResponse, to: NextResponse, req?: NextRequest) {
  const secure = req ? authCookieSecureForRequest(req) : true;
  const opts = { path: "/" as const, sameSite: "lax" as const, secure, httpOnly: true };
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, opts);
  }
}

export function copyCookiesAndDebug(
  from: NextResponse,
  to: NextResponse,
  req: NextRequest,
  userExists: boolean
) {
  const secure = authCookieSecureForRequest(req);
  const opts = { path: "/" as const, sameSite: "lax" as const, secure, httpOnly: true };
  to.headers.set("Cache-Control", "no-store");
  to.headers.set("x-auth-user", userExists ? "1" : "0");
  to.headers.set("x-auth-path", new URL(req.url).pathname);
  const rawCookieHeader = req.headers.get("cookie");
  to.headers.set("x-auth-cookie-header-len", String(rawCookieHeader?.length ?? 0));
  const all = req.cookies.getAll();
  to.headers.set("x-auth-cookie-count", String(all.length));
  to.headers.set("x-auth-cookie-names", all.slice(0, 8).map((c) => c.name).join(","));
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, opts);
  }
}

export async function requireUser(req: NextRequest) {
  const base = NextResponse.json({ ok: true }, { status: 200 });
  const cookieSecure = authCookieSecureForRequest(req);
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return mergeCookiesForRouteHandler(req, cookieStore);
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          const names = cookiesToSet.map((c) => c.name).slice(0, 12);
          base.headers.set("x-cookie-writer", "route-client");
          base.headers.set("x-cookie-write-count", String(cookiesToSet.length));
          base.headers.set("x-cookie-write-names", names.join(","));
          base.headers.set("x-cookie-write-path", "/");
          base.headers.set("x-cookie-path-enforced", "/");
        } catch {}
        cookiesToSet.forEach(({ name, value, options }) => {
          setAuthCookie(base, name, value, options, cookieSecure);
        });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  return { user, supabase, base, error };
}

export function unauthenticated(req: NextRequest, base: NextResponse) {
  const out = NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  copyCookiesAndDebug(base, out, req, false);
  return out;
}
