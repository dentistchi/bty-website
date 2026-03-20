import { describe, it, expect } from "vitest";
import {
  ARENA_SCENARIO_CASE_TAG_MAX_LENGTH,
  ARENA_SCENARIO_STAGE_MAX_LENGTH,
  ARENA_SCENARIO_TITLE_MAX_LENGTH,
  arenaScenarioCopyFieldsFromUnknown,
} from "./arenaScenarioCopyFieldsFromUnknown";

describe("arenaScenarioCopyFieldsFromUnknown (edges)", () => {
  it("returns trimmed copy fields when all three are valid strings", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "  S1 ",
        caseTag: " ER ",
        title: " T ",
      }),
    ).toEqual({ stage: "S1", caseTag: "ER", title: "T" });
  });

  it("returns null when value is not a plain object or any field is missing/invalid", () => {
    expect(arenaScenarioCopyFieldsFromUnknown(null)).toBeNull();
    expect(arenaScenarioCopyFieldsFromUnknown([])).toBeNull();
    expect(arenaScenarioCopyFieldsFromUnknown({ stage: "a", caseTag: "b" })).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "",
        caseTag: "b",
        title: "c",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "a",
        caseTag: "b",
        title: "c",
        noise: 1,
      }),
    ).toEqual({ stage: "a", caseTag: "b", title: "c" });
  });

  it("returns null when any field exceeds its max length", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "x".repeat(ARENA_SCENARIO_STAGE_MAX_LENGTH + 1),
        caseTag: "y",
        title: "z",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "s",
        caseTag: "x".repeat(ARENA_SCENARIO_CASE_TAG_MAX_LENGTH + 1),
        title: "z",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "s",
        caseTag: "c",
        title: "x".repeat(ARENA_SCENARIO_TITLE_MAX_LENGTH + 1),
      }),
    ).toBeNull();
  });

  it("accepts boundary lengths", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "a".repeat(ARENA_SCENARIO_STAGE_MAX_LENGTH),
        caseTag: "b".repeat(ARENA_SCENARIO_CASE_TAG_MAX_LENGTH),
        title: "c".repeat(ARENA_SCENARIO_TITLE_MAX_LENGTH),
      }),
    ).toEqual({
      stage: "a".repeat(ARENA_SCENARIO_STAGE_MAX_LENGTH),
      caseTag: "b".repeat(ARENA_SCENARIO_CASE_TAG_MAX_LENGTH),
      title: "c".repeat(ARENA_SCENARIO_TITLE_MAX_LENGTH),
    });
  });
});
