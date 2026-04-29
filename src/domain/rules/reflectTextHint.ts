/**
 * 성찰(reflect) 본문 길이 구간 → UI 힌트 i18n 키 (순수).
 */

export type ReflectTextLengthHintKey =
  | "reflect_hint_empty"
  | "reflect_hint_short"
  | "reflect_hint_developing"
  | "reflect_hint_substantial"
  | "reflect_hint_near_limit"
  | "reflect_hint_at_limit";

export function reflectTextLengthHintKey(
  charCount: number,
  maxLength: number
): ReflectTextLengthHintKey {
  const max = Math.max(1, Math.floor(maxLength));
  const n = Math.max(0, Math.floor(charCount));
  if (n === 0) return "reflect_hint_empty";
  const ratio = n / max;
  if (ratio >= 1) return "reflect_hint_at_limit";
  if (ratio >= 0.95) return "reflect_hint_near_limit";
  if (ratio >= 0.5) return "reflect_hint_substantial";
  if (ratio >= 0.15) return "reflect_hint_developing";
  return "reflect_hint_short";
}
