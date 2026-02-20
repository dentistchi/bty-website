import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Cloudflare/OpenNext 환경에서 쿠키 옵션이 "덮어써지지 않게" 강제한다.
 * - options(서드파티/라이브러리 제공)을 먼저 펼치고
 * - 우리가 강제할 값(path/sameSite/secure/httpOnly)을 마지막에 둔다 (최종 승자)
 */
export function applyCookieDefaults(options?: CookieOptionsWithName) {
  return {
    ...(options ?? {}),
    path: "/",         // 항상 루트
    sameSite: "lax",   // 기본은 Lax
    secure: true,      // workers.dev는 https라서 true 고정
    httpOnly: true,    // 세션 쿠키는 무조건 HttpOnly
  } as CookieOptionsWithName;
}
