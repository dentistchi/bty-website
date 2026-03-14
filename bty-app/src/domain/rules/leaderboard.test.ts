import { describe, it, expect } from "vitest";
import {
  rankByWeeklyXpOnly,
  eliteCutoffRank,
  isElite,
  rankFromCountAbove,
  weeklyRankFromCounts,
} from "./leaderboard";

describe("domain/rules/leaderboard", () => {
  describe("rankByWeeklyXpOnly", () => {
    it("sorts by weeklyXp descending and assigns 1-based rank", () => {
      const entries = [
        { id: "a", weeklyXp: 100 },
        { id: "b", weeklyXp: 300 },
        { id: "c", weeklyXp: 200 },
      ];
      const result = rankByWeeklyXpOnly(entries);
      expect(result[0]).toEqual({ id: "b", weeklyXp: 300, rank: 1 });
      expect(result[1]).toEqual({ id: "c", weeklyXp: 200, rank: 2 });
      expect(result[2]).toEqual({ id: "a", weeklyXp: 100, rank: 3 });
    });

    it("returns empty array when given empty", () => {
      expect(rankByWeeklyXpOnly([])).toEqual([]);
    });

    it("assigns rank 1 to single entry", () => {
      const result = rankByWeeklyXpOnly([{ id: "only", weeklyXp: 50 }]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: "only", weeklyXp: 50, rank: 1 });
    });
  });

  describe("eliteCutoffRank", () => {
    it("returns at least 1 for any totalEntries", () => {
      expect(eliteCutoffRank(0)).toBe(1);
      expect(eliteCutoffRank(1)).toBe(1);
    });

    it("returns top 5% rank threshold (ceil) for 100 entries", () => {
      expect(eliteCutoffRank(100)).toBe(5);
    });
  });

  describe("isElite", () => {
    it("returns true when rank <= elite cutoff", () => {
      expect(isElite(1, 100)).toBe(true);
      expect(isElite(5, 100)).toBe(true);
    });

    it("returns false when rank > elite cutoff", () => {
      expect(isElite(6, 100)).toBe(false);
    });
  });

  describe("rankFromCountAbove", () => {
    it("returns 0 when totalCount is 0", () => {
      expect(rankFromCountAbove(0, 0)).toBe(0);
      expect(rankFromCountAbove(0, 5)).toBe(0);
    });

    it("returns countAbove + 1 when totalCount > 0", () => {
      expect(rankFromCountAbove(100, 0)).toBe(1);
      expect(rankFromCountAbove(100, 4)).toBe(5);
      expect(rankFromCountAbove(100, 99)).toBe(100);
    });
  });

  describe("weeklyRankFromCounts", () => {
    it("returns rank and isTop5Percent from counts", () => {
      const r1 = weeklyRankFromCounts(100, 0);
      expect(r1.rank).toBe(1);
      expect(r1.isTop5Percent).toBe(true);

      const r5 = weeklyRankFromCounts(100, 4);
      expect(r5.rank).toBe(5);
      expect(r5.isTop5Percent).toBe(true);

      const r6 = weeklyRankFromCounts(100, 5);
      expect(r6.rank).toBe(6);
      expect(r6.isTop5Percent).toBe(false);

      expect(weeklyRankFromCounts(0, 0)).toEqual({ rank: 0, isTop5Percent: false });
    });
  });
});
