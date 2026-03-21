/**
 * Arena reflect `levelId` — 순수 정규화. S1…L4만 허용. XP·주간 랭킹·시즌 무관.
 */

export const ARENA_REFLECT_LEVEL_IDS = ["S1", "S2", "S3", "L1", "L2", "L3", "L4"] as const;

export type ArenaReflectLevelId = (typeof ARENA_REFLECT_LEVEL_IDS)[number];

export function arenaReflectLevelIdFromUnknown(raw: unknown): ArenaReflectLevelId | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  return (ARENA_REFLECT_LEVEL_IDS as readonly string[]).includes(s)
    ? (s as ArenaReflectLevelId)
    : null;
}
