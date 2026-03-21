import { describe, it, expect } from "vitest";
import { getArenaOutcome, getArenaOutcomeKey } from "./types";
import { getScenarioById, patientComplaintScenario } from "./mockScenario";
import { patientComplaintScenarioKo } from "./patientComplaintScenarioKo";
import { resolveMissionAgainstScenario } from "./missionStorage";

describe("Arena scenario outcomes (1+1 model)", () => {
  it("builds outcome keys from primary + reinforcement ids", () => {
    expect(getArenaOutcomeKey("A", "X")).toBe("A_X");
    expect(getArenaOutcomeKey("C", "Y")).toBe("C_Y");
  });

  it("resolves all six combinations for patient complaint scenario", () => {
    const combos = [
      ["A", "X"],
      ["A", "Y"],
      ["B", "X"],
      ["B", "Y"],
      ["C", "X"],
      ["C", "Y"],
    ] as const;
    for (const [p, r] of combos) {
      const o = getArenaOutcome(patientComplaintScenario, p, r);
      expect(o).not.toBeNull();
      expect(o!.interpretation.length).toBeGreaterThanOrEqual(2);
      expect(o!.activatedStats.length).toBeGreaterThanOrEqual(1);
      expect(o!.systemMessage.startsWith("SYSTEM //")).toBe(true);
    }
  });

  it("resolveMissionAgainstScenario attaches outcome from payload", () => {
    const resolved = resolveMissionAgainstScenario({
      scenarioId: patientComplaintScenario.id,
      selectedPrimaryId: "B",
      selectedReinforcementId: "Y",
      decidedAt: "",
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.outcome?.interpretation[0]).toContain("operational anchoring");
  });

  it("getScenarioById returns Korean copy when locale is ko", () => {
    const ko = getScenarioById(patientComplaintScenario.id, "ko");
    expect(ko?.title).toBe(patientComplaintScenarioKo.title);
    expect(ko?.description[0]).toBe(patientComplaintScenarioKo.description[0]);
  });

  it("resolveMissionAgainstScenario uses Korean outcome copy when locale is ko", () => {
    const resolved = resolveMissionAgainstScenario(
      {
        scenarioId: patientComplaintScenario.id,
        selectedPrimaryId: "B",
        selectedReinforcementId: "Y",
        decidedAt: "",
      },
      "ko",
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.outcome?.interpretation[0]).toContain("운영");
  });
});
