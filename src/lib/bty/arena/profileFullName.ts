/**
 * 본명 full_name — admin 식별용 실명. display_name(공개 닉네임)과 별개.
 * 도메인 검증만. API는 이 검증 호출 후 저장. 게이트 없음(자유 편집).
 */

export const FULL_NAME_MAX_LENGTH = 120;

/**
 * full_name 검증: null/빈 문자열 허용(미설정), 길이 제한만(≤120).
 * 닉네임과 달리 코드 게이트 없음.
 */
export function validateFullName(
  value: string | null | undefined
): { valid: boolean; sanitized: string | null; error?: string } {
  if (value === null || value === undefined) return { valid: true, sanitized: null };
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed === "") return { valid: true, sanitized: null };
  if (trimmed.length > FULL_NAME_MAX_LENGTH) {
    return { valid: false, sanitized: null, error: "FULL_NAME_TOO_LONG" };
  }
  return { valid: true, sanitized: trimmed };
}
