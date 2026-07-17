import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
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

const goodDraft: ArenaScenarioDraft = {
  title: "AI title",
  opening: "AI opening situation that is realistic.",
  primary: {
    choices: [
      { id: "primary_1", label: "Raise it now" },
      { id: "primary_2", label: "Ask first" },
    ],
  },
  tradeoff: {
    escalationText: "The manager pushes back and time runs out.",
    choices: [
      { id: "tradeoff_1", label: "Hold position" },
      { id: "tradeoff_2", label: "Defer" },
    ],
  },
  actionDecision: {
    prompt: "What will you do?",
    choices: [
      { id: "action_1", label: "Act now", isActionCommitment: true },
      { id: "action_2", label: "Wait", isActionCommitment: false },
    ],
  },
};

beforeEach(() => {
  mockCreate.mockReset();
  available = true;
});

describe("generateArenaScenarioDraft", () => {
  it("accepts VALID AI output and marks the source 'ai'", async () => {
    mockCreate.mockResolvedValue(aiContent(goodDraft));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.source).toBe("ai");
    expect(r.draft.title).toBe("AI title");
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
});
