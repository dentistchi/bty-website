import { describe, it, expect } from "vitest";
import { buildTemplateScenarioDraft } from "./arenaScenarioTemplate";
import { validateArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
import type { ModuleSourceFacts } from "./arenaScenarioSource";
import type { GuidedAnswers } from "@/domain/foundry/arena-draft/types";

const facts: ModuleSourceFacts = {
  problem: "People skip the safety check under deadline pressure",
  observableBehavior: "Raise the risk out loud before the shortcut is taken",
  successEvidence: "The check is completed and logged",
  audienceType: "job_group",
  audienceDetail: "Line supervisors",
  learningNeeds: ["shared_standard"],
};

const guided: GuidedAnswers = {
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "no time before the shift ends" },
};

describe("buildTemplateScenarioDraft — deterministic fallback", () => {
  it("produces a VALID three-phase draft in English", () => {
    const draft = buildTemplateScenarioDraft({ locale: "en", facts, guided });
    expect(validateArenaScenarioDraft(draft).ok).toBe(true);
  });

  it("produces a VALID three-phase draft in Korean", () => {
    const draft = buildTemplateScenarioDraft({ locale: "ko", facts, guided });
    expect(validateArenaScenarioDraft(draft).ok).toBe(true);
  });

  it("always includes at least one action commitment and one non-commitment", () => {
    const draft = buildTemplateScenarioDraft({ locale: "en", facts, guided });
    const commits = draft.actionDecision.choices.filter((c) => c.isActionCommitment);
    expect(commits.length).toBeGreaterThanOrEqual(1);
    expect(draft.actionDecision.choices.some((c) => !c.isActionCommitment)).toBe(true);
  });

  it("stays valid with an 'other' custom Q1 and empty module facts", () => {
    const draft = buildTemplateScenarioDraft({
      locale: "en",
      facts: { problem: null, observableBehavior: null, successEvidence: null, audienceType: null, audienceDetail: null, learningNeeds: [] },
      guided: { hardestWhen: { choice: "other", customText: "at handover" }, avoidancePressure: { text: "rushed" } },
    });
    expect(validateArenaScenarioDraft(draft).ok).toBe(true);
  });
});
