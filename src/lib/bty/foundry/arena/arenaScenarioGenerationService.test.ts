import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import type { ConstraintAssessment } from "@/domain/foundry/arena-draft/boundary";
import type { ProviderBoundaryGrounding } from "@/domain/foundry/arena-draft/boundaryGrounding";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview, compliantBoundaryReviewFor } from "@/domain/foundry/arena-draft/providerDto.fixture";
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

// R2.16 — the provider now answers in the PROVIDER DTO wire shape (no model-authored ids, branches
// as a positional array). Fixtures stay canonical for readability and are converted here.
function aiContent(
  draft: ArenaScenarioDraft,
  assessments?: Record<string, ConstraintAssessment[]>,
  grounding: ProviderBoundaryGrounding[] = [],
): { choices: { message: { content: string } }[] } {
  return { choices: [{ message: { content: providerJson(draft, assessments, grounding) } }] };
}
/**
 * R2.18 — the semantic reviewer now runs for EVERY generation, so a bare generation mock would also
 * answer the review call. Route by request type: generation gets the scenario, review gets an
 * ACCEPT verdict unless a test overrides it.
 */
function reviewContent(review: unknown) {
  return { choices: [{ message: { content: JSON.stringify(review) } }] };
}
function mockGenThenReview(
  draft: ArenaScenarioDraft,
  assessments?: Record<string, ConstraintAssessment[]>,
  review?: unknown,
  grounding: ProviderBoundaryGrounding[] = [],
  constraintIds: string[] = [],
) {
  mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
    // R2.29 — the narrow boundary stage runs FIRST; answer it before the broad review.
    isBoundaryReviewRequest(params)
      ? { choices: [{ message: { content: compliantBoundaryReview(params) } }] }
      : isReviewRequest(params)
        ? reviewContent(review ?? acceptReview(draft, {}, constraintIds))
        : aiContent(draft, assessments, grounding),
  );
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
      resultingWorldState: "The world after choosing primary_1: the situation has moved on and the earlier decision now holds.",
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
      resultingWorldState: "The world after choosing primary_2: the situation has moved on and the earlier decision now holds.",
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
    mockGenThenReview(goodDraft);
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
    mockGenThenReview(goodDraft);
    const knowFacts: ModuleSourceFacts = { ...facts, learningNeeds: ["know"] };
    const r = await generateArenaScenarioDraft({ locale: "en", facts: knowFacts, guided });
    expect(r).toMatchObject({ ok: false, reason: "fixed_answer_knowledge" });
    expect(mockCreate).not.toHaveBeenCalled(); // declined before any provider call
  });

  it("BLOCKS (boundary_confirmation_required) when a possible safety boundary is detected but not confirmed", async () => {
    mockGenThenReview(goodDraft);
    const mixed: ModuleSourceFacts = { ...facts, problem: "Two patient identifiers must be verified before treatment. Decide how to pause, reassign, and notify.", learningNeeds: ["decide"] };
    const r = await generateArenaScenarioDraft({ locale: "en", facts: mixed, guided }); // no confirmed boundary
    expect(r).toMatchObject({ ok: false, reason: "boundary_confirmation_required" });
    expect(mockCreate).not.toHaveBeenCalled(); // blocked before any provider call
  });
});

