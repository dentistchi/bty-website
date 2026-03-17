/**
 * Weekly XP competition rules (pure).
 * Level, tier, awardXp, leaderboard sort for weekly ranking.
 *
 * Invariants:
 * - Core XP is permanent, never reset.
 * - **Weekly** XP for leaderboard resets at the **weekly** boundary (`week_id` / storage); not derived from season calendar alone.
 * - Leaderboard ranked by weekly XP only; season progression does not affect rank.
 *
 * **Season** calendar = `rules/season` (SeasonWindow, carryover). **Within-week level/tier** = `WEEKLY_LEVEL_STEP` (100).
 * @see season — season window (startDate–endDate) is independent of weekly leaderboard reset.
 * `seasonReset` is a pure helper for **season-transition** flows that zero the weekly competition counter without touching core;
 * orchestration decides when to call it; it does not replace per-week ledger resets.
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

/**
 * **주간 랭킹 경계:** 저장소의 `week_id`(또는 동일 의미 키)가 바뀌면 해당 주간 XP 합계는 새 행에만 누적;
 * 이전 주 총합은 그 주 리더보드 정렬에만 쓰임. 도메인 함수는 “현재 주간 총XP” 스칼라만 받음.
 * 주 내 표시용 레벨/티어 경계는 아래 `WEEKLY_LEVEL_STEP`만 사용 (시즌 달력과 무관).
 */
/** 1 레벨당 XP. level = floor(xpTotal / WEEKLY_LEVEL_STEP) + 1. Tier 경계 0/100/200/300. */
export const WEEKLY_LEVEL_STEP = 100;

/** Weekly tier lower bounds (inclusive). Bronze 0–99, Silver 100–199, Gold 200–299, Platinum 300+. */
export const WEEKLY_TIER_SILVER_MIN = WEEKLY_LEVEL_STEP;
export const WEEKLY_TIER_GOLD_MIN = 2 * WEEKLY_LEVEL_STEP;
export const WEEKLY_TIER_PLATINUM_MIN = 3 * WEEKLY_LEVEL_STEP;

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
  if (safe >= WEEKLY_TIER_PLATINUM_MIN) return "Platinum";
  if (safe >= WEEKLY_TIER_GOLD_MIN) return "Gold";
  if (safe >= WEEKLY_TIER_SILVER_MIN) return "Silver";
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

/**
 * Season-transition helper: weekly XP → 0; core XP unchanged. Pure state mapping only.
 * Weekly rank windows remain service-owned (`week_id`); do not conflate with this call.
 */
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
 * Uses `xpTotal` field (service convention). For ranking with tiebreak use
 * `rankByWeeklyXpWithTieBreak` from ./leaderboard (when updatedAt·userId exist).
 */
export function leaderboardSort<T extends LeaderboardEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (b.xpTotal ?? 0) - (a.xpTotal ?? 0));
}
