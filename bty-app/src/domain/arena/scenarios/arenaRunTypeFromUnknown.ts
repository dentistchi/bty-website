/**
 * Arena run_type — 순수 정규화. lab | mission | beginner.
 * API/저장소 값 검증·표시용. XP·랭킹·시즌 무관.
 * Non-strings (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */

export type ArenaRunType = "lab" | "mission" | "beginner";

export function arenaRunTypeFromUnknown(raw: unknown): ArenaRunType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (t === "lab" || t === "mission" || t === "beginner") return t;
  return null;
}
