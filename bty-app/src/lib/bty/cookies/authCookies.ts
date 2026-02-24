import type { NextRequest, NextResponse } from "next/server";

export const AUTH_BASE = "sb-mveycersmqfiuddslnrj-auth-token";
export const AUTH_COOKIE_NAMES = [
  AUTH_BASE,
  `${AUTH_BASE}.0`,
  `${AUTH_BASE}.1`,
  `${AUTH_BASE}.2`,
  `${AUTH_BASE}.3`,
];

/** 요청에 있는 인증 쿠키를 응답에 Path=/ 로 다시 씀 (다른 path로 덮어쓰여지는 것 방지) */
export function reassertAuthCookiesPathRoot(req: NextRequest, res: NextResponse) {
  const all = req.cookies.getAll();
  const auth = all.filter((c) => AUTH_COOKIE_NAMES.includes(c.name));
  if (auth.length === 0) return;
  const opts = { path: "/" as const, sameSite: "lax" as const, secure: true, httpOnly: true };
  auth.forEach((c) => res.cookies.set(c.name, c.value, opts));
  res.headers.set("x-auth-reassert-count", String(auth.length));
}

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

function pickNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function pickDate(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/**
 * ✅ ALWAYS write cookies as:
 * - host-only (NO domain)
 * - Path=/
 * - SameSite=Lax, Secure, HttpOnly
 * - keep only expires/maxAge if provided
 */
export function writeSupabaseAuthCookies(res: NextResponse, cookies: SupabaseCookie[]) {
  let count = 0;

  for (const c of cookies) {
    const opts = (c.options ?? {}) as Record<string, unknown>;
    const maxAge = pickNumber(opts.maxAge);
    const expires = pickDate(opts.expires);

    res.cookies.set(c.name, String(c.value ?? ""), {
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      ...(typeof maxAge === "number" ? { maxAge } : {}),
      ...(expires ? { expires } : {}),
    });

    count += 1;
  }

  res.headers.set("x-cookie-writer", "normalized");
  res.headers.set("x-auth-set-cookie-count", String(count));
}

/**
 * ✅ HARD expire: remove BOTH host-only and domain=host variants,
 * across common legacy paths that may have been used.
 */
export function expireAuthCookiesHard(req: NextRequest, res: NextResponse) {
  const host = req.nextUrl.hostname;

  const paths = [
    "/",
    "/api",
    "/en",
    "/ko",
    "/en/bty",
    "/ko/bty",
    "/en/bty/login",
    "/ko/bty/login",
    "/en/bty-arena",
    "/ko/bty-arena",
    "/en/bty/dashboard",
    "/ko/bty/dashboard",
    "/en/bty/leaderboard",
    "/ko/bty/leaderboard",
  ];

  const expireOne = (name: string, path: string, domain?: string) => {
    res.cookies.set(name, "", {
      path,
      ...(domain ? { domain } : {}),
      expires: new Date(0),
      maxAge: 0,
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
  };

  for (const name of AUTH_COOKIE_NAMES) {
    for (const path of paths) {
      expireOne(name, path);
      expireOne(name, path, host);
    }
  }

  res.headers.set("x-auth-expire-cookie-names", AUTH_COOKIE_NAMES.join(","));
  res.headers.set("x-auth-expire-paths", paths.join(","));
}
