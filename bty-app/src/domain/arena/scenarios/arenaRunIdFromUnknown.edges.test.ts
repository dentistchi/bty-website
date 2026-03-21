/**
 * arenaRunIdFromUnknown — 경계 (SPRINT 84 TASK8 / C3; S93 TASK15 NBSP·전각·ZWSP). XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import {
  ARENA_RUN_ID_MAX_LENGTH,
  arenaRunIdFromUnknown,
} from "./arenaRunIdFromUnknown";

describe("arenaRunIdFromUnknown (edges)", () => {
  it("returns trimmed non-empty string within max length", () => {
    expect(arenaRunIdFromUnknown("  run-1  ")).toBe("run-1");
    expect(arenaRunIdFromUnknown("a")).toBe("a");
    const ok = "x".repeat(ARENA_RUN_ID_MAX_LENGTH);
    expect(arenaRunIdFromUnknown(ok)).toBe(ok);
  });

  it("returns null for empty, over max, or containing whitespace", () => {
    expect(arenaRunIdFromUnknown("")).toBeNull();
    expect(arenaRunIdFromUnknown("   ")).toBeNull();
    expect(arenaRunIdFromUnknown("x".repeat(ARENA_RUN_ID_MAX_LENGTH + 1))).toBeNull();
    expect(arenaRunIdFromUnknown("run 1")).toBeNull();
    expect(arenaRunIdFromUnknown("run\tid")).toBeNull();
  });

  it("returns null for non-strings", () => {
    expect(arenaRunIdFromUnknown(null)).toBeNull();
    expect(arenaRunIdFromUnknown(undefined)).toBeNull();
    expect(arenaRunIdFromUnknown(1)).toBeNull();
    expect(arenaRunIdFromUnknown({})).toBeNull();
  });

  /** S93 TASK15: padded max (no inner `\s`); Unicode spaces inside id rejected; ZWSP not in `\s` (≠ scenarioId). */
  it("accepts max length when outer padding is ASCII spaces only", () => {
    const inner = "r".repeat(ARENA_RUN_ID_MAX_LENGTH);
    expect(arenaRunIdFromUnknown(`  ${inner}  `)).toBe(inner);
  });

  it("returns null when NBSP or ideographic space appears inside the trimmed id", () => {
    expect(arenaRunIdFromUnknown("a\u00A0b")).toBeNull();
    expect(arenaRunIdFromUnknown("a\u3000b")).toBeNull();
  });

  it("returns null for NBSP-only after trim", () => {
    expect(arenaRunIdFromUnknown("\u00A0")).toBeNull();
  });

  it("allows zero-width space inside id (not matched by /\\s/)", () => {
    const withZwsp = "a\u200bb";
    expect(arenaRunIdFromUnknown(withZwsp)).toBe(withZwsp);
  });

  /** S111 C3 TASK8: BOM trim · BOM-only null · boxed `String` (≠ S93 NBSP/ZWSP 라인). */
  it("handles BOM padding, BOM-only trim, and boxed string objects", () => {
    expect(arenaRunIdFromUnknown("\uFEFFrun-1")).toBe("run-1");
    expect(arenaRunIdFromUnknown("\uFEFF")).toBeNull();
    expect(arenaRunIdFromUnknown(Object("run-1"))).toBeNull();
  });

  /**
   * S129·S142 C3 TASK8 — **S128** activated-stats·**S111** BOM/boxed 라인과 구분 (Symbol·bigint; **S142** explicit guard).
   */
  it("S129: returns null for Symbol and bigint", () => {
    expect(arenaRunIdFromUnknown(Symbol("run"))).toBeNull();
    expect(arenaRunIdFromUnknown(BigInt(1))).toBeNull();
  });
});
