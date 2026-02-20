import type { CookieOptions } from "@supabase/ssr";

/**
 * Cloudflare/OpenNext에서 "절대 덮어쓰이지" 않게:
 * - options를 먼저 펼치고
 * - 우리가 강제할 값들을 마지막에 덮어쓴다 (핵심)
 */
export function hardenCookieOptions(options?: CookieOptions): CookieOptions {
  return {
    ...(options ?? {}),
    path: "/", // 항상 루트
    sameSite: "lax", // 항상 Lax
    secure: true, // 항상 HTTPS
    httpOnly: true, // 항상 HttpOnly (JS에서 못 읽게)
  };
}
