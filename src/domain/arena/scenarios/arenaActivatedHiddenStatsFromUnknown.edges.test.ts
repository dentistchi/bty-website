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

  /**
   * S128 C3 TASK8 — **S127** system message·**S126** resolve-outcome 라인과 구분 (최상위 비배열).
   */
  it("S128: returns null when value is Symbol or bigint", () => {
    expect(arenaActivatedHiddenStatsFromUnknown(Symbol("stats"))).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown(BigInt(1))).toBeNull();
  });

  /**
   * S134 C3 TASK8 — 보드 **Symbol·bigint**는 **S128**; **추가** 비배열·컨테이너 (**S128**·**S90** near-miss와 구분).
   */
  it("S134: returns null when value is Date, RegExp, boxed String, or plain object", () => {
    expect(arenaActivatedHiddenStatsFromUnknown(new Date())).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown(/Integrity/)).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown(Object("Integrity"))).toBeNull();
    expect(arenaActivatedHiddenStatsFromUnknown({ 0: "Integrity" })).toBeNull();
  });
});
