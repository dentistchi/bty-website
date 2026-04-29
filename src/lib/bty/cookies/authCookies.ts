import type { NextRequest, NextResponse } from "next/server";

/**
 * # Auth cookie 정책 (BTY / Supabase SSR)
 *
 * - **발급**: 모든 인증 쿠키는 반드시 Path=/, domain 미설정(host-only).
 *   Supabase options.path/domain 은 무시하고, maxAge/expires 만 허용.
 * - **Secure**: HTTPS 또는 x-forwarded-proto=https 일 때만 `secure: true`.
 *   로컬 HTTP(E2E `http://127.0.0.1`)에서는 `secure: false` — 그렇지 않으면 브라우저가 Set-Cookie 를 버려 세션이 안 잡힘.
 * - **만료**: 로그인 직전·로그아웃·세션 POST 시에만 expireAuthCookiesHard 호출.
 * - **보호된 페이지**: reassertAuthCookiesPathRoot 로 Path=/ 재설정.
 */

export const AUTH_BASE = "sb-mveycersmqfiuddslnrj-auth-token";
export const AUTH_COOKIE_NAMES = [
  AUTH_BASE,
  `${AUTH_BASE}.0`,
  `${AUTH_BASE}.1`,
  `${AUTH_BASE}.2`,
  `${AUTH_BASE}.3`,
] as const;

/**
 * Use the same flag for set / expire / reassert on this request (HTTP dev vs HTTPS prod).
 */
export function authCookieSecureForRequest(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  return req.nextUrl.protocol === "https:";
}

type CookieWriteOpts = { secure: boolean };

/** 요청에 있는 인증 쿠키를 응답에 Path=/ 로 다시 씀 (다른 path로 덮어쓰여지는 것 방지) */
export function reassertAuthCookiesPathRoot(req: NextRequest, res: NextResponse, opts?: CookieWriteOpts) {
  const secure = opts?.secure ?? authCookieSecureForRequest(req);
  const all = req.cookies.getAll();
  const known = AUTH_COOKIE_NAMES as readonly string[];
  const auth = all.filter((c) => known.includes(c.name));
  if (auth.length === 0) return;
  const cookieOpts = { path: "/" as const, sameSite: "lax" as const, secure, httpOnly: true };
  auth.forEach((c) => res.cookies.set(c.name, c.value, cookieOpts));
  res.headers.set("x-auth-reassert-count", String(auth.length));
  res.headers.set("x-auth-cookie-secure", secure ? "1" : "0");
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
 * Write Supabase SSR auth cookies. Pass `secure` from {@link authCookieSecureForRequest} for HTTP local dev.
 */
export function writeSupabaseAuthCookies(res: NextResponse, cookies: SupabaseCookie[], opts?: CookieWriteOpts) {
  const secure = opts?.secure ?? true;
  let count = 0;

  for (const c of cookies) {
    const o = (c.options ?? {}) as Record<string, unknown>;
    const maxAge = pickNumber(o.maxAge);
    const expires = pickDate(o.expires);

    res.cookies.set(c.name, String(c.value ?? ""), {
      path: "/",
      sameSite: "lax",
      secure,
      httpOnly: true,
      ...(typeof maxAge === "number" ? { maxAge } : {}),
      ...(expires ? { expires } : {}),
    });

    count += 1;
  }

  res.headers.set("x-cookie-writer", "normalized");
  res.headers.set("x-auth-set-cookie-count", String(count));
  res.headers.set("x-auth-cookie-secure", secure ? "1" : "0");
}

/**
 * HARD expire: Path=/ 및 /api. `secure` must match how cookies were issued.
 */
export function expireAuthCookiesHard(req: NextRequest, res: NextResponse, opts?: CookieWriteOpts) {
  const secure = opts?.secure ?? authCookieSecureForRequest(req);
  const paths = ["/", "/api"];

  for (const name of AUTH_COOKIE_NAMES) {
    for (const path of paths) {
      res.cookies.set(name, "", {
        path,
        expires: new Date(0),
        maxAge: 0,
        secure,
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }

  res.headers.set("x-auth-expire-cookie-names", AUTH_COOKIE_NAMES.join(","));
  res.headers.set("x-auth-expire-paths", paths.join(","));
  res.headers.set("x-auth-cookie-secure", secure ? "1" : "0");
}
