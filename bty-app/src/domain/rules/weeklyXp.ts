/**
 * Weekly XP competition rules (pure).
 * Level, tier, awardXp, season reset, leaderboard sort for weekly ranking.
 *
 * Invariants:
 * - Core XP is permanent, never reset.
 * - Weekly XP resets at season boundary; used for weekly ranking only.
 * - Leaderboard ranked by weekly XP only; season progression does not affect rank.
 */

import { seasonalToCoreConversion } from "./xp";

// --- Types -------------------------------------------------------------------

export type WeeklyTierName = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface AwardXpInput {
  coreXp: number;
  weeklyXp: number;
  /** Seasonal (weekly) XP earned this activity. Applied to weekly; portion converts to core. */
  earnedSeasonalXp: number;
}

export interface AwardXpResult {
  newCoreXp: number;
  newWeeklyXp: number;
}

export interface LevelTierProgress {
  level: number;
  tier: WeeklyTierName;
  /** 0–99, progress within current level (xpTotal % 100). */
  progressInLevel: number;
  /** 0–1, for progress bar. */
  progressPct: number;
}

export interface SeasonResetInput {
  coreXp: number;
  weeklyXp: number;
}

export interface SeasonResetResult {
  coreXp: number;
  weeklyXp: number;
}

export interface LeaderboardEntry {
  userId: string;
  xpTotal: number;
  [k: string]: unknown;
}

// --- Constants (주간 레벨 경계·week_id는 API/서비스에서 관리) ---

/** 1 레벨당 XP. level = floor(xpTotal / WEEKLY_LEVEL_STEP) + 1. Tier 경계 0/100/200/300. */
export const WEEKLY_LEVEL_STEP = 100;

// --- awardXp -----------------------------------------------------------------

/**
 * Apply earned seasonal XP to both weekly (competition) and core (growth).
 * Weekly gets full earned amount; core gets conversion via domain rule
 * (45:1 if core < 200, else 60:1).
 */
export function awardXp(input: AwardXpInput): AwardXpResult {
  const { coreXp, weeklyXp, earnedSeasonalXp } = input;
  const safeEarned = Math.max(0, Math.floor(earnedSeasonalXp));
  const safeCore = Math.max(0, Math.floor(coreXp));
  const safeWeekly = Math.max(0, Math.floor(weeklyXp));

  const { coreGain } = seasonalToCoreConversion(safeEarned, safeCore);

  return {
    newCoreXp: safeCore + coreGain,
    newWeeklyXp: safeWeekly + safeEarned,
  };
}

// --- calculateLevel ----------------------------------------------------------

/** Level from weekly XP. level = floor(xpTotal / 100) + 1. */
export function calculateLevel(weeklyXpTotal: number): number {
  const safe = Math.max(0, Math.floor(weeklyXpTotal));
  return Math.floor(safe / WEEKLY_LEVEL_STEP) + 1;
}

// --- calculateTier -----------------------------------------------------------

/** Competition tier name from weekly XP. 0–99 Bronze, 100–199 Silver, 200–299 Gold, 300+ Platinum. */
export function calculateTier(weeklyXpTotal: number): WeeklyTierName {
  const safe = Math.max(0, Math.floor(weeklyXpTotal));
  if (safe >= 300) return "Platinum";
  if (safe >= 200) return "Gold";
  if (safe >= 100) return "Silver";
  return "Bronze";
}

// --- calculateLevelTierProgress ----------------------------------------------

/** Level, tier, and progress from weekly XP (for UI display). */
export function calculateLevelTierProgress(weeklyXpTotal: number): LevelTierProgress {
  const safe = Math.max(0, Math.floor(weeklyXpTotal));
  const level = calculateLevel(safe);
  const tier = calculateTier(safe);
  const progressInLevel = safe % WEEKLY_LEVEL_STEP;
  const progressPct = progressInLevel / WEEKLY_LEVEL_STEP;
  return { level, tier, progressInLevel, progressPct };
}

// --- seasonReset -------------------------------------------------------------

/** Season reset: weekly XP goes to 0; core XP unchanged. Returns new state only. */
export function seasonReset(input: SeasonResetInput): SeasonResetResult {
  return {
    coreXp: Math.max(0, Math.floor(input.coreXp)),
    weeklyXp: 0,
  };
}

// --- leaderboardSort ---------------------------------------------------------

/**
 * Sort leaderboard by weekly XP descending. No season/league in sort key.
 * Returns new array; does not mutate.
 *
 * Uses `xpTotal` field (service convention). For domain-level ranking with
 * `weeklyXp` field and 1-based rank, use `rankByWeeklyXpOnly` from ./leaderboard.
 */
export function leaderboardSort<T extends LeaderboardEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (b.xpTotal ?? 0) - (a.xpTotal ?? 0));
}
