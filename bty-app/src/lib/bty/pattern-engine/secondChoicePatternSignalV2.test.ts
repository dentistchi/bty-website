import { describe, expect, it } from "vitest";
import type { SecondChoice } from "@/domain/arena/scenarios/types";
import { validateSecondChoicePatternSignalInputV2 } from "./secondChoicePatternSignalV2";

describe("validateSecondChoicePatternSignalInputV2", () => {
  const exitOk: SecondChoice = {
    id: "X",
    label: "Opt",
    cost: "Cost A",
    direction: "exit",
    pattern_family: "repair_avoidance",
  };

  it("returns null for exit with canonical pattern_family", () => {
    expect(validateSecondChoicePatternSignalInputV2(exitOk)).toBeNull();
  });

  it("returns missing_pattern_family when exit has no pattern_family", () => {
    const { pattern_family: _p, ...rest } = exitOk;
    expect(validateSecondChoicePatternSignalInputV2(rest as SecondChoice)).toBe("missing_pattern_family");
  });

  it("returns missing_pattern_family when exit has empty pattern_family", () => {
    expect(
      validateSecondChoicePatternSignalInputV2({ ...exitOk, pattern_family: "   " }),
    ).toBe("missing_pattern_family");
  });

  it("returns invalid_pattern_family for non-canonical id", () => {
    expect(
      validateSecondChoicePatternSignalInputV2({ ...exitOk, pattern_family: "not_a_family" }),
    ).toBe("invalid_pattern_family");
  });

  it("returns invalid_second_choice_direction for bad direction", () => {
    expect(
      validateSecondChoicePatternSignalInputV2({
        ...exitOk,
        direction: "lateral",
      } as unknown as SecondChoice),
    ).toBe("invalid_second_choice_direction");
  });

  it("returns null for entry without pattern_family (no-op path)", () => {
    const entry: SecondChoice = {
      id: "Y",
      label: "Opt",
      cost: "Cost B",
      direction: "entry",
    };
    expect(validateSecondChoicePatternSignalInputV2(entry)).toBeNull();
  });
});
