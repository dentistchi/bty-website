/**
 * Arena run score — 순수 정규화. API/저장소 값 검증용. XP·랭킹·시즌 무관.
 * Accepts **non-negative integers** in **`[0, ARENA_RUN_SCORE_MAX]`** from **`number`** or **`string`** (digits only, trim).
 * Non-scalars (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */

export const ARENA_RUN_SCORE_MAX = 2_147_483_647;

const MAX_BI = BigInt(ARENA_RUN_SCORE_MAX);

export function arenaRunScoreFromUnknown(raw: unknown): number | null {
  if (typeof raw === "bigint" || typeof raw === "symbol") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
    if (raw < 0 || raw > ARENA_RUN_SCORE_MAX) return null;
    return raw;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s || !/^\d+$/.test(s)) return null;
    const bi = BigInt(s);
    if (bi > MAX_BI) return null;
    return Number(bi);
  }
  return null;
}
