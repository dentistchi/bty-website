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
import {
  calculateLevel,
  calculateTier,
  type WeeklyTierName,
} from "./weeklyXp";

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

/**
 * Single source for UI: within-week level/tier (from Weekly XP totals) vs weekly Elite
 * (top 5% by rank). Core XP tier must not be mixed with either.
 * `rank` must be 1-based; use 0 when user has no row / not ranked → never elite.
 */
/**
 * 라이브 랭킹: API가 준 `rank` 순서가 표시 순서의 단일 진실.
 * 클라이언트는 weeklyXp만으로 재정렬하면 안 됨(동점 시 API 타이브레이크 유지).
 */
export function leaderboardLiveRowsAreDisplaySafeOrder<
  T extends { rank: number; weeklyXp: number; userId: string },
>(rows: T[]): boolean {
  if (rows.length === 0) return true;
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const cur = rows[i]!;
    if (cur.rank !== prev.rank + 1) return false;
  }
  return rows[0]!.rank === 1;
}

export function weeklyCompetitionDisplay(input: {
  weeklyXpTotal: number;
  rank: number;
  totalLeaderboardEntries: number;
}): {
  weeklyTier: WeeklyTierName;
  weeklyLevel: number;
  isWeeklyElite: boolean;
} {
  const weeklyTier = calculateTier(input.weeklyXpTotal);
  const weeklyLevel = calculateLevel(input.weeklyXpTotal);
  const isWeeklyElite =
    input.rank >= 1 &&
    input.totalLeaderboardEntries > 0 &&
    isElite(input.rank, input.totalLeaderboardEntries);
  return { weeklyTier, weeklyLevel, isWeeklyElite };
}

/** Render-only i18n keys for weekly competition tier (leaderboard card). UI maps via t(key). */
export type WeeklyTierDisplayLabelKey =
  | "arena.leaderboard.weeklyTierBronze"
  | "arena.leaderboard.weeklyTierSilver"
  | "arena.leaderboard.weeklyTierGold"
  | "arena.leaderboard.weeklyTierPlatinum";

/** Maps canonical weekly tier name → stable label key (no user-facing copy in domain). */
export function weeklyTierDisplayLabelKey(tier: WeeklyTierName): WeeklyTierDisplayLabelKey {
  switch (tier) {
    case "Bronze":
      return "arena.leaderboard.weeklyTierBronze";
    case "Silver":
      return "arena.leaderboard.weeklyTierSilver";
    case "Gold":
      return "arena.leaderboard.weeklyTierGold";
    case "Platinum":
      return "arena.leaderboard.weeklyTierPlatinum";
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}
