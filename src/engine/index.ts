/**
 * BTY Arena pure business logic engine.
 * Framework-agnostic TypeScript. No DB, HTTP, or UI.
 * Season does not affect leaderboard; Core XP permanent; Weekly XP resets.
 */

import {
  tierFromCoreXp,
  stageFromCoreXp,
  weeklyXpAfterReset,
  sortByWeeklyXpDesc,
} from "../domain/rules";
import { TIER_CORE_XP_STEP } from "../domain/constants";
import type {
  CoreXp,
  ISODateString,
  LeaderboardEntry,
  SeasonWindow,
  StageNumber,
  Tier,
  WeeklyXp,
} from "../domain/types";

// ─── XP awards (pure addition; caps applied by caller if needed) ─────────────

/**
 * Award Core XP (permanent, accumulative).
 * Pure: current + amount. No cap applied here.
 */
export function awardCoreXp(currentCoreXp: CoreXp, amount: number): CoreXp {
  const safe = Math.max(0, Number(amount));
  return Math.max(0, currentCoreXp + safe);
}

/**
 * Award Weekly XP (ephemeral; used for weekly ranking only).
 * Pure: current + amount. No cap applied here.
 */
export function awardWeeklyXp(currentWeeklyXp: WeeklyXp, amount: number): WeeklyXp {
  const safe = Math.max(0, Number(amount));
  return Math.max(0, currentWeeklyXp + safe);
}

// ─── Level / Tier / Stage (from Core XP; level = tier here) ──────────────────

/**
 * Numeric level from Core XP. Level = tier = floor(coreXp / 10).
 * Used for internal progression; content unlock (LevelId) is tenure-only elsewhere.
 */
export function calculateLevelFromCoreXp(coreXp: CoreXp): number {
  return tierFromCoreXp(coreXp);
}

/**
 * Tier from numeric level. Level and tier are the same scale (0-based).
 * tier = level (identity for the numeric level from Core XP).
 */
export function calculateTierFromLevel(level: number): Tier {
  const L = Math.max(0, Math.floor(Number(level)));
  return L as Tier;
}

/**
 * Stage 1..7 from tier. tier = coreXp/10 ⇒ stage = floor(coreXp/100)+1 = floor(tier/10)+1, capped 1..7.
 */
export function calculateStageFromTier(tier: Tier): StageNumber {
  const coreXp = tier * TIER_CORE_XP_STEP;
  return stageFromCoreXp(coreXp);
}

// ─── Leaderboard (Weekly XP only; season does not affect rank) ────────────────

/**
 * Sort leaderboard entries by Weekly XP descending (rank order).
 * Ranking is by Weekly XP only; season progression does not affect rank.
 */
export function leaderboardSortWeekly(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return sortByWeeklyXpDesc(entries);
}

// ─── Season reset (pure computation; no side effects) ─────────────────────────

export interface SeasonResetPlan {
  /** End date of the current season window (reset boundary). */
  resetDate: ISODateString;
  /** Whether the given date is on or past the reset boundary. */
  isResetDue: boolean;
  /** Weekly XP after applying carryover: floor(currentWeeklyXp * carryoverFraction). */
  newWeeklyXpAfterReset: number;
  /** Core XP is unchanged (informational). */
  coreXpUnaffected: true;
}

/**
 * Pure season reset planner. No side effects; computes what would happen at reset.
 * Use to decide when to run reset logic or to show users preview of carryover.
 */
export function seasonResetPlanner(
  now: ISODateString,
  seasonWindow: SeasonWindow,
  currentWeeklyXp: number
): SeasonResetPlan {
  const resetDate = seasonWindow.endDate;
  const isResetDue = now >= resetDate;
  const newWeeklyXpAfterReset = weeklyXpAfterReset(currentWeeklyXp);
  return {
    resetDate,
    isResetDue,
    newWeeklyXpAfterReset,
    coreXpUnaffected: true,
  };
}

// Re-export domain types used by engine
export type { CoreXp, LeaderboardEntry, SeasonWindow, StageNumber, Tier, WeeklyXp };
