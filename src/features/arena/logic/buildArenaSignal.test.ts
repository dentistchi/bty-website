import { describe, expect, it } from "vitest";
import { patientComplaintScenario } from "@/domain/arena/scenarios";
import { buildArenaSignal } from "./buildArenaSignal";

describe("buildArenaSignal", () => {
  it("maps A_X to traits and meta from scenario outcome", () => {
    const s = buildArenaSignal({
      scenario: patientComplaintScenario,
      selectedPrimary: "A",
      selectedReinforcement: "X",
    });
    expect(s).not.toBeNull();
    expect(s!.scenarioId).toBe("patient-complaint-revised-estimate");
    expect(s!.primary).toBe("A");
    expect(s!.reinforcement).toBe("X");
    expect(s!.traits.Communication).toBeCloseTo(0.82, 5);
    expect(s!.meta.relationalBias).toBeCloseTo(0.9, 5);
    expect(s!.timestamp).toBeGreaterThan(0);
  });

  it("returns null for unknown outcome key", () => {
    const s = buildArenaSignal({
      scenario: patientComplaintScenario,
      selectedPrimary: "Z",
      selectedReinforcement: "X",
    });
    expect(s).toBeNull();
  });
});
