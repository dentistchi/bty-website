import { describe, expect, it } from "vitest";
import { eliteScenarioToScenario, getEliteScenarioById } from "./eliteScenariosCanonical.server";

describe("eliteScenarioToScenario canonical db binding", () => {
  it("maps core_01 json id to canonical base dbScenarioId", () => {
    const elite = getEliteScenarioById("core_01_training_system");
    const scenario = eliteScenarioToScenario(elite, "en");

    expect(scenario.scenarioId).toBe("core_01_training_system");
    expect(scenario.dbScenarioId).toBe("INCIDENT-01-OWN-01");
    expect(scenario.dbScenarioId).not.toBe(scenario.scenarioId);
  });

  it("uses canonical base primary dbChoiceId mapping for core_01", () => {
    const elite = getEliteScenarioById("core_01_training_system");
    const scenario = eliteScenarioToScenario(elite, "en");
    const primaryA = scenario.choices.find((c) => c.choiceId === "A");

    expect(primaryA?.dbChoiceId).toBe("INCIDENT-01-OWN-01_primary_A");
  });
});
