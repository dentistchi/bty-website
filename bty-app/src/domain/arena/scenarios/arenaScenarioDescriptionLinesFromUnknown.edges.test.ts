import { describe, it, expect } from "vitest";
import {
  ARENA_SCENARIO_DESCRIPTION_LINE_MAX_LENGTH,
  ARENA_SCENARIO_DESCRIPTION_MAX_LINES,
  arenaScenarioDescriptionLinesFromUnknown,
} from "./arenaScenarioDescriptionLinesFromUnknown";

describe("arenaScenarioDescriptionLinesFromUnknown (edges)", () => {
  it("returns trimmed non-empty lines for a valid string array (1+ lines)", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown(["  a  ", "b"])).toEqual(["a", "b"]);
  });

  it("returns null for empty input array (description must have copy)", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown([])).toBeNull();
  });

  it("returns null when value is not an array, over max lines, or any item is invalid", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown(null)).toBeNull();
    expect(arenaScenarioDescriptionLinesFromUnknown({})).toBeNull();
    expect(arenaScenarioDescriptionLinesFromUnknown(["ok", 1])).toBeNull();
    expect(arenaScenarioDescriptionLinesFromUnknown(["ok", ""])).toBeNull();
    expect(arenaScenarioDescriptionLinesFromUnknown(["   "])).toBeNull();
    expect(
      arenaScenarioDescriptionLinesFromUnknown(["a".repeat(ARENA_SCENARIO_DESCRIPTION_LINE_MAX_LENGTH + 1)]),
    ).toBeNull();
    expect(
      arenaScenarioDescriptionLinesFromUnknown(
        Array.from({ length: ARENA_SCENARIO_DESCRIPTION_MAX_LINES + 1 }, (_, i) => `x${i}`),
      ),
    ).toBeNull();
  });

  it("accepts boundary line length and max line count", () => {
    const line = "x".repeat(ARENA_SCENARIO_DESCRIPTION_LINE_MAX_LENGTH);
    expect(arenaScenarioDescriptionLinesFromUnknown([line])).toEqual([line]);
    const maxLines = Array.from({ length: ARENA_SCENARIO_DESCRIPTION_MAX_LINES }, (_, i) => `L${i}`);
    expect(arenaScenarioDescriptionLinesFromUnknown(maxLines)).toEqual(maxLines);
  });
});
