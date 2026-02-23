import type { NextResponse } from "next/server";

/**
 * Supabase(@supabase/ssr) createServerClient의 cookies.setAll()에서 넘어오는 쿠키들을
 * Response Header에 직접 append 한다.
 *
 * ✅ 강제 정책
 * - Path=/ (절대 변경 금지)
 * - SameSite=Lax
 * - Secure=true
 * - HttpOnly=true
 *
 * NOTE:
 * - options.path 등 Supabase가 준 값은 locale path(/ko/...)로 오염될 수 있으므로 무시한다.
 */
export function appendSetCookies(
  res: NextResponse,
  cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>
) {
  const serialized: string[] = [];

  for (const c of cookies) {
    const name = c.name;
    const value = String(c.value ?? "");

    const opts = (c.options ?? {}) as Record<string, unknown>;
    const maxAge = typeof opts.maxAge === "number" ? opts.maxAge : undefined;
    const expiresRaw = opts.expires;
    const expires =
      expiresRaw instanceof Date
        ? expiresRaw
        : typeof expiresRaw === "string"
          ? new Date(expiresRaw)
          : undefined;

    let line = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Secure; HttpOnly`;

    if (typeof maxAge === "number") line += `; Max-Age=${maxAge}`;
    if (expires && !Number.isNaN(expires.getTime())) line += `; Expires=${expires.toUTCString()}`;

    serialized.push(line);
  }

  for (const line of serialized) {
    res.headers.append("Set-Cookie", line);
  }

  res.headers.set("x-cookie-writer", "login");
  res.headers.set("x-auth-set-cookie-count", String(serialized.length));
}
