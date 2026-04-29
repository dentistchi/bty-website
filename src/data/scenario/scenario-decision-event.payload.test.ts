import { describe, expect, it } from "vitest";
import { createScenarioDecisionEvent, getScenarioById } from "@/data/scenario";

describe("createScenarioDecisionEvent payload", () => {
  it("uses base DB mapping and marks AD1 as action commitment", () => {
    const runtime = getScenarioById("core_01_training_system_exposure", "en");
    expect(runtime).toBeTruthy();
    const event = createScenarioDecisionEvent({
      userId: "u_test",
      runtimeScenario: runtime!,
      primaryChoiceId: "A",
      secondChoiceId: "X",
      actionChoiceId: "AD1",
      timestamp: "2026-04-27T00:00:00.000Z",
    });

    expect(event.userId).toBe("u_test");
    expect(event.scenarioId).toBe(runtime!.scenarioId);
    expect(event.dbScenarioId).toBe(runtime!.dbScenarioId);
    expect(event.primaryDbChoiceId).toBe("INCIDENT-01-OWN-01_primary_A");
    expect(event.secondDbChoiceId).toBe("INCIDENT-01-OWN-01_tradeoff_A_X");
    expect(event.actionDbChoiceId).toBe("INCIDENT-01-OWN-01_action_A_X_AD1");
    expect(event.isActionCommitment).toBe(true);
  });

  it("marks AD2 as non-commitment for no_change risk accrual candidate", () => {
    const runtime = getScenarioById("core_01_training_system_exposure", "en");
    expect(runtime).toBeTruthy();
    const event = createScenarioDecisionEvent({
      userId: "u_test",
      runtimeScenario: runtime!,
      primaryChoiceId: "B",
      secondChoiceId: "X",
      actionChoiceId: "AD2",
    });

    expect(event.actionChoiceId).toBe("AD2");
    expect(event.actionDbChoiceId).toBe("INCIDENT-01-OWN-01_action_B_X_AD2");
    expect(event.isActionCommitment).toBe(false);
  });
});
