/**
 * Leaderboard rules: ranking and elite.
 * Rule: Season progression (Core XP, Tier, Code) MUST NOT affect leaderboard rank.
 * Rank is by Weekly XP only. Identity (code name, sub name) is from Core.
 * See docs/spec/arena-domain-rules.md.
 */

import { ELITE_TOP_FRACTION } from "../constants";

/** Sort entries by weeklyXp descending for leaderboard order. Rank = 1-based index after sort. */
export function rankByWeeklyXpOnly<T extends { weeklyXp: number }>(
  entries: T[]
): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => b.weeklyXp - a.weeklyXp);
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Elite cutoff: top N% by weekly XP. Minimum 1. Returns the rank threshold (inclusive). */
export function eliteCutoffRank(totalEntries: number): number {
  return Math.max(1, Math.ceil(totalEntries * ELITE_TOP_FRACTION));
}

/** Whether a 1-based rank is in the elite group for this leaderboard size. */
export function isElite(rank: number, totalEntries: number): boolean {
  return rank <= eliteCutoffRank(totalEntries);
}
