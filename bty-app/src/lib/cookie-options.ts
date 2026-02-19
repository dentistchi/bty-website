/**
 * Cloudflare/OpenNext에서 쿠키 옵션이 '절대' 뒤에서 덮어씌워지지 않도록
 * 강제 옵션을 "마지막"에 적용한다.
 *
 * ✅ 중요:
 *   { ...options, forced }  => forced가 최종 승자
 * ❌ 금지:
 *   { forced, ...options }  => options가 forced를 다시 덮어씀 (HttpOnly=false 같은 문제)
 */
export function normalizeSupabaseCookieOptions(
  options?: Record<string, unknown>
): { path: string; sameSite: "lax"; secure: boolean; httpOnly: boolean } {
  return {
    ...(options ?? {}),
    // ✅ 우리가 강제하는 최종값(절대 뒤에서 덮이면 안 됨)
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
  } as { path: string; sameSite: "lax"; secure: boolean; httpOnly: boolean };
}
