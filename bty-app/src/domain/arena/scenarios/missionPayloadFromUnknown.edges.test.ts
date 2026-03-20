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
});
