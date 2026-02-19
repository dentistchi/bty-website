/**
 * 로그인 후 next 파라미터 검증 → redirect loop / 오픈리다이렉트 차단
 * - next 비어있으면 /bty
 * - 외부 URL(슬래시로 시작 안 함) 무시
 * - /bty/login, /admin/login 로 돌아가는 경로 무시
 */
export function sanitizeNext(nextParam: string | null | undefined): string {
  const fallback = "/bty";
  if (!nextParam) return fallback;

  // 절대 외부로 못 나가게: 반드시 "/"로 시작
  if (!nextParam.startsWith("/")) return fallback;

  // 로그인 페이지로 되돌아가면 루프 → 차단
  if (nextParam.startsWith("/bty/login")) return fallback;
  if (nextParam.startsWith("/admin/login")) return "/admin";

  return nextParam;
}
