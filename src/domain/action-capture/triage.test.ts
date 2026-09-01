import { describe, expect, it } from "vitest";
import {
  TRIAGE_CHOICES,
  isUntriaged,
  parseTriageChoice,
  triageGroupRank,
  triageStateOf,
} from "@/domain/action-capture/triage";

/**
 * The triage vocabulary, pinned (Slice T2).
 *
 * Two words and an absence. These tests exist mostly to keep a third word from ever appearing
 * quietly — a "priority", a "someday", a "done" — because the moment there is a third, this stops
 * being a decision and starts being a workflow.
 */

describe("the vocabulary is exactly two choices", () => {
  it("has no third value", () => {
    expect(TRIAGE_CHOICES).toEqual(["soon", "later"]);
  });

  it("models untriaged as null, not as a value", () => {
    expect(triageStateOf(null)).toBeNull();
    expect(triageStateOf(undefined)).toBeNull();
    expect(isUntriaged(null)).toBe(true);
    expect(isUntriaged("soon")).toBe(false);
  });
});

describe("parseTriageChoice — exact, and fail closed", () => {
  it("accepts soon and later", () => {
    expect(parseTriageChoice("soon")).toBe("soon");
    expect(parseTriageChoice("later")).toBe("later");
  });

  it("refuses everything else rather than normalising a guess", () => {
    // Near-misses are the interesting ones: a caller asking to record a decision with a value we
    // do not recognise has not told us what they decided.
    for (const v of ["SOON", " soon ", "Later", "someday", "done", "", null, undefined, 1, true, {}, ["soon"]]) {
      expect(parseTriageChoice(v)).toBeNull();
    }
  });

  it("reads an unexpected stored value back as untriaged rather than throwing", () => {
    // A surface must still render a row whose column holds something impossible.
    expect(triageStateOf("promoted")).toBeNull();
    expect(triageStateOf(42)).toBeNull();
  });
});

describe("triageGroupRank — undecided first", () => {
  it("orders undecided, then soon, then later", () => {
    expect(triageGroupRank(null)).toBe(0);
    expect(triageGroupRank("soon")).toBe(1);
    expect(triageGroupRank("later")).toBe(2);
    // The only group that asks anything of the person sorts to the top.
    expect(triageGroupRank(null)).toBeLessThan(triageGroupRank("soon"));
    expect(triageGroupRank("soon")).toBeLessThan(triageGroupRank("later"));
  });
});
