import { describe, it, expect } from "vitest";
import {
  arenaOutcomeTraitWeightFromUnknown,
  arenaOutcomeTraitsPartialFromUnknown,
} from "./arenaOutcomeTraitsFromUnknown";

describe("arenaOutcomeTraitWeightFromUnknown (edges)", () => {
  it("clamps finite numbers into [0, 1]", () => {
    expect(arenaOutcomeTraitWeightFromUnknown(0)).toBe(0);
    expect(arenaOutcomeTraitWeightFromUnknown(0.25)).toBe(0.25);
    expect(arenaOutcomeTraitWeightFromUnknown(1)).toBe(1);
    expect(arenaOutcomeTraitWeightFromUnknown(-3)).toBe(0);
    expect(arenaOutcomeTraitWeightFromUnknown(1.01)).toBe(1);
  });

  it("returns null for non-numbers and non-finite values", () => {
    expect(arenaOutcomeTraitWeightFromUnknown("0.5")).toBeNull();
    expect(arenaOutcomeTraitWeightFromUnknown(null)).toBeNull();
    expect(arenaOutcomeTraitWeightFromUnknown(NaN)).toBeNull();
    expect(arenaOutcomeTraitWeightFromUnknown(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("arenaOutcomeTraitsPartialFromUnknown (edges)", () => {
  it("returns {} for empty object; ignores non–HiddenStat keys", () => {
    expect(arenaOutcomeTraitsPartialFromUnknown({})).toEqual({});
    expect(arenaOutcomeTraitsPartialFromUnknown({ noise: 0.5, foo: "x" })).toEqual({});
  });

  it("keeps only valid HiddenStat keys with clamped weights", () => {
    expect(
      arenaOutcomeTraitsPartialFromUnknown({
        Integrity: 0.5,
        Communication: -1,
        Resilience: 2,
      }),
    ).toEqual({
      Integrity: 0.5,
      Communication: 0,
      Resilience: 1,
    });
  });

  it("returns null when the value is not a plain object or a stat weight is invalid", () => {
    expect(arenaOutcomeTraitsPartialFromUnknown(null)).toBeNull();
    expect(arenaOutcomeTraitsPartialFromUnknown([])).toBeNull();
    expect(arenaOutcomeTraitsPartialFromUnknown({ Integrity: NaN })).toBeNull();
    expect(arenaOutcomeTraitsPartialFromUnknown({ Insight: "0.2" })).toBeNull();
  });
});
