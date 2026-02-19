import type { NextRequest } from "next/server";

/**
 * Supabase SSR이 setAll()로 내려주는 cookie options를
 * Cloudflare/OpenNext에서 "절대" 덮어써지지 않게 강제한다.
 *
 * 포인트:
 * - options를 먼저 펼치고, 우리가 원하는 기본값을 마지막에 강제(override)한다.
 * - secure는 https 환경에서 true. (workers.dev는 https)
 */
export function withSupabaseCookieDefaults(
  req: NextRequest,
  options: Record<string, any> | undefined
) {
  const isHttps = req.nextUrl.protocol === "https:";

  return {
    ...(options ?? {}),

    // ✅ 여기부터는 마지막에 강제 (Supabase가 준 값이 있어도 덮어씀)
    path: "/",
    sameSite: "lax",
    secure: isHttps,
    httpOnly: true,
  } as const;
}

/**
 * NextRequest에서 들어온 쿠키들을 Supabase SSR getAll() 형식으로 변환
 */
export function getAllFromNextRequest(req: NextRequest) {
  return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
}
