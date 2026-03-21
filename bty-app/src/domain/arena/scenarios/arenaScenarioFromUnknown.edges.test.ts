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
});
