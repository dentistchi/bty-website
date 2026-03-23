import { describe, it, expect } from "vitest";
import {
  flagTagFromSlipReason,
  scenarioTokensFromScenarioId,
} from "./program-recommender.service";

describe("program-recommender.service", () => {
  it("flagTagFromSlipReason maps lockout and delta reasons", () => {
    expect(flagTagFromSlipReason("air_below_60_lockout")).toBe("lockout");
    expect(flagTagFromSlipReason("air_delta_below_negative_10pct_within_24h")).toBe(
      "air_delta_slip",
    );
    expect(flagTagFromSlipReason(null)).toBeNull();
  });

  it("scenarioTokensFromScenarioId extracts patient and team hints", () => {
    const t = scenarioTokensFromScenarioId("patient_refuses_treatment_001");
    expect(t.has("patient")).toBe(true);
    expect(t.has("general")).toBe(true);
  });
});
