/**
 * Arena Sub Name 입력 — 순수 검증·정규화. tier/주간 랭킹 없음 · XP·리더보드 무관.
 */

export const ARENA_SUB_NAME_MAX_LENGTH = 7;

export type ArenaSubNameParseFailureReason = "EMPTY" | "MAX_7_CHARS" | "INVALID_CHARS";

export type ArenaSubNameFromUnknownResult =
  | { ok: true; value: string }
  | { ok: false; reason: ArenaSubNameParseFailureReason };

export function arenaSubNameFromUnknown(raw: unknown): ArenaSubNameFromUnknownResult {
  if (typeof raw !== "string") return { ok: false, reason: "EMPTY" };
  const v = raw.trim();
  if (v.length === 0) return { ok: false, reason: "EMPTY" };
  if (v.length > ARENA_SUB_NAME_MAX_LENGTH) return { ok: false, reason: "MAX_7_CHARS" };
  if (!/^[\p{L}\p{N}\s\-_]+$/u.test(v)) return { ok: false, reason: "INVALID_CHARS" };
  return { ok: true, value: v };
}
