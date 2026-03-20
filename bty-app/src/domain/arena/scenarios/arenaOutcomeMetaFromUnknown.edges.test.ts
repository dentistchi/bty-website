import { describe, it, expect } from "vitest";
import { arenaOutcomeMetaFromUnknown } from "./arenaOutcomeMetaFromUnknown";

describe("arenaOutcomeMetaFromUnknown (edges)", () => {
  it("returns clamped meta when all three fields are valid numbers", () => {
    expect(
      arenaOutcomeMetaFromUnknown({
        relationalBias: 0.9,
        operationalBias: 0.22,
        emotionalRegulation: 0.72,
      }),
    ).toEqual({
      relationalBias: 0.9,
      operationalBias: 0.22,
      emotionalRegulation: 0.72,
    });
    expect(
      arenaOutcomeMetaFromUnknown({
        relationalBias: -1,
        operationalBias: 0.5,
        emotionalRegulation: 2,
      }),
    ).toEqual({
      relationalBias: 0,
      operationalBias: 0.5,
      emotionalRegulation: 1,
    });
  });

  it("ignores extra keys", () => {
    expect(
      arenaOutcomeMetaFromUnknown({
        relationalBias: 0,
        operationalBias: 0,
        emotionalRegulation: 0,
        noise: "x",
      }),
    ).toEqual({
      relationalBias: 0,
      operationalBias: 0,
      emotionalRegulation: 0,
    });
  });

  it("returns null when value is not an object or any axis is missing/invalid", () => {
    expect(arenaOutcomeMetaFromUnknown(null)).toBeNull();
    expect(arenaOutcomeMetaFromUnknown([])).toBeNull();
    expect(arenaOutcomeMetaFromUnknown({ relationalBias: 0.5 })).toBeNull();
    expect(
      arenaOutcomeMetaFromUnknown({
        relationalBias: 0.5,
        operationalBias: 0.5,
        emotionalRegulation: NaN,
      }),
    ).toBeNull();
    expect(
      arenaOutcomeMetaFromUnknown({
        relationalBias: "0.5",
        operationalBias: 0.5,
        emotionalRegulation: 0.5,
      }),
    ).toBeNull();
  });
});
