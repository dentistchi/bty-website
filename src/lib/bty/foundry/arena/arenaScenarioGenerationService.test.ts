import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import { validateDifficultChoice } from "@/domain/foundry/arena-draft/quality";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

// --- mock the shared LLM seam so no live provider is ever contacted ----------
const mockCreate = vi.fn();
let available = true;
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => available,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { generateArenaScenarioDraft } from "./arenaScenarioGenerationService";

const facts: ModuleSourceFacts = {
  problem: "People skip the safety check under deadline pressure",
  observableBehavior: "Raise the risk before the shortcut is taken",
  successEvidence: "The check is logged",
  audienceType: "leaders",
  audienceDetail: null,
  learningNeeds: ["shared_standard"],
};
const guided: GuidedAnswers = {
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "no time" },
};

function aiContent(draft: ArenaScenarioDraft): { choices: { message: { content: string } }[] } {
  return { choices: [{ message: { content: JSON.stringify(draft) } }] };
}

// A difficult-choice-COMPLIANT AI draft: every option is a concrete, cost-bearing
// strategy, so it passes both the structural validator and the 3.2H quality gate.
const goodDraft: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "The deadline is hours away and you spot a safety gap. Flagging it stops the line; staying on schedule keeps the commitment but carries the risk.",
  primary: {
    choices: [
      { id: "primary_1", label: "Raise the risk now and accept that the deadline may slip" },
      { id: "primary_2", label: "Confirm the gap is real first, protecting your credibility while the risk keeps running" },
    ],
  },
  tradeoff: {
    escalationText: "Your manager pushes back hard and the deadline is now public.",
    choices: [
      { id: "tradeoff_1", label: "Hold your position and absorb the manager's pushback yourself" },
      { id: "tradeoff_2", label: "Escalate above your manager, accepting the damage to that relationship" },
    ],
  },
  actionDecision: {
    prompt: "What will you do now?",
    choices: [
      { id: "action_1", label: "Stop the line now and own the delay it causes", isActionCommitment: true },
      { id: "action_2", label: "Document the risk and flag it in writing to the safety lead, accepting that the line keeps running meanwhile", isActionCommitment: false },
    ],
  },
};

// The pre-3.2H obvious-answer shape — structurally valid but fails the quality gate.
const obviousDraft: ArenaScenarioDraft = {
  title: "Do the expected behavior",
  opening: "A realistic moment. The behavior is called for, but it lands in that moment. How do you begin?",
  primary: {
    choices: [
      { id: "primary_1", label: "Do it now, directly, in the moment" },
      { id: "primary_2", label: "Defer it to someone else or an easier time" },
    ],
  },
  tradeoff: {
    escalationText: "It gets harder and the cost of your first move becomes clear.",
    choices: [
      { id: "tradeoff_1", label: "Hold to the behavior you intended" },
      { id: "tradeoff_2", label: "Step back to stay safe" },
    ],
  },
  actionDecision: {
    prompt: "What will you do?",
    choices: [
      { id: "action_1", label: "Commit to taking the real action now", isActionCommitment: true },
      { id: "action_2", label: "Wait and prepare a little longer first", isActionCommitment: false },
    ],
  },
};

beforeEach(() => {
  mockCreate.mockReset();
  available = true;
});

describe("generateArenaScenarioDraft", () => {
  it("accepts VALID difficult-choice AI output and marks the source 'ai'", async () => {
    mockCreate.mockResolvedValue(aiContent(goodDraft));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.source).toBe("ai");
    expect(r.draft.title).toBe("Raising a risk under a deadline");
  });

  it("falls back to the template when AI output is an OBVIOUS-ANSWER draft (fails the quality gate)", async () => {
    mockCreate.mockResolvedValue(aiContent(obviousDraft));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.source).toBe("template");
  });

  it("falls back to the template on MALFORMED (non-JSON) AI output", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: "not json {{{" } }] });
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.source).toBe("template");
  });

  it("falls back to the template when AI JSON fails STRUCTURAL validation", async () => {
    const broken = { ...goodDraft, actionDecision: { prompt: "P", choices: [] } };
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(broken) } }] });
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.source).toBe("template");
  });

  it("falls back to the template when the provider THROWS", async () => {
    mockCreate.mockRejectedValue(new Error("network"));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.source).toBe("template");
  });

  it("uses the template when no provider is configured (never calls the client)", async () => {
    available = false;
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.source).toBe("template");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("always returns a structurally valid draft regardless of the path", async () => {
    mockCreate.mockRejectedValue(new Error("x"));
    const r = await generateArenaScenarioDraft({ locale: "ko", facts, guided });
    // the draft is validated inside the service; a template result is always valid
    expect(r.draft.primary.choices.length).toBeGreaterThanOrEqual(2);
    expect(r.draft.actionDecision.choices.some((c) => c.isActionCommitment)).toBe(true);
  });

  it("the deterministic template PASSES the difficult-choice quality gate (en + ko)", async () => {
    available = false; // force the template path
    for (const locale of ["en", "ko"] as const) {
      const r = await generateArenaScenarioDraft({ locale, facts, guided });
      expect(r.source).toBe("template");
      expect(validateDifficultChoice(r.draft).ok).toBe(true);
    }
  });
});
