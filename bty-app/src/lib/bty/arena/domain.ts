/**
 * BTY Arena — pure business logic only.
 * No framework, no DB, no HTTP. Single source of truth for XP, level, tier, season reset, leaderboard sort.
 *
 * Rules (do not violate):
 * - Core XP: permanent, accumulative. Never reset.
 * - Weekly XP: resets at season boundary; used for weekly ranking only.
 * - Leaderboard: ranked by weekly XP only. Season progression does not affect rank.
 */

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

// --- Constants (from spec) ---------------------------------------------------

const WEEKLY_LEVEL_STEP = 100;
const CORE_RATE_UNDER_200 = 45;
const CORE_RATE_200_PLUS = 60;

// --- awardXp -----------------------------------------------------------------

/**
 * Apply earned seasonal XP to both weekly (competition) and core (growth).
 * Weekly gets full earned amount; core gets conversion (45:1 if core < 200, else 60:1).
 * Pure: no side effects, no persistence.
 */
export function awardXp(input: AwardXpInput): AwardXpResult {
  const { coreXp, weeklyXp, earnedSeasonalXp } = input;
  const safeEarned = Math.max(0, Math.floor(earnedSeasonalXp));
  const safeCore = Math.max(0, Math.floor(coreXp));
  const safeWeekly = Math.max(0, Math.floor(weeklyXp));

  const rate = safeCore < 200 ? CORE_RATE_UNDER_200 : CORE_RATE_200_PLUS;
  const coreGain = Math.floor(safeEarned / rate);

  return {
    newCoreXp: safeCore + coreGain,
    newWeeklyXp: safeWeekly + safeEarned,
  };
}

// --- calculateLevel (weekly XP) -----------------------------------------------

/**
 * Level from weekly XP. Spec: level = floor(xpTotal / 100) + 1.
 */
export function calculateLevel(weeklyXpTotal: number): number {
  const safe = Math.max(0, Math.floor(weeklyXpTotal));
  return Math.floor(safe / WEEKLY_LEVEL_STEP) + 1;
}

// --- calculateTier (weekly XP → display tier) --------------------------------

/**
 * Competition tier name from weekly XP. Spec: 0–99 Bronze, 100–199 Silver, 200–299 Gold, 300+ Platinum.
 */
export function calculateTier(weeklyXpTotal: number): WeeklyTierName {
  const safe = Math.max(0, Math.floor(weeklyXpTotal));
  if (safe >= 300) return "Platinum";
  if (safe >= 200) return "Gold";
  if (safe >= 100) return "Silver";
  return "Bronze";
}

/**
 * Level, tier, and progress from weekly XP (for UI). Single source for weekly competition display.
 */
export function calculateLevelTierProgress(weeklyXpTotal: number): LevelTierProgress {
  const safe = Math.max(0, Math.floor(weeklyXpTotal));
  const level = calculateLevel(safe);
  const tier = calculateTier(safe);
  const progressInLevel = safe % WEEKLY_LEVEL_STEP;
  const progressPct = progressInLevel / WEEKLY_LEVEL_STEP;
  return { level, tier, progressInLevel, progressPct };
}

// --- seasonReset -------------------------------------------------------------

/**
 * Season reset: weekly XP goes to 0; core XP unchanged.
 * Caller persists. Pure: returns new state only.
 */
export function seasonReset(input: SeasonResetInput): SeasonResetResult {
  return {
    coreXp: Math.max(0, Math.floor(input.coreXp)),
    weeklyXp: 0,
  };
}

// --- leaderboardSort ---------------------------------------------------------

/**
 * Sort leaderboard by weekly XP descending. No season/league in sort key — ranking by weekly XP only.
 * Returns new array; does not mutate.
 */
export function leaderboardSort<T extends LeaderboardEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (b.xpTotal ?? 0) - (a.xpTotal ?? 0));
}
