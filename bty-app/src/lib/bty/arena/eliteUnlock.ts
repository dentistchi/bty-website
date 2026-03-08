/**
 * Elite 4차 해금 확장 (ELITE_4TH_SPECIAL_OR_UNLOCK_1PAGE §3 옵션 B).
 * elite_only 콘텐츠 접근 가능 여부 — 순수 도메인. Elite 판정은 API에서 getIsEliteTop5만 사용.
 */

/**
 * elite_only 콘텐츠 해금 조건: 콘텐츠가 elite_only이면 사용자가 Elite일 때만 접근 가능.
 * @param isElite - GET /api/me/elite 또는 getIsEliteTop5 결과
 * @param contentEliteOnly - 시나리오/에피소드 메타의 elite_only 플래그
 */
export function canAccessEliteOnlyContent(
  isElite: boolean,
  contentEliteOnly: boolean
): boolean {
  if (!contentEliteOnly) return true;
  return isElite;
}
