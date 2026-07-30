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

import { generateArenaScenarioDraft, isFixedAnswerTraining } from "./arenaScenarioGenerationService";

const facts: ModuleSourceFacts = {
  // A clean judgment topic (no mandatory-constraint domain) so it classifies judgment_only.
  problem: "A teammate proposes cutting a planned design review to hit the deadline",
  observableBehavior: "Raise the concern before the shortcut is taken",
  successEvidence: "The concern is recorded",
  audienceType: "leaders",
  audienceDetail: null,
  learningNeeds: ["decide"],
};
const guided: GuidedAnswers = {
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "raising it feels like slowing everyone down" },
};

function aiContent(draft: ArenaScenarioDraft): { choices: { message: { content: string } }[] } {
  return { choices: [{ message: { content: JSON.stringify(draft) } }] };
}

// A concrete-scene, branch-aware, incident-SPECIFIC AI draft — clears every runtime gate.
const goodDraft: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: {
    choices: [
      { id: "primary_1", label: "Raise the risk with the team now and stop the line" },
      { id: "primary_2", label: "Verify the gap yourself first, then decide whether to stop" },
    ],
  },
  tradeoff: {
    escalationText: "Your manager pushes back hard and the deadline is now public.",
    choices: [
      { id: "ft1", label: "Tell the manager plainly and own the call yourself" },
      { id: "ft2", label: "Escalate above the manager, accepting the strain it causes" },
    ],
  },
  actionDecision: {
    prompt: "What will you do now?",
    choices: [
      { id: "fa1", label: "Stop the line now and own the delay it causes", isActionCommitment: true },
      { id: "fa2", label: "Document the gap and flag it in writing, accepting the line keeps running", isActionCommitment: false },
    ],
  },
  branches: {
    primary_1: {
      escalationText: "You stop the line, and the plant manager confronts you in front of the crew, demanding to know who authorized the shutdown.",
      tradeoffChoices: [
        { id: "p1_t1", label: "Hold the line stopped until the gap is fixed, accepting the manager's anger" },
        { id: "p1_t2", label: "Restart under a documented watch, accepting the residual risk" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p1_a1", label: "Keep it stopped and put your reasons in writing now", isActionCommitment: true },
          { id: "p1_a2", label: "Restart with a monitor and re-check within the hour, accepting the exposure", isActionCommitment: false },
        ],
      },
    },
    primary_2: {
      escalationText: "While you verify, a unit ships with the suspected defect and a customer calls back within the hour asking why it was not caught.",
      tradeoffChoices: [
        { id: "p2_t1", label: "Recall the shipped unit now and absorb the cost, accepting the delay to others" },
        { id: "p2_t2", label: "Contain it to the affected order, accepting that the flawed unit stays out" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p2_a1", label: "Issue the recall now and own the disruption", isActionCommitment: true },
          { id: "p2_a2", label: "Confirm the defect scope first, accepting more may ship meanwhile", isActionCommitment: false },
        ],
      },
    },
  },
};

beforeEach(() => {
  mockCreate.mockReset();
  available = true;
});

