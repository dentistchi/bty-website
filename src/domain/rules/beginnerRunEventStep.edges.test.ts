/**
 * beginner 이벤트 step — 경계 (SPRINT 67 TASK 8 / C3). XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import { isValidBeginnerEventStep } from "./beginnerRunEventStep";

describe("isValidBeginnerEventStep (edges)", () => {
  it("rejects null, undefined, non-numeric, and out-of-range", () => {
    expect(isValidBeginnerEventStep(null)).toBe(false);
    expect(isValidBeginnerEventStep(undefined)).toBe(false);
    expect(isValidBeginnerEventStep("")).toBe(false);
    expect(isValidBeginnerEventStep({})).toBe(false);
    expect(isValidBeginnerEventStep(1)).toBe(false);
    expect(isValidBeginnerEventStep(6)).toBe(false);
    expect(isValidBeginnerEventStep(NaN)).toBe(false);
  });

  it("accepts 2–5 including numeric strings", () => {
    expect(isValidBeginnerEventStep(2)).toBe(true);
    expect(isValidBeginnerEventStep(3)).toBe(true);
    expect(isValidBeginnerEventStep(4)).toBe(true);
    expect(isValidBeginnerEventStep(5)).toBe(true);
    expect(isValidBeginnerEventStep("4")).toBe(true);
  });
});
