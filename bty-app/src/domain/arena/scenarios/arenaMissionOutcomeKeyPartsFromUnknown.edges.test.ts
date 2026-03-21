import { describe, it, expect } from "vitest";
import {
  arenaMissionOutcomeKeyFromChoiceIds,
  arenaMissionOutcomeKeyPartsFromUnknown,
} from "./arenaMissionOutcomeKey";

describe("arenaMissionOutcomeKeyPartsFromUnknown (edges)", () => {
  it("parses valid A_X-style keys (trim + first underscore)", () => {
    expect(arenaMissionOutcomeKeyPartsFromUnknown("A_X")).toEqual({
      primaryId: "A",
      reinforcementId: "X",
    });
    expect(arenaMissionOutcomeKeyPartsFromUnknown("  B_Y  ")).toEqual({
      primaryId: "B",
      reinforcementId: "Y",
    });
    expect(arenaMissionOutcomeKeyPartsFromUnknown("C_ Y")).toEqual({
      primaryId: "C",
      reinforcementId: "Y",
    });
  });

  it("returns null when tokens are wrong or shape is invalid", () => {
    expect(arenaMissionOutcomeKeyPartsFromUnknown("")).toBeNull();
    expect(arenaMissionOutcomeKeyPartsFromUnknown("A")).toBeNull();
    expect(arenaMissionOutcomeKeyPartsFromUnknown("_X")).toBeNull();
    expect(arenaMissionOutcomeKeyPartsFromUnknown("A_")).toBeNull();
    expect(arenaMissionOutcomeKeyPartsFromUnknown("D_X")).toBeNull();
    expect(arenaMissionOutcomeKeyPartsFromUnknown("A_Z")).toBeNull();
    expect(arenaMissionOutcomeKeyPartsFromUnknown("a_X")).toBeNull();
    expect(arenaMissionOutcomeKeyPartsFromUnknown("A__X")).toBeNull();
  });

  it("returns null for non-strings; round-trips with FromChoiceIds", () => {
    expect(arenaMissionOutcomeKeyPartsFromUnknown(null)).toBeNull();
    const key = arenaMissionOutcomeKeyFromChoiceIds("A", " X");
    expect(key).toBe("A_X");
    expect(arenaMissionOutcomeKeyPartsFromUnknown(key)).toEqual({
      primaryId: "A",
      reinforcementId: "X",
    });
  });

  it("returns null when an extra underscore leaves reinforcement as a non-token (e.g. A_X_Y)", () => {
    expect(arenaMissionOutcomeKeyPartsFromUnknown("A_X_Y")).toBeNull();
  });
});
