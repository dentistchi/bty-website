import { describe, it, expect } from "vitest";
import {
  ARENA_REFLECT_LEVEL_IDS,
  arenaReflectLevelIdFromUnknown,
} from "./arenaReflectLevelIdFromUnknown";

describe("arenaReflectLevelIdFromUnknown", () => {
  it.each(ARENA_REFLECT_LEVEL_IDS)("accepts %s (case-insensitive)", (id) => {
    expect(arenaReflectLevelIdFromUnknown(id.toLowerCase())).toBe(id);
    expect(arenaReflectLevelIdFromUnknown(`  ${id}  `)).toBe(id);
  });

  it("rejects unknown tokens", () => {
    expect(arenaReflectLevelIdFromUnknown("S0")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("L5")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("XX")).toBeNull();
  });

  /** S90 TASK8: internal space / doubled letter / numeric suffix — not valid level ids. */
  it("rejects near-miss spellings that trim but do not normalize to S1…L4", () => {
    expect(arenaReflectLevelIdFromUnknown("S 1")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("L 4")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("SS1")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("S11")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("1S")).toBeNull();
  });

  it("rejects empty and non-strings", () => {
    expect(arenaReflectLevelIdFromUnknown("")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("   ")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown(null)).toBeNull();
    expect(arenaReflectLevelIdFromUnknown(1)).toBeNull();
  });

  /** S95 TASK8: NBSP / fullwidth / ZWSP — S94 `isArenaHiddenStatLabel` 라인과 다른 축. */
  it("rejects NBSP-only, fullwidth homoglyphs, and ZWSP inside id", () => {
    expect(arenaReflectLevelIdFromUnknown("\u00a0")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("\u00a0\u00a0")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("Ｓ1")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("S１")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("S\u200b1")).toBeNull();
    expect(arenaReflectLevelIdFromUnknown("L1\u200b")).toBeNull();
  });
});
