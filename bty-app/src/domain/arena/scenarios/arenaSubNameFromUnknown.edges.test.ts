/**
 * arenaSubNameFromUnknown — 경계 (S86 TASK8 / C3, S93 TASK8 보강).
 */
import { describe, it, expect } from "vitest";
import {
  ARENA_SUB_NAME_MAX_LENGTH,
  arenaSubNameFromUnknown,
} from "./arenaSubNameFromUnknown";

describe("arenaSubNameFromUnknown (edges)", () => {
  it("accepts trimmed letters, numbers, space, hyphen, underscore within max", () => {
    expect(arenaSubNameFromUnknown("  Ab12  ")).toEqual({ ok: true, value: "Ab12" });
    expect(arenaSubNameFromUnknown("a b-c_d")).toEqual({ ok: true, value: "a b-c_d" });
    expect(arenaSubNameFromUnknown("가나3")).toEqual({ ok: true, value: "가나3" });
    const max = "x".repeat(ARENA_SUB_NAME_MAX_LENGTH);
    expect(arenaSubNameFromUnknown(max)).toEqual({ ok: true, value: max });
  });

  it("rejects empty, non-string, over max, invalid chars", () => {
    expect(arenaSubNameFromUnknown("")).toEqual({ ok: false, reason: "EMPTY" });
    expect(arenaSubNameFromUnknown("   ")).toEqual({ ok: false, reason: "EMPTY" });
    expect(arenaSubNameFromUnknown(null)).toEqual({ ok: false, reason: "EMPTY" });
    expect(arenaSubNameFromUnknown(undefined)).toEqual({ ok: false, reason: "EMPTY" });
    expect(arenaSubNameFromUnknown(1)).toEqual({ ok: false, reason: "EMPTY" });
    expect(arenaSubNameFromUnknown("x".repeat(ARENA_SUB_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      reason: "MAX_7_CHARS",
    });
    expect(arenaSubNameFromUnknown("bad@")).toEqual({ ok: false, reason: "INVALID_CHARS" });
    expect(arenaSubNameFromUnknown("a.b")).toEqual({ ok: false, reason: "INVALID_CHARS" });
  });

  /** S93 TASK8: fullwidth `\p{N}` / `\p{L}`; NBSP-only → EMPTY; internal `\t`/`\n` allowed via `\s`. */
  it("accepts fullwidth letters and digits within max length", () => {
    expect(arenaSubNameFromUnknown("　ＡＢ１２　")).toEqual({ ok: true, value: "ＡＢ１２" });
    expect(arenaSubNameFromUnknown("１２３４５６７")).toEqual({ ok: true, value: "１２３４５６７" });
  });

  it("treats NBSP-only and NBSP padding as empty after trim", () => {
    expect(arenaSubNameFromUnknown("\u00A0")).toEqual({ ok: false, reason: "EMPTY" });
    expect(arenaSubNameFromUnknown("\u00A0\u00A0")).toEqual({ ok: false, reason: "EMPTY" });
  });

  it("allows horizontal tab and newline inside the trimmed value", () => {
    expect(arenaSubNameFromUnknown("a\tb")).toEqual({ ok: true, value: "a\tb" });
    expect(arenaSubNameFromUnknown("x\ny")).toEqual({ ok: true, value: "x\ny" });
  });

  it("distinguishes max length from invalid char at boundary length", () => {
    expect(arenaSubNameFromUnknown("xxxxxx@")).toEqual({ ok: false, reason: "INVALID_CHARS" });
    expect(arenaSubNameFromUnknown("xxxxxxx@")).toEqual({ ok: false, reason: "MAX_7_CHARS" });
  });
});
