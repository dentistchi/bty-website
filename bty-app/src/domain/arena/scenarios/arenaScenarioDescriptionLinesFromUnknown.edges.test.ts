/**
 * arenaScenarioDescriptionLinesFromUnknown — **S103** edges는 **S102** outcomes·**S101** lab 라인과 중복하지 않음.
 */
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

  /** S92 TASK11: per-element trim; internal `\n`/`\t` kept; max rows with padded cells (≠ interpretation caps). */
  it("preserves internal newlines and tabs inside one description line", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown(["  para1\npara2\tend  "])).toEqual(["para1\npara2\tend"]);
  });

  it("accepts max line count when every element has surrounding whitespace", () => {
    const padded = Array.from({ length: ARENA_SCENARIO_DESCRIPTION_MAX_LINES }, (_, i) => `  D${i}  `);
    const expected = Array.from({ length: ARENA_SCENARIO_DESCRIPTION_MAX_LINES }, (_, i) => `D${i}`);
    expect(arenaScenarioDescriptionLinesFromUnknown(padded)).toEqual(expected);
  });

  it("returns null when a middle array element trims to empty", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown(["ok", "\n\t  ", "tail"])).toBeNull();
  });

  /** S103 TASK8: explicit `null` element (JSON `[, "a"]` is not valid JSON; domain still rejects `null`). */
  it("returns null when an array element is null", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown([null, "a"] as unknown)).toBeNull();
  });

  /** S103 TASK8: sparse array — first slot is `undefined` (≠ S100 `description` string). */
  it("returns null when the array has a hole before a valid line", () => {
    const sparse: unknown[] = [];
    sparse[1] = "only";
    expect(arenaScenarioDescriptionLinesFromUnknown(sparse)).toBeNull();
  });

  /** S112 C3 TASK8: top-level JSON must be string[] — string/number (≠ S103 null element·sparse). */
  it("returns null when value is a string or number instead of an array", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown("not-array")).toBeNull();
    expect(arenaScenarioDescriptionLinesFromUnknown(42)).toBeNull();
  });

  /**
   * S125 C3 TASK8 — **S124** sub-name·**S112** string/number·**S123** interpretation 라인과 구분 (비배열 스칼라).
   */
  it("S125: returns null when value is Symbol or bigint", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown(Symbol("desc"))).toBeNull();
    expect(arenaScenarioDescriptionLinesFromUnknown(BigInt(1))).toBeNull();
  });

  /** S132 C3 TASK8 — **S125** Symbol·bigint·**S112** string/number와 구분 (비배열 객체 스칼라). */
  it("S132: returns null when value is a Date instance", () => {
    expect(arenaScenarioDescriptionLinesFromUnknown(new Date("2025-01-01"))).toBeNull();
  });
});
