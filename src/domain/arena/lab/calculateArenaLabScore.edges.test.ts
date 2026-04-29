/**
 * calculateArenaLabScore — 경계 (0점·최대점·시도 가중). XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import {
  ARENA_LAB_SCORE_ATTEMPT_LIMIT,
  ARENA_LAB_SCORE_MAX,
  calculateArenaLabScore,
} from "./calculateArenaLabScore";

describe("calculateArenaLabScore (edges)", () => {
  it("returns maximum score for extreme difficulty on first attempt", () => {
    expect(
      calculateArenaLabScore({ difficulty: "extreme", attemptCount: 1 }),
    ).toBe(ARENA_LAB_SCORE_MAX);
  });

  it("returns zero for out-of-range or non-integer attemptCount", () => {
    expect(calculateArenaLabScore({ difficulty: "easy", attemptCount: 0 })).toBe(0);
    expect(
      calculateArenaLabScore({
        difficulty: "mid",
        attemptCount: ARENA_LAB_SCORE_ATTEMPT_LIMIT + 1,
      }),
    ).toBe(0);
    expect(calculateArenaLabScore({ difficulty: "hard", attemptCount: 1.5 })).toBe(0);
    expect(calculateArenaLabScore({ difficulty: "hard", attemptCount: NaN })).toBe(0);
  });

  it("scales down by attempt index (same difficulty)", () => {
    expect(calculateArenaLabScore({ difficulty: "mid", attemptCount: 1 })).toBe(20);
    expect(calculateArenaLabScore({ difficulty: "mid", attemptCount: 2 })).toBe(13);
    expect(calculateArenaLabScore({ difficulty: "mid", attemptCount: 3 })).toBe(7);
  });

  it("minimum positive score on last attempt is easy third try", () => {
    expect(calculateArenaLabScore({ difficulty: "easy", attemptCount: 3 })).toBe(3);
  });

  it("matches difficulty bases from spec (attempt 1 = full weight)", () => {
    expect(calculateArenaLabScore({ difficulty: "easy", attemptCount: 1 })).toBe(10);
    expect(calculateArenaLabScore({ difficulty: "mid", attemptCount: 1 })).toBe(20);
    expect(calculateArenaLabScore({ difficulty: "hard", attemptCount: 1 })).toBe(35);
  });
});
