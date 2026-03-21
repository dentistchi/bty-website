/**
 * arenaCodeNameFromUnknown — 경계 (S87 TASK8 / C3).
 */
import { describe, it, expect } from "vitest";
import {
  ARENA_CODE_NAME_MAX_LENGTH,
  ARENA_CODE_NAME_MIN_LENGTH,
  arenaCodeNameFromUnknown,
} from "./arenaCodeNameFromUnknown";

describe("arenaCodeNameFromUnknown (edges)", () => {
  it("accepts trimmed ASCII alnum with single internal hyphens", () => {
    expect(arenaCodeNameFromUnknown("  Abc-12  ")).toEqual({ ok: true, value: "Abc-12" });
    const min = "a".repeat(ARENA_CODE_NAME_MIN_LENGTH);
    expect(arenaCodeNameFromUnknown(min)).toEqual({ ok: true, value: min });
    const max = "x".repeat(ARENA_CODE_NAME_MAX_LENGTH);
    expect(arenaCodeNameFromUnknown(max)).toEqual({ ok: true, value: max });
  });

  it("rejects length, charset, edge dash, double dash, non-string", () => {
    expect(arenaCodeNameFromUnknown("ab")).toEqual({ ok: false, reason: "LENGTH_3_TO_20" });
    expect(arenaCodeNameFromUnknown("x".repeat(ARENA_CODE_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      reason: "LENGTH_3_TO_20",
    });
    expect(arenaCodeNameFromUnknown(null)).toEqual({ ok: false, reason: "LENGTH_3_TO_20" });
    expect(arenaCodeNameFromUnknown("bad_name")).toEqual({ ok: false, reason: "ONLY_ALNUM_DASH" });
    expect(arenaCodeNameFromUnknown("-abc")).toEqual({ ok: false, reason: "NO_EDGE_DASH" });
    expect(arenaCodeNameFromUnknown("abc-")).toEqual({ ok: false, reason: "NO_EDGE_DASH" });
    expect(arenaCodeNameFromUnknown("a--b")).toEqual({ ok: false, reason: "NO_DOUBLE_DASH" });
  });

  it("rejects internal whitespace (space, tab) in code name", () => {
    expect(arenaCodeNameFromUnknown("ab c")).toEqual({ ok: false, reason: "ONLY_ALNUM_DASH" });
    expect(arenaCodeNameFromUnknown("ab\tc")).toEqual({ ok: false, reason: "ONLY_ALNUM_DASH" });
  });

  /**
   * S108 TASK8 — **S107** lifecycle·**S106** runType·**S105** difficulty·event·**TASK9** lab 라인과 구분.
   */
  it("S108: BOM trim accepts valid code; boxed strings, ZWSP, fullwidth reject", () => {
    expect(arenaCodeNameFromUnknown("\uFEFFAb-1")).toEqual({ ok: true, value: "Ab-1" });
    expect(arenaCodeNameFromUnknown(Object("Xyz-9"))).toEqual({ ok: false, reason: "LENGTH_3_TO_20" });
    expect(arenaCodeNameFromUnknown(Object("Ab-cd"))).toEqual({ ok: false, reason: "LENGTH_3_TO_20" });
    expect(arenaCodeNameFromUnknown("Ab\u200b-cd")).toEqual({ ok: false, reason: "ONLY_ALNUM_DASH" });
    expect(arenaCodeNameFromUnknown("Ａbc-1")).toEqual({ ok: false, reason: "ONLY_ALNUM_DASH" });
    expect(arenaCodeNameFromUnknown("Code\uFF3C")).toEqual({ ok: false, reason: "ONLY_ALNUM_DASH" });
  });

  /**
   * S116 C3 TASK8 — **S115** lab Symbol·**S108** boxed/`String` 라인과 구분: non-string **`Symbol`** / **`bigint`** → **LENGTH_3_TO_20**.
   */
  it("S116: rejects Symbol and bigint", () => {
    expect(arenaCodeNameFromUnknown(Symbol("Ab-1"))).toEqual({ ok: false, reason: "LENGTH_3_TO_20" });
    expect(arenaCodeNameFromUnknown(BigInt(123))).toEqual({ ok: false, reason: "LENGTH_3_TO_20" });
  });
});
