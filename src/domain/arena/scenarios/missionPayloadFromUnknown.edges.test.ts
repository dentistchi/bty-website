import { describe, it, expect } from "vitest";
import { normalizeArenaMissionPayloadFromUnknown } from "./missionPayloadFromUnknown";

describe("normalizeArenaMissionPayloadFromUnknown (edges)", () => {
  it("returns null for null, non-object, or array", () => {
    expect(normalizeArenaMissionPayloadFromUnknown(null)).toBeNull();
    expect(normalizeArenaMissionPayloadFromUnknown(undefined)).toBeNull();
    expect(normalizeArenaMissionPayloadFromUnknown("x")).toBeNull();
    expect(normalizeArenaMissionPayloadFromUnknown(1)).toBeNull();
    expect(normalizeArenaMissionPayloadFromUnknown([])).toBeNull();
  });

  it("returns null when any required id is missing or wrong type", () => {
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        selectedPrimaryId: "a",
        selectedReinforcementId: "b",
      }),
    ).toBeNull();
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "s",
        selectedPrimaryId: "a",
        selectedReinforcementId: 1,
      }),
    ).toBeNull();
  });

  it("defaults decidedAt to empty string when absent or not string", () => {
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "s",
        selectedPrimaryId: "p",
        selectedReinforcementId: "r",
      }),
    ).toEqual({
      scenarioId: "s",
      selectedPrimaryId: "p",
      selectedReinforcementId: "r",
      decidedAt: "",
    });
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "s",
        selectedPrimaryId: "p",
        selectedReinforcementId: "r",
        decidedAt: 99,
      }),
    ).toEqual({
      scenarioId: "s",
      selectedPrimaryId: "p",
      selectedReinforcementId: "r",
      decidedAt: "",
    });
  });

  it("preserves decidedAt when string", () => {
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "s",
        selectedPrimaryId: "p",
        selectedReinforcementId: "r",
        decidedAt: "2026-03-19T00:00:00.000Z",
      }),
    ).toEqual({
      scenarioId: "s",
      selectedPrimaryId: "p",
      selectedReinforcementId: "r",
      decidedAt: "2026-03-19T00:00:00.000Z",
    });
  });

  it("trims id fields and returns null when any id is empty after trim", () => {
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "  scen-1  ",
        selectedPrimaryId: " p ",
        selectedReinforcementId: "r",
      }),
    ).toEqual({
      scenarioId: "scen-1",
      selectedPrimaryId: "p",
      selectedReinforcementId: "r",
      decidedAt: "",
    });
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "   ",
        selectedPrimaryId: "p",
        selectedReinforcementId: "r",
      }),
    ).toBeNull();
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "s",
        selectedPrimaryId: "\t\n",
        selectedReinforcementId: "r",
      }),
    ).toBeNull();
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "s",
        selectedPrimaryId: "p",
        selectedReinforcementId: "\u00a0",
      }),
    ).toBeNull();
  });

  it("preserves internal spaces in ids; trims decidedAt only at ends", () => {
    expect(
      normalizeArenaMissionPayloadFromUnknown({
        scenarioId: "a b",
        selectedPrimaryId: "p\tq",
        selectedReinforcementId: "r",
        decidedAt: "  iso  ",
      }),
    ).toEqual({
      scenarioId: "a b",
      selectedPrimaryId: "p\tq",
      selectedReinforcementId: "r",
      decidedAt: "iso",
    });
  });
});
