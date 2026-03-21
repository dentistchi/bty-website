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

  it("returns null when stage, caseTag, or title are non-strings", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: 1,
        caseTag: "b",
        title: "c",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "a",
        caseTag: null,
        title: "c",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "a",
        caseTag: "b",
        title: true,
      }),
    ).toBeNull();
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

  it("returns null when any field is whitespace-only after trim", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "\t \n",
        caseTag: "b",
        title: "c",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "a",
        caseTag: "   ",
        title: "c",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "a",
        caseTag: "b",
        title: "\t\n",
      }),
    ).toBeNull();
  });

  /** NBSP trims away; ZWSP (U+200B) is not stripped by String#trim — still non-empty. */
  it("treats NBSP-only fields as empty after trim but keeps lone ZWSP as content", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "\u00A0\u00A0",
        caseTag: "ok",
        title: "ok",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "ok",
        caseTag: "\u00A0",
        title: "ok",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "ok",
        caseTag: "ok",
        title: "\u00A0",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "\u200b",
        caseTag: "\u200b",
        title: "\u200b",
      }),
    ).toEqual({ stage: "\u200b", caseTag: "\u200b", title: "\u200b" });
  });

  /** S104 TASK8 — boxed String / BOM trim (S103 NBSP·ZWSP 라인과 구분). */
  it("returns null when any field is a boxed String object", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: new String("S1"),
        caseTag: "b",
        title: "c",
      }),
    ).toBeNull();
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "a",
        caseTag: new String("b"),
        title: "c",
      }),
    ).toBeNull();
  });

  it("trims BOM (U+FEFF) from copy fields to valid content", () => {
    expect(
      arenaScenarioCopyFieldsFromUnknown({
        stage: "\uFEFF S1",
        caseTag: "\uFEFFtag",
        title: "\uFEFFT",
      }),
    ).toEqual({ stage: "S1", caseTag: "tag", title: "T" });
  });

  /**
   * S131·S141 C3 TASK8 — **S130** scenario-difficulty·**S104** boxed `String` 라인과 구분 (최상위 비객체; **S141** explicit bigint/symbol guard).
   */
  it("S131: returns null when value is Symbol or bigint", () => {
    expect(arenaScenarioCopyFieldsFromUnknown(Symbol("copy"))).toBeNull();
    expect(arenaScenarioCopyFieldsFromUnknown(BigInt(1))).toBeNull();
  });
});
