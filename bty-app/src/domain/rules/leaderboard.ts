/**
 * Leaderboard rules: ranking and elite.
 * Rule: Season progression (Core XP, Tier, Code) MUST NOT affect leaderboard rank.
 * Rank is by Weekly XP only. Identity (code name, sub name) is from Core.
 * 타이브레이크 단일 소스: leaderboardTieBreak (`LEADERBOARD_TIE_BREAK_ORDER`). 상수: ELITE_TOP_FRACTION.
 * @see level-tier — Core tier/code/sub for row **identity** only, never for sort key.
 * @see xp — seasonal→Core conversion; rank remains weekly XP + tiebreak only.
 * See docs/spec/arena-domain-rules.md.
 */

import { ELITE_TOP_FRACTION } from "../constants";
import {
  compareWeeklyXpTieBreak,
  type WeeklyXpRowForTieBreak,
} from "./leaderboardTieBreak";

/**
 * Sort by weeklyXp descending only. Ties: stable sort order (not domain tiebreak).
 * For production leaderboard ordering use `rankByWeeklyXpWithTieBreak` when `updatedAt`·`userId` are available.
 */
export function rankByWeeklyXpOnly<T extends { weeklyXp: number }>(
  entries: T[]
): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => b.weeklyXp - a.weeklyXp);
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Deterministic rank: weeklyXp desc → updatedAt asc → userId asc. Single source with DB ordering. */
export function rankByWeeklyXpWithTieBreak<T extends WeeklyXpRowForTieBreak>(
  entries: T[]
): (T & { rank: number })[] {
  const sorted = [...entries].sort(compareWeeklyXpTieBreak);
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Elite cutoff: top N% by weekly XP. Minimum 1. Returns the rank threshold (inclusive). */
export function eliteCutoffRank(totalEntries: number): number {
  return Math.max(1, Math.ceil(totalEntries * ELITE_TOP_FRACTION));
}

/**
 * Weekly-rank “Elite” (top 5%). Not LE `certified` (`leadership-engine/certified`) — different product concept.
 */
export function isElite(rank: number, totalEntries: number): boolean {
  return rank <= eliteCutoffRank(totalEntries);
}

/**
 * 1-based weekly rank from count of users with strictly higher weekly XP.
 * totalCount = number of ranked users (e.g. count of weekly_xp with league_id null).
 * countAbove = count of users with xp_total > myXp. Rank = countAbove + 1.
 * When totalCount is 0, returns 0 (no ranking).
 */
export function rankFromCountAbove(totalCount: number, countAbove: number): number {
  if (totalCount <= 0) return 0;
  return (countAbove ?? 0) + 1;
}

/**
 * Weekly rank display values from DB counts. Pure: no DB; caller supplies totalCount and countAbove.
 * Use for core-xp and sub-name routes so ranking/top-5% logic lives in domain only.
 * When totalCount is 0 (no ranking), returns rank 0 and isTop5Percent false.
 */
export function weeklyRankFromCounts(totalCount: number, countAbove: number): {
  rank: number;
  isTop5Percent: boolean;
} {
  if (totalCount <= 0) return { rank: 0, isTop5Percent: false };
  const rank = rankFromCountAbove(totalCount, countAbove);
  const isTop5Percent = isElite(rank, totalCount);
  return { rank, isTop5Percent };
}
