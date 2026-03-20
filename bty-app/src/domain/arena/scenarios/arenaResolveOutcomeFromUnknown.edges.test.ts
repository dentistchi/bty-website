import { describe, it, expect } from "vitest";
import { arenaResolveOutcomeFromUnknown } from "./arenaResolveOutcomeFromUnknown";

describe("arenaResolveOutcomeFromUnknown (edges)", () => {
  it("returns ResolveOutcome when required fields parse and optional traits/meta omitted", () => {
    expect(
      arenaResolveOutcomeFromUnknown({
        interpretation: ["Line one", "Line two"],
        systemMessage: "SYSTEM // ok",
        activatedStats: ["Integrity"],
      }),
    ).toEqual({
      interpretation: ["Line one", "Line two"],
      systemMessage: "SYSTEM // ok",
      activatedStats: ["Integrity"],
    });
  });

  it("includes traits and meta when valid", () => {
    expect(
      arenaResolveOutcomeFromUnknown({
        interpretation: ["a"],
        systemMessage: "SYSTEM // x",
        activatedStats: ["Gratitude"],
        traits: { Integrity: 0.5 },
        meta: { relationalBias: 0.1, operationalBias: 0.2, emotionalRegulation: 0.3 },
      }),
    ).toEqual({
      interpretation: ["a"],
      systemMessage: "SYSTEM // x",
      activatedStats: ["Gratitude"],
      traits: { Integrity: 0.5 },
      meta: { relationalBias: 0.1, operationalBias: 0.2, emotionalRegulation: 0.3 },
    });
  });

  it("returns null when value is not a plain object or any required field fails", () => {
    expect(arenaResolveOutcomeFromUnknown(null)).toBeNull();
    expect(arenaResolveOutcomeFromUnknown([])).toBeNull();
    expect(
      arenaResolveOutcomeFromUnknown({
        interpretation: [],
        systemMessage: "SYSTEM // x",
        activatedStats: ["Integrity"],
      }),
    ).toBeNull();
    expect(
      arenaResolveOutcomeFromUnknown({
        interpretation: ["ok"],
        systemMessage: "",
        activatedStats: ["Insight"],
      }),
    ).toBeNull();
    expect(
      arenaResolveOutcomeFromUnknown({
        interpretation: ["ok"],
        systemMessage: "SYSTEM // x",
        activatedStats: ["UnknownStat"],
      }),
    ).toBeNull();
  });

  it("returns null when traits or meta present but invalid", () => {
    expect(
      arenaResolveOutcomeFromUnknown({
        interpretation: ["ok"],
        systemMessage: "SYSTEM // x",
        activatedStats: ["Insight"],
        traits: { Integrity: NaN },
      }),
    ).toBeNull();
    expect(
      arenaResolveOutcomeFromUnknown({
        interpretation: ["ok"],
        systemMessage: "SYSTEM // x",
        activatedStats: ["Insight"],
        meta: { relationalBias: 0, operationalBias: 0 },
      }),
    ).toBeNull();
  });
});
