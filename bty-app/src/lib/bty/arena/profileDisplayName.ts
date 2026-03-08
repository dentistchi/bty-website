/**
 * 프로필 표시용 display_name — 도메인 검증만. API는 이 도메인 호출 후 저장.
 */

export const DISPLAY_NAME_MAX_LENGTH = 64;

/**
 * display_name 검증: null/빈 문자열 허용(미설정), 길이 제한만.
 */
export function validateDisplayName(
  value: string | null | undefined
): { valid: boolean; sanitized: string | null; error?: string } {
  if (value === null || value === undefined) return { valid: true, sanitized: null };
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed === "") return { valid: true, sanitized: null };
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return { valid: false, sanitized: null, error: "DISPLAY_NAME_TOO_LONG" };
  }
  return { valid: true, sanitized: trimmed };
}
