import { describe, it, expect } from "vitest";
import {
  ARENA_MISSION_CHOICE_LABEL_MAX_LENGTH,
  ARENA_MISSION_CHOICE_SUBTITLE_MAX_LENGTH,
  ARENA_MISSION_CHOICE_TITLE_MAX_LENGTH,
  arenaPrimaryChoiceFromUnknown,
  arenaReinforcementChoiceFromUnknown,
} from "./arenaMissionChoiceShapeFromUnknown";

describe("arenaMissionChoiceShapeFromUnknown (edges)", () => {
  it("parses primary choice with optional subtitle", () => {
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: " B ",
        label: " B ",
        title: " Title ",
      }),
    ).toEqual({ id: "B", label: "B", title: "Title" });
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A",
        label: "A",
        title: "t",
        subtitle: " sub ",
      }),
    ).toEqual({ id: "A", label: "A", title: "t", subtitle: "sub" });
  });

  it("parses reinforcement choice", () => {
    expect(
      arenaReinforcementChoiceFromUnknown({
        id: "X",
        label: "X",
        title: "Reinforce",
      }),
    ).toEqual({ id: "X", label: "X", title: "Reinforce" });
  });

  it("returns null when shape, ids, or lengths are invalid", () => {
    expect(arenaPrimaryChoiceFromUnknown(null)).toBeNull();
    expect(arenaPrimaryChoiceFromUnknown([])).toBeNull();
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "D",
        label: "D",
        title: "t",
      }),
    ).toBeNull();
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A",
        label: "",
        title: "t",
      }),
    ).toBeNull();
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A",
        label: "a".repeat(ARENA_MISSION_CHOICE_LABEL_MAX_LENGTH + 1),
        title: "t",
      }),
    ).toBeNull();
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A",
        label: "A",
        title: "a".repeat(ARENA_MISSION_CHOICE_TITLE_MAX_LENGTH + 1),
      }),
    ).toBeNull();
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A",
        label: "A",
        title: "ok",
        subtitle: 1,
      }),
    ).toBeNull();
    expect(
      arenaReinforcementChoiceFromUnknown({
        id: "Z",
        label: "Z",
        title: "t",
      }),
    ).toBeNull();
  });

  it("rejects subtitle over max length (boundary) and ZWSP inside mission choice ids", () => {
    const okSub = "s".repeat(ARENA_MISSION_CHOICE_SUBTITLE_MAX_LENGTH);
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A",
        label: "A",
        title: "t",
        subtitle: ` ${okSub} `,
      }),
    ).toEqual({ id: "A", label: "A", title: "t", subtitle: okSub });

    const tooLongSub = "s".repeat(ARENA_MISSION_CHOICE_SUBTITLE_MAX_LENGTH + 1);
    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A",
        label: "A",
        title: "t",
        subtitle: tooLongSub,
      }),
    ).toBeNull();

    expect(
      arenaPrimaryChoiceFromUnknown({
        id: "A\u200b",
        label: "A",
        title: "t",
      }),
    ).toBeNull();
    expect(
      arenaReinforcementChoiceFromUnknown({
        id: "X\u200b",
        label: "X",
        title: "t",
      }),
    ).toBeNull();
  });

  /**
   * S136 C3 TASK8 — **S115** lenient `Symbol`·**S113** strict 타입·**S87** null/array 라인과 구분 (primary·reinforcement shape).
   */
  it("S136: returns null when value is Symbol or bigint", () => {
    expect(arenaPrimaryChoiceFromUnknown(Symbol("A"))).toBeNull();
    expect(arenaPrimaryChoiceFromUnknown(BigInt(1))).toBeNull();
    expect(arenaReinforcementChoiceFromUnknown(Symbol("X"))).toBeNull();
    expect(arenaReinforcementChoiceFromUnknown(BigInt(1))).toBeNull();
  });
});
