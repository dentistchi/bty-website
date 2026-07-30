import { describe, it, expect } from "vitest";
import { buildTemplateScenarioDraft, type ScenarioGenInput } from "./arenaScenarioTemplate";
import { validateArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
import { validateBranchedScenario } from "@/domain/foundry/arena-draft/quality";
import { isBranchAware } from "@/domain/foundry/arena-draft/types";

const facts = {
  problem: "People skip the safety check under deadline pressure",
  observableBehavior: "Raise the risk before the shortcut is taken",
  successEvidence: "The check is logged",
  audienceType: "leaders" as const,
  audienceDetail: null,
  learningNeeds: ["shared_standard" as const],
};

function input(locale: "en" | "ko"): ScenarioGenInput {
  return { locale, facts, guided: { hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "there isn't enough time" } } };
}

describe("deterministic template — branch-aware (Slice 3.2I)", () => {
  for (const locale of ["en", "ko"] as const) {
    it(`produces one branch per primary choice, ${locale}`, () => {
      const draft = buildTemplateScenarioDraft(input(locale));
      expect(isBranchAware(draft)).toBe(true);
      const primaryIds = draft.primary.choices.map((c) => c.id).sort();
      expect(Object.keys(draft.branches!).sort()).toEqual(primaryIds);
    });

    it(`passes structural + difficult-choice validation on every branch, ${locale}`, () => {
      const draft = buildTemplateScenarioDraft(input(locale));
      expect(validateArenaScenarioDraft(draft).ok).toBe(true);
      expect(validateBranchedScenario(draft).errors).toEqual([]);
    });

    it(`gives each branch a distinct escalation (not one shared continuation), ${locale}`, () => {
      const draft = buildTemplateScenarioDraft(input(locale));
      const escalations = Object.values(draft.branches!).map((b) => b.escalationText);
      expect(new Set(escalations).size).toBe(escalations.length);
    });
  }
});
