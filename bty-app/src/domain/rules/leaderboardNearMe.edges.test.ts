/**
 * leaderboardNearMe — nearMe 슬라이스·연속 rank 경계 (SPRINT 65 TASK 8 / C3).
 */
import { describe, it, expect } from "vitest";
import {
  leaderboardNearMeSliceBounds,
  leaderboardNearMeRanksAreContiguous,
} from "./leaderboardNearMe";

describe("leaderboardNearMe (edges)", () => {
  it("clamps negative or fractional myRank and totalRows", () => {
    expect(leaderboardNearMeSliceBounds(-1, 100)).toEqual({
      startIndex: 0,
      endExclusive: 6,
    });
    expect(leaderboardNearMeSliceBounds(10.7, 50)).toEqual({
      startIndex: 4,
      endExclusive: 16,
    });
    expect(leaderboardNearMeSliceBounds(1, 0)).toEqual({
      startIndex: 0,
      endExclusive: 0,
    });
  });

  it("caps endExclusive at totalRows and startIndex at 0 when rank is low", () => {
    expect(leaderboardNearMeSliceBounds(3, 8)).toEqual({
      startIndex: 0,
      endExclusive: 8,
    });
  });

  it("when rank exceeds totalRows, endExclusive is capped at totalRows", () => {
    const result = leaderboardNearMeSliceBounds(100, 10);
    expect(result.endExclusive).toBe(10);
    expect(result.startIndex).toBeGreaterThanOrEqual(0);
  });

  it("leaderboardNearMeRanksAreContiguous: empty and single element are true", () => {
    expect(leaderboardNearMeRanksAreContiguous([])).toBe(true);
    expect(leaderboardNearMeRanksAreContiguous([{ rank: 5 }])).toBe(true);
  });

  it("leaderboardNearMeRanksAreContiguous: gap returns false", () => {
    expect(leaderboardNearMeRanksAreContiguous([{ rank: 1 }, { rank: 2 }, { rank: 4 }])).toBe(
      false
    );
  });
});