// --- Slice 3.2I-R4 — the CONFIRMED boundary is the generation authority --------------
const CONSTRAINTS = [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment", provenance: "manager_entered" as const }];
function assessAll(draft: ArenaScenarioDraft, ids: string[]): Record<string, ConstraintAssessment[]> {
  const map: Record<string, ConstraintAssessment[]> = {};
  const add = (id: string) => (map[id] = ids.map((cid) => ({ constraintId: cid, status: "satisfied" as const, rationale: "obeys" })));
  for (const c of [...draft.primary.choices, ...draft.tradeoff.choices, ...draft.actionDecision.choices]) add(c.id);
  for (const b of Object.values(draft.branches ?? {})) for (const c of [...b.tradeoffChoices, ...b.actionDecision.choices]) add(c.id);
  return map;
}
// R2.16 — assessments now ride NESTED on each choice in the provider DTO, so the canonical-id-keyed
// map is passed to the fixture converter instead of being a top-level provider field.
/**
 * R2.21 — a GROUNDED constrained draft. The old fixture reused `goodDraft`, which never mentions
 * identity verification at all: it proved only that a scenario silent about the rule passes, which
 * is precisely the measured c18 defect. The rule is now established in the opening AND decided
 * about in the choices, so the difficulty is WHO verifies and WHEN the line pauses — never whether.
 */
const groundedDraft: ArenaScenarioDraft = {
  ...goodDraft,
  opening: `${goodDraft.opening} Two identifiers must be verified before treatment begins, and that is not open to negotiation here.`,
  primary: {
    choices: [
      { id: "primary_1", label: "Verify both identifiers yourself now and hold the queue while you do it" },
      { id: "primary_2", label: "Assign a second colleague to verify both identifiers so the queue keeps moving" },
    ],
  },
};
const GROUNDING: ProviderBoundaryGrounding[] = [
  {
    boundaryId: "c1_verify",
    boundaryStatement: "Two identifiers must be verified before treatment",
    scenarioPresence: "The opening establishes that two identifiers are verified before treatment begins.",
    operationalEffect: "No option may begin treatment before both identifiers are verified; the decision is who verifies and what the pause costs.",
    affectedDecisionStages: ["opening", "primary", "branch_tradeoff"],
    prohibitedAlternativeExcluded: "Beginning treatment and verifying afterwards is never offered as a choice.",
    remainingJudgmentDimensions: ["sequencing", "staffing"],
  },
];
const CONSTRAINED_ASSESSMENTS = assessAll(groundedDraft, ["c1_verify"]);
/** Provider content for a constrained run: assessments derived from the draft actually sent. */
const constrainedContent = (d: ArenaScenarioDraft) => aiContent(d, assessAll(d, ["c1_verify"]), GROUNDING);
const REVIEW_OK = { choices: [{ message: { content: JSON.stringify({ ok: true, violations: [], noSafeJudgmentSpace: false }) } }] };
const boundary = (mode: "knowledge_check" | "judgment" | "judgment_with_constraints", confirmed: boolean, cons = CONSTRAINTS) => ({ mode, confirmed, constraints: mode === "judgment_with_constraints" ? cons : [] });

describe("generateArenaScenarioDraft — confirmed boundary authority (R4)", () => {
  it("confirmed knowledge_check → declines (fixed_answer_knowledge), provider not called", async () => {
    mockGenThenReview(goodDraft);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("knowledge_check", true) });
    expect(r).toMatchObject({ ok: false, reason: "fixed_answer_knowledge" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("confirmed judgment (no rules) → generates, AND is still semantically reviewed (R2.18)", async () => {
    // Previously the reviewer ran only when constraints existed, so an unconstrained scenario was
    // never semantically reviewed — that is exactly how the c01 moral decoy and the c09 branch
    // collapse reached a green run. Quality review is no longer conditional on safety constraints.
    mockGenThenReview(goodDraft);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment", true) });
    expect(r.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2); // 1 generation + 1 quality review
  });

  it("confirmed judgment_with_constraints + GROUNDED compliant draft + review ok → generates", async () => {
    mockGenThenReview(groundedDraft, CONSTRAINED_ASSESSMENTS, undefined, GROUNDING, ["c1_verify"]);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r.ok).toBe(true);
    // R2.29 — a boundary-bearing scenario now costs one extra call: the NARROW boundary review runs
    // before the broad semantic review, and the broad review only runs because it passed.
    expect(mockCreate).toHaveBeenCalledTimes(3); // 1 generation + 1 narrow boundary + 1 semantic review
  });

  it("R2.21 — a compliant draft that never MENTIONS the confirmed rule is rejected (the c18 shape)", async () => {
    // Silence about a boundary is not compliance: `goodDraft` breaks no rule only because no choice
    // touches identity verification at all. Under the old contract this passed.
    mockGenThenReview(goodDraft, assessAll(goodDraft, ["c1_verify"]), undefined, GROUNDING, ["c1_verify"]);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("R2.21 — a grounded draft with NO grounding declaration is rejected", async () => {
    mockGenThenReview(groundedDraft, CONSTRAINED_ASSESSMENTS, undefined, [], ["c1_verify"]);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("confirmed constraints but a choice violates one (lexical) → generation_rejected", async () => {
    const violating = { ...groundedDraft, branches: { primary_1: { ...goodDraft.branches!.primary_1, tradeoffChoices: [{ id: "p1_t1", label: "Skip the required check to protect the schedule" }, { id: "p1_t2", label: "Complete the check and delay" }] }, primary_2: goodDraft.branches!.primary_2 } };
    mockCreate.mockResolvedValue(aiContent(violating as ArenaScenarioDraft, assessAll(violating as ArenaScenarioDraft, ["c1_verify"]), GROUNDING));
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("R2.23C — a missing boundary GROUNDING record is rejected (the attestation gate it replaced is gone)", async () => {
    // The generator no longer certifies its own compliance, so there is no attestation to omit.
    // Grounding is what must be present, and the reviewer is what proves compliance.
    mockGenThenReview(groundedDraft, undefined, undefined, [], ["c1_verify"]);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("a SCHEMA-INVALID reviewer response → reviewer_terminal_failure, not a generator rejection", async () => {
    // This fixture uses a legacy `{ ok, violations[] }` reviewer DTO that no longer satisfies the
    // reviewer schema at all — so the reviewer never actually judged the scenario. Before R2.25 the
    // pipeline regenerated the scenario and reported `generation_rejected`, blaming the generator
    // for the reviewer's failure. That is exactly the misattribution this slice removes.
    const REVIEW_BAD = { choices: [{ message: { content: JSON.stringify({ ok: false, violations: [{ phase: "action", choiceId: "p1_a1", constraintId: "c1_verify", reason: "implied skip" }], noSafeJudgmentSpace: false }) } }] };
    mockGenThenReview(groundedDraft, CONSTRAINED_ASSESSMENTS, undefined, GROUNDING, ["c1_verify"]); // every gen call
    // R2.29 — the narrow boundary review passes first; only the BROAD reviewer is schema-invalid.
    const NARROW_OK = { choices: [{ message: { content: compliantBoundaryReviewFor(groundedDraft, ["c1_verify"]) } }] };
    mockCreate
      .mockResolvedValueOnce(constrainedContent(groundedDraft)).mockResolvedValueOnce(NARROW_OK).mockResolvedValueOnce(REVIEW_BAD)
      .mockResolvedValueOnce(constrainedContent(groundedDraft)).mockResolvedValueOnce(NARROW_OK).mockResolvedValueOnce(REVIEW_BAD);
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r).toMatchObject({ ok: false, reason: "reviewer_terminal_failure" });
    // A structurally broken response is NOT rerun — rerunning it would only be guesswork — so the
    // run stops at 1 generation + 1 review.
    expect(mockCreate.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("provider signals no safe judgment space → no_safe_judgment_space", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ noSafeJudgmentSpace: true }) } }] });
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r).toMatchObject({ ok: false, reason: "no_safe_judgment_space" });
  });

  it("semantic review transport failure → generation_failed", async () => {
    mockCreate
      .mockResolvedValueOnce(constrainedContent(groundedDraft))
      .mockResolvedValueOnce({ choices: [{ message: { content: compliantBoundaryReviewFor(groundedDraft, ["c1_verify"]) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: "" } }] });
    const r = await generateArenaScenarioDraft({ locale: "en", facts, guided, boundary: boundary("judgment_with_constraints", true) });
    expect(r).toMatchObject({ ok: false, reason: "generation_failed" });
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