describe("generateArenaScenarioDraft — LIVE-model only (Slice 3.2I-R2)", () => {
  it("returns a valid AI draft (source 'ai') when the provider clears every gate", async () => {
    mockCreate.mockResolvedValue(aiContent(goodDraft));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source).toBe("ai");
      expect(r.value.draft.title).toBe("Raising a risk under a deadline");
    }
  });

  it("FAILS SAFE (generation_unavailable) when no provider is configured — never a deterministic scenario", async () => {
    available = false;
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("FAILS SAFE (generation_failed) when the provider THROWS (transport failure)", async () => {
    mockCreate.mockRejectedValue(new Error("network"));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_failed" });
  });

  it("rejects MALFORMED (non-JSON) provider output", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: "not json {{{" } }] });
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("rejects STRUCTURALLY invalid provider output", async () => {
    const broken = { ...goodDraft, actionDecision: { prompt: "P", choices: [] } };
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(broken) } }] });
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("rejects an OBVIOUS-ANSWER draft (fails the difficult-choice gate)", async () => {
    const obvious = {
      ...goodDraft,
      branches: {
        primary_1: { ...goodDraft.branches!.primary_1, tradeoffChoices: [{ id: "p1_t1", label: "Do nothing and hope it resolves" }, { id: "p1_t2", label: "Fix it" }] },
        primary_2: goodDraft.branches!.primary_2,
      },
    };
    mockCreate.mockResolvedValue(aiContent(obvious as ArenaScenarioDraft));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("rejects an ABSTRACT (non-scene) draft", async () => {
    const abstract = { ...goodDraft, opening: "A realistic moment. The behavior is called for. What do you protect first?" };
    mockCreate.mockResolvedValue(aiContent(abstract));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("rejects a NON-branch-aware (flat) draft — a real Practice must branch", async () => {
    const flat: ArenaScenarioDraft = { ...goodDraft };
    delete flat.branches;
    mockCreate.mockResolvedValue(aiContent(flat));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("rejects PARAPHRASED branches (not incident-specific)", async () => {
    const esc = "The plant manager confronts you in front of the crew, demanding to know who authorized the shutdown.";
    const para = {
      ...goodDraft,
      branches: {
        primary_1: { ...goodDraft.branches!.primary_1, escalationText: esc },
        primary_2: { ...goodDraft.branches!.primary_2, escalationText: esc },
      },
    };
    mockCreate.mockResolvedValue(aiContent(para as ArenaScenarioDraft));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("DECLINES fixed-answer KNOW/COMPLIANCE trainings (no false dilemma)", async () => {
    mockCreate.mockResolvedValue(aiContent(goodDraft));
    const knowFacts: ModuleSourceFacts = { ...facts, learningNeeds: ["know"] };
    const r = await generateArenaScenarioDraft({ locale: "en", facts: knowFacts, guided });
    expect(r).toMatchObject({ ok: false, reason: "fixed_answer_knowledge" });
    expect(mockCreate).not.toHaveBeenCalled(); // declined before any provider call
  });

  it("FAILS SAFE (safety_boundary_unresolved) when a safety domain is implied but not established", async () => {
    mockCreate.mockResolvedValue(aiContent(goodDraft));
    const ambiguous: ModuleSourceFacts = { ...facts, problem: "There is a patient safety concern the team keeps raising", observableBehavior: null };
    const r = await generateArenaScenarioDraft({ locale: "en", facts: ambiguous, guided });
    expect(r).toMatchObject({ ok: false, reason: "safety_boundary_unresolved" });
    expect(mockCreate).not.toHaveBeenCalled(); // declined before any provider call
  });

  it("MIXED content: rejects a draft whose choice violates a non-negotiable constraint", async () => {
    const violating = { ...goodDraft, branches: { primary_1: { ...goodDraft.branches!.primary_1, tradeoffChoices: [{ id: "p1_t1", label: "Skip the required check to protect the schedule" }, { id: "p1_t2", label: "Complete the check and delay treatment" }] }, primary_2: goodDraft.branches!.primary_2 } };
    mockCreate.mockResolvedValue(aiContent(violating as ArenaScenarioDraft));
    const mixed: ModuleSourceFacts = { ...facts, problem: "Two patient identifiers must be verified before treatment. Decide how to pause, reassign, and notify.", learningNeeds: ["decide"] };
    const r = await generateArenaScenarioDraft({ locale: "en", facts: mixed, guided });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(mockCreate).toHaveBeenCalled(); // mixed content DID attempt generation, then rejected
  });

  it("MIXED content: accepts a constraint-compliant draft", async () => {
    mockCreate.mockResolvedValue(aiContent(goodDraft));
    const mixed: ModuleSourceFacts = { ...facts, problem: "Two patient identifiers must be verified before treatment. Decide how to pause, reassign, and notify.", learningNeeds: ["decide"] };
    const r = await generateArenaScenarioDraft({ locale: "en", facts: mixed, guided });
    expect(r.ok).toBe(true);
  });
});

describe("isFixedAnswerTraining", () => {
  it("declines a pure-KNOW training", () => {
    expect(isFixedAnswerTraining({ ...facts, learningNeeds: ["know"] })).toBe(true);
  });
  it("allows judgment needs (decide / practice / shared_standard)", () => {
    expect(isFixedAnswerTraining({ ...facts, learningNeeds: ["decide"] })).toBe(false);
    expect(isFixedAnswerTraining({ ...facts, learningNeeds: ["know", "decide"] })).toBe(false);
    expect(isFixedAnswerTraining({ ...facts, learningNeeds: ["shared_standard"] })).toBe(false);
  });
  it("allows an unspecified need set (lets the gates decide)", () => {
    expect(isFixedAnswerTraining({ ...facts, learningNeeds: [] })).toBe(false);
  });
});
