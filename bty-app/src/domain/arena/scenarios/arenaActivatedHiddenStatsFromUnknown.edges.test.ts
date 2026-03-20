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
});
