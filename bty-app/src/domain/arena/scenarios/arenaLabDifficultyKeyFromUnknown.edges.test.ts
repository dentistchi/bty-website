/**
 * arenaLabDifficultyKeyFromUnknown — 경계 (S89 TASK8 / C3; **S101** strict·S100 시나리오 라인 미중복).
 */
import { describe, it, expect } from "vitest";
import {
  arenaLabDifficultyKeyFromUnknown,
  arenaLabDifficultyKeyStrictFromUnknown,
  type ArenaLabDifficultyKey,
} from "./arenaLabDifficultyKeyFromUnknown";

describe("arenaLabDifficultyKeyFromUnknown (edges)", () => {
  it("returns each allowed key for exact string match", () => {
    const keys: ArenaLabDifficultyKey[] = ["easy", "mid", "hard", "extreme"];
    for (const k of keys) {
      expect(arenaLabDifficultyKeyFromUnknown(k)).toBe(k);
    }
  });

  it("returns mid for unknown, wrong string, or non-string", () => {
    expect(arenaLabDifficultyKeyFromUnknown("bogus")).toBe("mid");
    expect(arenaLabDifficultyKeyFromUnknown("MID")).toBe("mid");
    expect(arenaLabDifficultyKeyFromUnknown("")).toBe("mid");
    expect(arenaLabDifficultyKeyFromUnknown(null)).toBe("mid");
    expect(arenaLabDifficultyKeyFromUnknown(1)).toBe("mid");
  });

  /** S101 TASK8: near-miss — padding / casing (lenient still → mid). */
  it("returns mid when key string has padding or wrong case (lenient)", () => {
    expect(arenaLabDifficultyKeyFromUnknown(" easy ")).toBe("mid");
    expect(arenaLabDifficultyKeyFromUnknown("Easy")).toBe("mid");
  });
});

describe("arenaLabDifficultyKeyStrictFromUnknown (edges)", () => {
  it("returns the key only for exact easy|mid|hard|extreme", () => {
    expect(arenaLabDifficultyKeyStrictFromUnknown("easy")).toBe("easy");
    expect(arenaLabDifficultyKeyStrictFromUnknown("extreme")).toBe("extreme");
  });

  it("returns null for non-string, unknown label, padding, or wrong case", () => {
    expect(arenaLabDifficultyKeyStrictFromUnknown(null)).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown("harder")).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown(" easy ")).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown("MID")).toBeNull();
  });

  /**
   * S110 TASK8 — **S109** ISO·**S108** code-name·**S101** padding-only 라인과 구분 (**strict**는 trim 없음).
   */
  it("S110: strict rejects BOM prefix, trailing ZWSP, boxed; exact token passes", () => {
    expect(arenaLabDifficultyKeyStrictFromUnknown("\uFEFFeasy")).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown("mid\u200b")).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown(Object("hard"))).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown("extreme")).toBe("extreme");
  });

  /** S113 C3 TASK8: strict rejects boolean / array / object (≠ S110 BOM·ZWSP·boxed `String`). */
  it("S113: strict rejects boolean, array, and plain object", () => {
    expect(arenaLabDifficultyKeyStrictFromUnknown(true)).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown(false)).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown(["mid"])).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown({})).toBeNull();
  });

  /**
   * S115 C3 TASK8 — **S114** date-only·**S113** strict 타입 라인과 구분: lenient는 `Symbol` → **`mid`**.
   */
  it("S115: lenient returns mid for Symbol", () => {
    expect(arenaLabDifficultyKeyFromUnknown(Symbol("easy"))).toBe("mid");
  });

  /** S153 C3 TASK8 — top-level **`Symbol`** / **`bigint`** (**strict** → **null**; **S115** lenient·**S113** 타입 라인과 구분). */
  it("S153: strict returns null for Symbol and bigint", () => {
    expect(arenaLabDifficultyKeyStrictFromUnknown(Symbol("mid"))).toBeNull();
    expect(arenaLabDifficultyKeyStrictFromUnknown(BigInt(0))).toBeNull();
  });
});
