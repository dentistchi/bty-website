/**
 * arenaRunScoreFromUnknown — 경계. XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import {
  ARENA_RUN_SCORE_MAX,
  arenaRunScoreFromUnknown,
} from "./arenaRunScoreFromUnknown";

describe("arenaRunScoreFromUnknown (edges)", () => {
  it("accepts non-negative integers within max (number)", () => {
    expect(arenaRunScoreFromUnknown(0)).toBe(0);
    expect(arenaRunScoreFromUnknown(1)).toBe(1);
    expect(arenaRunScoreFromUnknown(ARENA_RUN_SCORE_MAX)).toBe(ARENA_RUN_SCORE_MAX);
  });

  it("accepts digit-only strings after trim", () => {
    expect(arenaRunScoreFromUnknown("0")).toBe(0);
    expect(arenaRunScoreFromUnknown("  42  ")).toBe(42);
    expect(arenaRunScoreFromUnknown(String(ARENA_RUN_SCORE_MAX))).toBe(ARENA_RUN_SCORE_MAX);
  });

  it("returns null for out-of-range, non-integer, or non-finite numbers", () => {
    expect(arenaRunScoreFromUnknown(-1)).toBeNull();
    expect(arenaRunScoreFromUnknown(ARENA_RUN_SCORE_MAX + 1)).toBeNull();
    expect(arenaRunScoreFromUnknown(1.5)).toBeNull();
    expect(arenaRunScoreFromUnknown(NaN)).toBeNull();
    expect(arenaRunScoreFromUnknown(Infinity)).toBeNull();
  });

  it("returns null for invalid or empty strings", () => {
    expect(arenaRunScoreFromUnknown("")).toBeNull();
    expect(arenaRunScoreFromUnknown("   ")).toBeNull();
    expect(arenaRunScoreFromUnknown("12a")).toBeNull();
    expect(arenaRunScoreFromUnknown("-1")).toBeNull();
    expect(arenaRunScoreFromUnknown("1.5")).toBeNull();
    expect(arenaRunScoreFromUnknown(String(ARENA_RUN_SCORE_MAX + 1))).toBeNull();
  });

  it("returns null for undefined, plain objects, arrays, boolean", () => {
    expect(arenaRunScoreFromUnknown(undefined)).toBeNull();
    expect(arenaRunScoreFromUnknown({})).toBeNull();
    expect(arenaRunScoreFromUnknown([])).toBeNull();
    expect(arenaRunScoreFromUnknown(true)).toBeNull();
  });

  it("returns null for boxed number", () => {
    expect(arenaRunScoreFromUnknown(Object(7))).toBeNull();
  });

  it("returns null for top-level null, Symbol variants, and bigint values", () => {
    expect(arenaRunScoreFromUnknown(null)).toBeNull();

    expect(arenaRunScoreFromUnknown(Symbol())).toBeNull();
    expect(arenaRunScoreFromUnknown(Symbol("score"))).toBeNull();
    expect(arenaRunScoreFromUnknown(Symbol.for("arena.score"))).toBeNull();

    expect(arenaRunScoreFromUnknown(BigInt(0))).toBeNull();
    expect(arenaRunScoreFromUnknown(BigInt(1))).toBeNull();
    expect(arenaRunScoreFromUnknown(BigInt(String(ARENA_RUN_SCORE_MAX)))).toBeNull();
  });
});
