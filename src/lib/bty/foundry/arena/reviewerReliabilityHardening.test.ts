import { describe, expect, it } from "vitest";
import { boundaryAppearsInLearnerWorld } from "@/domain/foundry/arena-draft/boundaryGrounding";
import { REVIEW_SYSTEM_PROMPT } from "./arenaScenarioGenerationService";

describe("reviewer reliability hardening", () => {
  const rule = "Two identifiers must be verified before treatment";

  it("refuses a boundary-blind learner world before narrow review can call it compliant", () => {
    expect(boundaryAppearsInLearnerWorld(rule, "Stagger notifications and assign backlog tasks.")).toBe(false);
  });

  it("keeps a rule-engaged, difficult learner world eligible for semantic review", () => {
    expect(boundaryAppearsInLearnerWorld(rule, "Verify both patient identifiers before treatment, then decide how to communicate the resulting delay.")).toBe(true);
  });

  it("tells broad review that declared boundary coverage is not proof", () => {
    expect(REVIEW_SYSTEM_PROMPT).toContain("boundaryCompliance is a generator claim / declared coverage reference, never proof");
    expect(REVIEW_SYSTEM_PROMPT).toContain("Independently judge the visible label and action");
  });
});
