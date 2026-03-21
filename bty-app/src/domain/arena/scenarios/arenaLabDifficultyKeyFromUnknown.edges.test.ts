/**
 * arenaLabDifficultyKeyFromUnknown — 경계 (S89 TASK8 / C3).
 */
import { describe, it, expect } from "vitest";
import {
  arenaLabDifficultyKeyFromUnknown,
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
});
