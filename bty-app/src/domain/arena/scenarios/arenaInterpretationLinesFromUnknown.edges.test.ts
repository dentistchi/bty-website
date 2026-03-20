import { describe, it, expect } from "vitest";
import {
  ARENA_INTERPRETATION_LINE_MAX_LENGTH,
  ARENA_INTERPRETATION_MAX_LINES,
  arenaInterpretationLinesFromUnknown,
} from "./arenaInterpretationLinesFromUnknown";

describe("arenaInterpretationLinesFromUnknown (edges)", () => {
  it("returns trimmed non-empty lines for a valid string array", () => {
    expect(arenaInterpretationLinesFromUnknown(["  a  ", "b"])).toEqual(["a", "b"]);
  });

  it("returns empty array for empty input array", () => {
    expect(arenaInterpretationLinesFromUnknown([])).toEqual([]);
  });

  it("returns null when value is not an array, over max lines, or any item is invalid", () => {
    expect(arenaInterpretationLinesFromUnknown(null)).toBeNull();
    expect(arenaInterpretationLinesFromUnknown({})).toBeNull();
    expect(arenaInterpretationLinesFromUnknown(["ok", 1])).toBeNull();
    expect(arenaInterpretationLinesFromUnknown(["ok", ""])).toBeNull();
    expect(arenaInterpretationLinesFromUnknown(["   "])).toBeNull();
    expect(arenaInterpretationLinesFromUnknown(["a".repeat(ARENA_INTERPRETATION_LINE_MAX_LENGTH + 1)])).toBeNull();
    expect(
      arenaInterpretationLinesFromUnknown(
        Array.from({ length: ARENA_INTERPRETATION_MAX_LINES + 1 }, (_, i) => `x${i}`),
      ),
    ).toBeNull();
  });

  it("accepts boundary line length and max line count", () => {
    const line = "x".repeat(ARENA_INTERPRETATION_LINE_MAX_LENGTH);
    expect(arenaInterpretationLinesFromUnknown([line])).toEqual([line]);
    const maxLines = Array.from({ length: ARENA_INTERPRETATION_MAX_LINES }, (_, i) => `L${i}`);
    expect(arenaInterpretationLinesFromUnknown(maxLines)).toEqual(maxLines);
  });
});
