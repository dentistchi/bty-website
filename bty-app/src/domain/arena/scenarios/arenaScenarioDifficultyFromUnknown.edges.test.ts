import { describe, it, expect } from "vitest";
import { arenaScenarioDifficultyFromUnknown } from "./arenaScenarioDifficultyFromUnknown";

describe("arenaScenarioDifficultyFromUnknown (edges)", () => {
  it("returns canonical union for exact spellings", () => {
    expect(arenaScenarioDifficultyFromUnknown("Low")).toBe("Low");
    expect(arenaScenarioDifficultyFromUnknown("Moderate")).toBe("Moderate");
    expect(arenaScenarioDifficultyFromUnknown("High")).toBe("High");
  });

  it("accepts case-insensitive low/moderate/high after trim", () => {
    expect(arenaScenarioDifficultyFromUnknown("  low ")).toBe("Low");
    expect(arenaScenarioDifficultyFromUnknown("MODERATE")).toBe("Moderate");
    expect(arenaScenarioDifficultyFromUnknown("high")).toBe("High");
  });

  it("returns null for empty, unknown words, or non-strings", () => {
    expect(arenaScenarioDifficultyFromUnknown("")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("   ")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("Medium")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("LOW ")).toBe("Low");
    expect(arenaScenarioDifficultyFromUnknown(null)).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown(1)).toBeNull();
  });
});
