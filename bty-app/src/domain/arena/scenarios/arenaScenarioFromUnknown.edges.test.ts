/**
 * arenaScenarioFromUnknown — **S100** edges는 **S99** `arenaIsoTimestamp`·**S98** `arenaIsoDateOnly` 라인과 중복하지 않음.
 */
import { describe, it, expect } from "vitest";
import { arenaScenarioFromUnknown } from "./arenaScenarioFromUnknown";
import { patientComplaintScenario } from "./mockScenario";

describe("arenaScenarioFromUnknown (edges)", () => {
  it("returns ArenaScenario when all composed helpers accept the object", () => {
    expect(arenaScenarioFromUnknown(patientComplaintScenario)).toEqual(patientComplaintScenario);
  });

  it("returns null when value is not a plain object or any field fails", () => {
    expect(arenaScenarioFromUnknown(null)).toBeNull();
    expect(arenaScenarioFromUnknown([])).toBeNull();
    expect(arenaScenarioFromUnknown({})).toBeNull();
    expect(
      arenaScenarioFromUnknown({
        ...patientComplaintScenario,
        difficulty: "Extreme",
      }),
    ).toBeNull();
    expect(
      arenaScenarioFromUnknown({
        ...patientComplaintScenario,
        primaryChoices: patientComplaintScenario.primaryChoices.slice(0, 2),
      }),
    ).toBeNull();
  });

  /** S100 TASK8: `Date` is `object` but not a scenario-shaped record (`id` missing). */
  it("returns null when value is a Date instance", () => {
    expect(arenaScenarioFromUnknown(new Date("2026-01-01T00:00:00.000Z"))).toBeNull();
  });

  /** S100 TASK8: `description` must be normalized lines — raw string fails composition. */
  it("returns null when description is a string instead of string[]", () => {
    expect(
      arenaScenarioFromUnknown({
        ...patientComplaintScenario,
        description: "single line only",
      }),
    ).toBeNull();
  });

  /** S100 TASK8: `outcomes` must be a record — array fails `arenaScenarioOutcomesFromUnknown`. */
  it("returns null when outcomes is an array", () => {
    expect(
      arenaScenarioFromUnknown({
        ...patientComplaintScenario,
        outcomes: [],
      }),
    ).toBeNull();
  });
});
