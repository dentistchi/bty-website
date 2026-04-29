import { describe, it, expect } from "vitest";
import { HEALING_PHASE_ORDER } from "./healing-phase.service";
import {
  PHASE_GATE_MAP,
  getPhaseDiagnosticPrompts,
  healingJourneyPhaseIdToEnginePhase,
  enginePhaseToHealingJourneyPhaseId,
} from "./healing-content.service";

describe("healing-content.service", () => {
  it("PHASE_GATE_MAP lists every phase with non-empty growing requirements", () => {
    for (const p of HEALING_PHASE_ORDER) {
      expect(PHASE_GATE_MAP[p].length).toBeGreaterThan(0);
    }
    expect(PHASE_GATE_MAP.ACKNOWLEDGEMENT.length).toBe(1);
    expect(PHASE_GATE_MAP.RENEWAL.length).toBe(5);
  });

  it("getPhaseDiagnosticPrompts returns Korean strings matching gate count", () => {
    const p = healingJourneyPhaseIdToEnginePhase(3);
    const prompts = getPhaseDiagnosticPrompts(p);
    expect(prompts.length).toBe(PHASE_GATE_MAP[p].length);
    expect(prompts.every((s) => s.length > 0)).toBe(true);
  });

  it("round-trips journey id ↔ engine phase", () => {
    expect(enginePhaseToHealingJourneyPhaseId("REFLECTION")).toBe(2);
    expect(healingJourneyPhaseIdToEnginePhase(4)).toBe("RENEWAL");
  });
});
