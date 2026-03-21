import { describe, it, expect } from "vitest";
import { arenaActivatedHiddenStatsFromUnknown } from "./arenaActivatedHiddenStatsFromUnknown";

describe("arenaActivatedHiddenStatsFromUnknown (edges)", () => {
  it("returns HiddenStat[] when all elements are valid labels", () => {
    expect(arenaActivatedHiddenStatsFromUnknown(["Communication", "Integrity"])).toEqual([
      "Communication",
      "Integrity",
    ]);
    expect(arenaActivatedHiddenStatsFromUnknown(["Gratitude"])).toEqual(["Gratitude"]);
  });

  it("returns [] for an empty array", () => {
    expect(arenaActivatedHiddenStatsFromUnknown([])).toEqual([]);
  });

  it("returns null when value is not an array or a label is invalid", () => {
    expect(arenaActivatedHiddenStatsFromUnknown(null)).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown({})).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown(["Integrity", "unknown"])).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown(["integrity"])).toBeNull();
  });

  it("returns null when any element is not a string, is empty, or is a hole", () => {
    expect(arenaActivatedHiddenStatsFromUnknown(["Integrity", ""])).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown(["Integrity", 1])).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown([undefined])).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown(["Gratitude", null])).toBeNull();
  });

  it("preserves duplicate valid labels (no dedupe)", () => {
    expect(arenaActivatedHiddenStatsFromUnknown(["Insight", "Insight"])).toEqual(["Insight", "Insight"]);
  });
});
