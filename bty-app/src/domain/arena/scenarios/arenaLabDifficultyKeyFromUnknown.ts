/**
 * Leadership Lab difficulty 키 — 순수 정규화. 허용: easy | mid | hard | extreme · 그 외·비문자 → `mid`.
 * Core XP 배수는 `lib/bty/arena/arenaLabXp` `computeLabCoreXp` 단일 기준.
 */

export type ArenaLabDifficultyKey = "easy" | "mid" | "hard" | "extreme";

const KEYS: readonly ArenaLabDifficultyKey[] = ["easy", "mid", "hard", "extreme"];

export function arenaLabDifficultyKeyFromUnknown(raw: unknown): ArenaLabDifficultyKey {
  if (typeof raw === "string" && (KEYS as readonly string[]).includes(raw)) {
    return raw as ArenaLabDifficultyKey;
  }
  return "mid";
}

/**
 * Strict parse for optional API fields — unknown·비허용 문자열·trim 불일치 → **`null`** (lenient **`arenaLabDifficultyKeyFromUnknown`** 는 **`mid`**).
 * Non-strings (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */
export function arenaLabDifficultyKeyStrictFromUnknown(raw: unknown): ArenaLabDifficultyKey | null {
  if (typeof raw === "bigint" || typeof raw === "symbol") return null;
  if (typeof raw !== "string") return null;
  if ((KEYS as readonly string[]).includes(raw)) return raw as ArenaLabDifficultyKey;
  return null;
}
