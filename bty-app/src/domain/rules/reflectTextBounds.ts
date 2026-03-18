/**
 * 성찰(reflect) 본문 길이 경계 — API·힌트(`reflectTextHint`)와 정합.
 * 상한은 `lib/bty/arena/reflectLimits`와 동일 값 유지.
 */

/** POST reflect 본문 최대 글자 수. */
export const REFLECT_USER_TEXT_MAX_CHARS = 24_000 as const;

/** 유효 제출 최소(공백 아닌 1자 이상; API는 trim 후 검증). */
export const REFLECT_USER_TEXT_MIN_CHARS = 1 as const;

/**
 * 권장 최소 글자 수 — `reflectTextLengthHintKey` developing 구간(≥ max의 15%)과 정합.
 */
export const REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS = 3600 as const;
