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

  /** S92 TASK8: per-element trim only; internal `\n`/`\t` are kept; max count with padded rows. */
  it("preserves internal newlines and tabs inside one interpretation line", () => {
    expect(arenaInterpretationLinesFromUnknown(["  first\nsecond\tbit  "])).toEqual(["first\nsecond\tbit"]);
  });

  it("accepts max line count when every element has surrounding whitespace", () => {
    const padded = Array.from({ length: ARENA_INTERPRETATION_MAX_LINES }, (_, i) => `  L${i}  `);
    const expected = Array.from({ length: ARENA_INTERPRETATION_MAX_LINES }, (_, i) => `L${i}`);
    expect(arenaInterpretationLinesFromUnknown(padded)).toEqual(expected);
  });

  /** S104 TASK12 — `arenaInterpretationLinesFromUnknown` (TASK8·9 copyFields·reflect 라인과 구분). */
  it("returns null when any element is a boxed String object", () => {
    expect(arenaInterpretationLinesFromUnknown([new String("a")])).toBeNull();
    expect(arenaInterpretationLinesFromUnknown(["ok", new String("b")])).toBeNull();
  });

  it("returns null for sparse arrays (holes yield non-string elements)", () => {
    expect(arenaInterpretationLinesFromUnknown([, "ok"])).toBeNull();
    expect(arenaInterpretationLinesFromUnknown([,])).toBeNull();
  });

  /**
   * S146 C3 TASK8 — **S123** 동일 축 — top-level **`Symbol`** / **`bigint`** → **null** (최상위 비배열).
   */
  it("S146: returns null when value is Symbol or bigint", () => {
    expect(arenaInterpretationLinesFromUnknown(Symbol("arr"))).toBeNull();
    expect(arenaInterpretationLinesFromUnknown(BigInt(1))).toBeNull();
  });
});
