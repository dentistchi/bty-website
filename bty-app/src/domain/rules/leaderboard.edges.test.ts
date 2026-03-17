/**
 * Leaderboard rules 도메인 경계 테스트.
 * leaderboard.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  rankByWeeklyXpOnly,
  eliteCutoffRank,
  isElite,
  rankFromCountAbove,
  weeklyRankFromCounts,
} from "./leaderboard";

describe("domain/rules/leaderboard (edges)", () => {
  it("rankByWeeklyXpOnly empty array returns empty array", () => {
    const result = rankByWeeklyXpOnly([]);
    expect(result).toEqual([]);
  });

  it("rankByWeeklyXpOnly: same weeklyXp keeps stable order (not tiebreak rule)", () => {
    const entries = [
      { id: "a", weeklyXp: 100 },
      { id: "b", weeklyXp: 100 },
      { id: "c", weeklyXp: 50 },
    ];
    const result = rankByWeeklyXpOnly(entries);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(result[0].weeklyXp).toBe(100);
    expect(result[1].weeklyXp).toBe(100);
  });

  it("eliteCutoffRank for small totalEntries", () => {
    expect(eliteCutoffRank(20)).toBe(1);
    expect(eliteCutoffRank(21)).toBe(2);
  });

  it("isElite at boundary rank", () => {
    expect(isElite(1, 1)).toBe(true);
    expect(isElite(2, 1)).toBe(false);
  });

  it("rankFromCountAbove handles countAbove 0 and totalCount 1", () => {
    expect(rankFromCountAbove(1, 0)).toBe(1);
  });

  it("weeklyRankFromCounts totalCount 1 returns rank 1 and isTop5Percent true", () => {
    const r = weeklyRankFromCounts(1, 0);
    expect(r.rank).toBe(1);
    expect(r.isTop5Percent).toBe(true);
  });

  it("weeklyRankFromCounts totalCount 0 returns rank 0 and isTop5Percent false", () => {
    const r = weeklyRankFromCounts(0, 0);
    expect(r.rank).toBe(0);
    expect(r.isTop5Percent).toBe(false);
  });

  it("eliteCutoffRank(0) returns 1", () => {
    expect(eliteCutoffRank(0)).toBe(1);
  });
});
