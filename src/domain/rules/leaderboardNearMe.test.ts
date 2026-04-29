import { describe, it, expect } from "vitest";
import {
  leaderboardNearMeSliceBounds,
  leaderboardNearMeRanksAreContiguous,
} from "./leaderboardNearMe";

describe("leaderboardNearMe", () => {
  it("slice bounds match API formula (rank 10, len 100)", () => {
    expect(leaderboardNearMeSliceBounds(10, 100)).toEqual({
      startIndex: 4,
      endExclusive: 16,
    });
  });

  it("246: nearMe ranks contiguous when API-ordered window", () => {
    const window = [
      { rank: 4 },
      { rank: 5 },
      { rank: 6 },
      { rank: 7 },
    ];
    expect(leaderboardNearMeRanksAreContiguous(window)).toBe(true);
    expect(leaderboardNearMeRanksAreContiguous([{ rank: 1 }, { rank: 3 }])).toBe(
      false
    );
  });
});
