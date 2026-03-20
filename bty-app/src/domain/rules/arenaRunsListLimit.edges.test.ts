import { describe, it, expect } from "vitest";
import {
  ARENA_RUNS_LIST_LIMIT_MIN,
  ARENA_RUNS_LIST_LIMIT_MAX,
  ARENA_RUNS_LIST_LIMIT_DEFAULT,
  clampArenaRunsListLimit,
} from "./arenaRunsListLimit";

describe("arenaRunsListLimit (edges)", () => {
  it("returns default for NaN and below min", () => {
    expect(clampArenaRunsListLimit(Number.NaN)).toBe(ARENA_RUNS_LIST_LIMIT_DEFAULT);
    expect(clampArenaRunsListLimit(0)).toBe(ARENA_RUNS_LIST_LIMIT_DEFAULT);
    expect(clampArenaRunsListLimit(-1)).toBe(ARENA_RUNS_LIST_LIMIT_DEFAULT);
  });

  it("clamps to min and max", () => {
    expect(clampArenaRunsListLimit(1)).toBe(ARENA_RUNS_LIST_LIMIT_MIN);
    expect(clampArenaRunsListLimit(50)).toBe(ARENA_RUNS_LIST_LIMIT_MAX);
    expect(clampArenaRunsListLimit(100)).toBe(ARENA_RUNS_LIST_LIMIT_MAX);
  });

  it("returns default when min/max/default are consistent", () => {
    expect(ARENA_RUNS_LIST_LIMIT_DEFAULT).toBe(10);
    expect(ARENA_RUNS_LIST_LIMIT_MIN).toBe(1);
    expect(ARENA_RUNS_LIST_LIMIT_MAX).toBe(50);
  });
});
