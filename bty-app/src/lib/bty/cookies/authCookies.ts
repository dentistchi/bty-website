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
 * ✅ HARD expire: 쿠키는 이제 Path=/ 또는 Path=/api 로만 발급되므로
 * 만료도 "/" 와 "/api" 만 사용. locale path 제거 → Set-Cookie 경고/노출 감소.
 * domain 미설정(host-only).
 */
export function expireAuthCookiesHard(_req: NextRequest, res: NextResponse) {
  const paths = ["/", "/api"];

  for (const name of AUTH_COOKIE_NAMES) {
    for (const path of paths) {
      res.cookies.set(name, "", {
        path,
        expires: new Date(0),
        maxAge: 0,
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }

  res.headers.set("x-auth-expire-cookie-names", AUTH_COOKIE_NAMES.join(","));
  res.headers.set("x-auth-expire-paths", paths.join(","));
}
