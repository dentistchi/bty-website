import { describe, it, expect } from "vitest";
import {
  isDuplicateArenaRunCompletion,
  isArenaRunCompleteIdempotencyReplay,
} from "./arenaRunCompletion";

describe("arenaRunCompletion", () => {
  it("isDuplicateArenaRunCompletion", () => {
    const done = new Set(["r1", "r2"]);
    expect(isDuplicateArenaRunCompletion("r1", done)).toBe(true);
    expect(isDuplicateArenaRunCompletion("r3", done)).toBe(false);
    expect(isDuplicateArenaRunCompletion("", done)).toBe(false);
    expect(isDuplicateArenaRunCompletion("  r2  ", done)).toBe(true);
  });

  it("isArenaRunCompleteIdempotencyReplay", () => {
    expect(isArenaRunCompleteIdempotencyReplay("abc", "abc")).toBe(true);
    expect(isArenaRunCompleteIdempotencyReplay("abc", "xyz")).toBe(false);
    expect(isArenaRunCompleteIdempotencyReplay(null, "a")).toBe(false);
    expect(isArenaRunCompleteIdempotencyReplay("x", null)).toBe(false);
  });
});
