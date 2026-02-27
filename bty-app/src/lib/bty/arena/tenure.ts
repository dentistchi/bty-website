/**
 * BTY Arena: tenure-based level unlock utilities.
 * Level unlock is tenure-only; tier/XP do not unlock levels.
 * Uses date-fns for calendar-accurate month/day diff.
 */

import { differenceInDays, differenceInMonths } from "date-fns";

export type Track = "staff" | "leader";
/** S1–S3 staff; L1–L3 leader (tenure). L4 = partner only, admin-granted (not tenure-based). */
export type LevelId = "S1" | "S2" | "S3" | "L1" | "L2" | "L3" | "L4";
export type TenureBasis = "joinedAt" | "leaderStartedAt";

export interface UserTenureProfile {
  joinedAt: string; // ISO date string
  leaderStartedAt?: string | null; // ISO date string if applicable
  workRatio?: number; // 0..1, unused by default
}

export interface TenurePolicyConfig {
  newJoinerRule: { enabled: boolean; days: number; forcedTrack: Track };
  minTenureMonthsByLevel: Record<LevelId, number>;
  tenureBasisByLevel: Record<LevelId, TenureBasis>;
  leaderFallbackBasis: TenureBasis; // typically "joinedAt"
  applyWorkRatioWeighting?: boolean; // default false
}

export function isNewJoinerTenure(joinedAtIso: string, now: Date, days = 30): boolean {
  const joinedAt = new Date(joinedAtIso);
  return differenceInDays(now, joinedAt) < days;
}

export function getBasisDate(
  user: UserTenureProfile,
  basis: TenureBasis,
  leaderFallbackBasis: TenureBasis
): Date {
  if (basis === "leaderStartedAt") {
    const v = user.leaderStartedAt;
    if (v) return new Date(v);
    return new Date(user.joinedAt);
  }
  return new Date(user.joinedAt);
}

export function getTenureMonths(
  user: UserTenureProfile,
  basis: TenureBasis,
  cfg: TenurePolicyConfig,
  now = new Date()
): number {
  const start = getBasisDate(user, basis, cfg.leaderFallbackBasis);
  let months = differenceInMonths(now, start);
  if (months < 0) months = 0;

  if (cfg.applyWorkRatioWeighting && typeof user.workRatio === "number") {
    const ratio = Math.max(0, Math.min(1, user.workRatio));
    months = Math.floor(months * ratio);
  }
  return months;
}

/** Tenure-ordered levels only (L4 is not tenure-based; admin-granted separately). */
export const STAFF_LEVEL_ORDER: LevelId[] = ["S1", "S2", "S3"];
export const LEADER_LEVEL_ORDER: LevelId[] = ["L1", "L2", "L3", "L4"];

/** Returns the maximum unlocked level for a given track, based ONLY on tenure rules. L4 is never returned here. */
export function getMaxUnlockedLevelTenure(
  track: Track,
  user: UserTenureProfile,
  cfg: TenurePolicyConfig,
  now = new Date()
): LevelId {
  if (cfg.newJoinerRule.enabled && isNewJoinerTenure(user.joinedAt, now, cfg.newJoinerRule.days)) {
    track = cfg.newJoinerRule.forcedTrack;
  }

  const ordered: LevelId[] = track === "staff" ? STAFF_LEVEL_ORDER : ["L1", "L2", "L3"];
  let max: LevelId = ordered[0];

  for (const level of ordered) {
    const basis = cfg.tenureBasisByLevel[level];
    const tenureMonths = getTenureMonths(user, basis, cfg, now);
    if (tenureMonths >= cfg.minTenureMonthsByLevel[level]) max = level;
    else break; // no skipping
  }
  return max;
}

/** Returns next locked level for preview (e.g. "S3 unlocks in X months"). For leader, after L3 comes L4 (admin-gated). */
export function getNextLockedLevel(track: Track, maxUnlocked: LevelId): LevelId | null {
  const ordered: LevelId[] = track === "staff" ? STAFF_LEVEL_ORDER : LEADER_LEVEL_ORDER;
  const i = ordered.indexOf(maxUnlocked);
  if (i < 0 || i === ordered.length - 1) return null;
  return ordered[i + 1];
}
