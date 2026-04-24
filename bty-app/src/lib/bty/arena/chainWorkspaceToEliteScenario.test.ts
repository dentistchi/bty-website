import { describe, expect, it } from "vitest";
import {
  buildEliteScenarioFromChainWorkspace,
  CHAIN_WORKSPACE_ELITE_IDS,
} from "./chainWorkspaceToEliteScenario.server";

describe("buildEliteScenarioFromChainWorkspace", () => {
  it("covers exactly the three chain-synced ids", () => {
    expect(CHAIN_WORKSPACE_ELITE_IDS).toHaveLength(3);
  });

  it("core_06: demotion / step-down story from S1; no DSO elite leakage", () => {
    const s = buildEliteScenarioFromChainWorkspace("core_06_lead_assistant");
    expect(s.pressure).toContain("step down");
    expect(s.pressure).not.toContain("pre-DSO");
    expect(s.escalationBranches?.A?.escalation_text).toContain("step down");
    expect(JSON.stringify(s)).not.toContain("pre-DSO");
  });

  it("core_11: chain S1 staffing story; no 34-patient / float-pool bundled copy", () => {
    const s = buildEliteScenarioFromChainWorkspace("core_11_staffing_collapse");
    expect(s.pressure).toContain("Two assistants called out");
    expect(s.pressure).not.toContain("34 patients");
    expect(JSON.stringify(s)).not.toContain("float pool");
  });

  it("core_01: step-2 primaries match chain S1 action lines; D is structural elite template", () => {
    const s = buildEliteScenarioFromChainWorkspace("core_01_training_system");
    expect(s.primaryChoices[0].label).toContain("write-up");
    expect(s.primaryChoices[3].label).toContain("Widen ownership");
    expect(s.tradeoff).toContain("Writing them up");
  });

  it("escalation branches embed chain S1–S3 narrative stack (no stub)", () => {
    const s = buildEliteScenarioFromChainWorkspace("core_01_training_system");
    const t = s.escalationBranches?.A?.escalation_text ?? "";
    expect(t.length).toBeGreaterThan(200);
    expect(t).toContain("A few days later");
  });
});
