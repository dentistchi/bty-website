/**
 * Program level ordering vs max unlocked level (staff/leader tenure tracks).
 * Weekly/season ranking is unrelated — display/unlock slice only.
 */

export const ARENA_STAFF_LEVEL_ORDER = ["S1", "S2", "S3"] as const;
export const ARENA_LEADER_LEVEL_ORDER = ["L1", "L2", "L3", "L4"] as const;

export type ArenaTenureTrackKind = "staff" | "leader";

export function arenaTrackLevelOrdering(track: ArenaTenureTrackKind): readonly string[] {
  return track === "staff" ? ARENA_STAFF_LEVEL_ORDER : ARENA_LEADER_LEVEL_ORDER;
}

/**
 * True when `levelId` is at or before `maxUnlockedLevel` in `ordering`.
 * Unknown `maxUnlockedLevel` or unknown `levelId` → false.
 */
export function isArenaProgramLevelUnlockedByMax(
  levelId: string,
  maxUnlockedLevel: string,
  ordering: readonly string[],
): boolean {
  const maxIdx = ordering.indexOf(maxUnlockedLevel);
  if (maxIdx < 0) return false;
  const i = ordering.indexOf(levelId);
  return i >= 0 && i <= maxIdx;
}
