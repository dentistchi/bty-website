/**
 * Arena Code Name 입력 — 순수 검증·정규화. 프로필 잠금(700+ 등) 없음 · XP·리더보드 무관.
 */

export const ARENA_CODE_NAME_MIN_LENGTH = 3;
export const ARENA_CODE_NAME_MAX_LENGTH = 20;

export type ArenaCodeNameParseFailureReason =
  | "LENGTH_3_TO_20"
  | "ONLY_ALNUM_DASH"
  | "NO_EDGE_DASH"
  | "NO_DOUBLE_DASH";

export type ArenaCodeNameFromUnknownResult =
  | { ok: true; value: string }
  | { ok: false; reason: ArenaCodeNameParseFailureReason };

export function arenaCodeNameFromUnknown(raw: unknown): ArenaCodeNameFromUnknownResult {
  if (typeof raw !== "string") return { ok: false, reason: "LENGTH_3_TO_20" };
  const v = raw.trim();
  if (v.length < ARENA_CODE_NAME_MIN_LENGTH || v.length > ARENA_CODE_NAME_MAX_LENGTH) {
    return { ok: false, reason: "LENGTH_3_TO_20" };
  }
  if (!/^[A-Za-z0-9-]+$/.test(v)) return { ok: false, reason: "ONLY_ALNUM_DASH" };
  if (v.startsWith("-") || v.endsWith("-")) return { ok: false, reason: "NO_EDGE_DASH" };
  if (v.includes("--")) return { ok: false, reason: "NO_DOUBLE_DASH" };
  return { ok: true, value: v };
}
