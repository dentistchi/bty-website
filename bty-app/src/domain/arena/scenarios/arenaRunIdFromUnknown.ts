/**
 * Arena run_id — 순수 정규화. API/저장소 값 검증용. XP·랭킹·시즌 무관.
 * Non-strings (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */

export const ARENA_RUN_ID_MAX_LENGTH = 128;

export function arenaRunIdFromUnknown(raw: unknown): string | null {
  if (typeof raw === "bigint" || typeof raw === "symbol") return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > ARENA_RUN_ID_MAX_LENGTH) return null;
  if (/\s/.test(s)) return null;
  return s;
}
