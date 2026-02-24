import type { NextResponse } from "next/server";

/**
 * ✅ 단일 원칙: 쿠키는 res.cookies.set()으로만 쓴다.
 * (headers.append("Set-Cookie") 금지 — Next 내부 직렬화 순서와 충돌 가능)
 */
export function applySupabaseCookies(
  res: NextResponse,
  cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>
) {
  let count = 0;

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

    res.cookies.set(name, value, {
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      ...(typeof maxAge === "number" ? { maxAge } : {}),
      ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
    });

    count += 1;
  }

  res.headers.set("x-cookie-writer", "login");
  res.headers.set("x-auth-set-cookie-count", String(count));
}
