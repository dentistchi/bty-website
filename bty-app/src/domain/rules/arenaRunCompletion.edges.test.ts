/**
 * arenaRunCompletion — 경계·멱등 (SPRINT 57 TASK 8 / C3).
 */
import { describe, it, expect } from "vitest";
import {
  isDuplicateArenaRunCompletion,
  isArenaRunCompleteIdempotencyReplay,
} from "./arenaRunCompletion";

describe("arenaRunCompletion (edges)", () => {
  it("treats whitespace-only runId as non-duplicate", () => {
    const done = new Set(["a"]);
    expect(isDuplicateArenaRunCompletion("   ", done)).toBe(false);
    expect(isDuplicateArenaRunCompletion("\t\n", done)).toBe(false);
  });

  it("matches completed id after trim only", () => {
    expect(isDuplicateArenaRunCompletion("  x  ", new Set(["x"]))).toBe(true);
    expect(isDuplicateArenaRunCompletion("x", new Set(["  x  "]))).toBe(false);
  });

  it("idempotency: trims key; empty after trim is not replay", () => {
    expect(isArenaRunCompleteIdempotencyReplay("   ", "   ")).toBe(false);
    expect(isArenaRunCompleteIdempotencyReplay("", "x")).toBe(false);
  });

  it("idempotency: replay when trimmed keys equal", () => {
    expect(isArenaRunCompleteIdempotencyReplay("  k  ", "k")).toBe(true);
    expect(isArenaRunCompleteIdempotencyReplay("k", "  k  ")).toBe(true);
  });

  it("idempotency: lastApplied undefined never replay", () => {
    expect(isArenaRunCompleteIdempotencyReplay("any", undefined)).toBe(false);
  });
});
