import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/**
 * PROVIDER OUTPUT CONTRACT regression matrix (Slice 3.2I-R5B1A.1-R2.15).
 *
 * The first full live run generated 0 of 20 scenarios: the model answered (14.9–25.3 s) but the
 * canonical pipeline rejected everything. Two measured transport defects explain that class of
 * failure — the request carried NO `response_format`, and `max_tokens` was 1,400 against a schema
 * whose worst case is ~4,000 output tokens, while `finish_reason` was never inspected so a
 * truncated body was parsed and misreported as `malformed_shape`.
 *
 * These tests pin the corrected contract and reproduce each measured/latent response shape. Every
 * case states its expected disposition: ACCEPTED, or REJECTED with an exact code. Nothing here
 * fabricates missing scenario content, and no gate is relaxed.
 */

const mockCreate = vi.fn();
let available = true;
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => available,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { generateArenaScenarioDraft, __setGenObserver, type GenObservation } from "./arenaScenarioGenerationService";
import { providerJson, toProviderDto, acceptReview, isReviewRequest } from "@/domain/foundry/arena-draft/providerDto.fixture";
import { PROVIDER_SCHEMA_NAME } from "@/domain/foundry/arena-draft/providerDto";

const facts: ModuleSourceFacts = {
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
const input = { locale: "en" as const, facts, guided };

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
    escalationText:
      "A second reviewer now reports the same gap from a different angle, and the client asks for a status call within the hour.",
    choices: [
      { id: "tradeoff_1", label: "Tell the client the review is incomplete and ask for more time" },
      { id: "tradeoff_2", label: "Narrow the release scope so the unverified part ships later" },
    ],
  },
  actionDecision: {
    prompt: "What do you do in the next hour?",
    choices: [
      { id: "action_1", label: "Call the client now and disclose the open risk", isActionCommitment: true },
      { id: "action_2", label: "Document the gap and run one more verification pass first", isActionCommitment: false },
    ],
  },
  branches: {
    primary_1: {
      escalationText: "Stopping the line frees the reviewers, but the client escalates to your director within the hour.",
      tradeoffChoices: [
        { id: "b1_t1", label: "Brief the director yourself before the client reaches them" },
        { id: "b1_t2", label: "Send the written risk summary and let the director lead the call" },
      ],
      actionDecision: {
        prompt: "What do you commit to now?",
        choices: [
          { id: "b1_a1", label: "Give the director a dated recovery plan on the call", isActionCommitment: true },
          { id: "b1_a2", label: "Ask for a day to confirm the fix before committing a date", isActionCommitment: false },
        ],
      },
    },
    primary_2: {
      escalationText: "Your own check narrows the gap, but the verification consumes the buffer the schedule depended on.",
      tradeoffChoices: [
        { id: "b2_t1", label: "Ship the verified portion and hold the rest for the next window" },
        { id: "b2_t2", label: "Ask the team for an overtime push to close the remaining gap" },
      ],
      actionDecision: {
        prompt: "What do you commit to now?",
        choices: [
          { id: "b2_a1", label: "Tell the client today which portion slips", isActionCommitment: true },
          { id: "b2_a2", label: "Wait for the overtime result before telling the client", isActionCommitment: false },
        ],
      },
    },
  },
};

/** Build a provider envelope. Mirrors the real OpenAI-compatible response shape. */
function envelope(
  content: string | null,
  over: { finish_reason?: string; refusal?: string | null } = {},
): unknown {
  return { choices: [{ message: { content, refusal: over.refusal ?? null }, finish_reason: over.finish_reason ?? "stop" }] };
}

/** Answer the review call with an ACCEPT so a generation-shaped mock is not mistaken for a review. */
function routeWithAcceptReview(genContent: unknown) {
  mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
    isReviewRequest(params) ? { choices: [{ message: { content: JSON.stringify(acceptReview(goodDraft)) } }] } : genContent,
  );
}

let observed: GenObservation[] = [];
beforeEach(() => {
  available = true;
  mockCreate.mockReset();
  observed = [];
  __setGenObserver((o) => observed.push(o));
});
afterEach(() => __setGenObserver(null));

const lastCode = () => observed[observed.length - 1]?.code;

// ---------------------------------------------------------------------------
describe("request contract — the model is constrained, not merely asked", () => {
  it("sends a STRICT json_schema response_format, a sufficient token budget, and the model id", async () => {
    routeWithAcceptReview(envelope(providerJson(goodDraft)));
    await generateArenaScenarioDraft(input);
    const [params] = mockCreate.mock.calls[0];
    expect(params.response_format.type).toBe("json_schema");
    expect(params.response_format.json_schema.strict).toBe(true);
    expect(params.response_format.json_schema.name).toBe(PROVIDER_SCHEMA_NAME);
    expect(params.max_tokens).toBeGreaterThanOrEqual(4000); // ~4,000-token worst case
    expect(params.model).toBe("test-model");
  });

  it("the prompt still names JSON — json_object mode requires it", async () => {
    routeWithAcceptReview(envelope(providerJson(goodDraft)));
    await generateArenaScenarioDraft(input);
    const [params] = mockCreate.mock.calls[0];
    const text = params.messages.map((m: { content: string }) => m.content).join("\n");
    expect(text).toMatch(/JSON/);
  });

  it("ACCEPTED — a well-formed branch-aware draft generates", async () => {
    routeWithAcceptReview(envelope(providerJson(goodDraft)));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("provider envelope shapes", () => {
  it("REJECTED truncated_output — finish_reason 'length' is never parsed as content", async () => {
    // The measured defect: a truncated body used to reach JSON.parse and be misreported.
    const cut = providerJson(goodDraft).slice(0, 900);
    mockCreate.mockResolvedValue(envelope(cut, { finish_reason: "length" }));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("truncated_output");
  });

  it("REJECTED provider_refusal — an explicit refusal is never scenario content", async () => {
    mockCreate.mockResolvedValue(envelope(null, { refusal: "I can't help with that." }));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("provider_refusal");
  });

  it("ACCEPTED — markdown code-fenced JSON is unwrapped, not rejected", async () => {
    routeWithAcceptReview(envelope("```json\n" + providerJson(goodDraft) + "\n```"));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
  });

  it("REJECTED malformed_shape — a prose preamble before the JSON", async () => {
    mockCreate.mockResolvedValue(envelope("Here is the scenario you asked for:\n" + providerJson(goodDraft)));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("malformed_shape");
  });

  it("REJECTED malformed_shape — truncated JSON without a finish_reason signal", async () => {
    mockCreate.mockResolvedValue(envelope(providerJson(goodDraft).slice(0, 400)));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("malformed_shape");
  });

  it("REJECTED — valid JSON with the wrong root (array)", async () => {
    mockCreate.mockResolvedValue(envelope(JSON.stringify([toProviderDto(goodDraft)])));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("generation_failed — empty content is transport failure, not rejected content", async () => {
    mockCreate.mockResolvedValue(envelope(null));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_failed" });
  });

  it("structured_output_unavailable — a provider that rejects the strict schema FAILS CLOSED", async () => {
    mockCreate.mockRejectedValue(new Error("LLM API error: 400 Bad Request — response_format.json_schema is not supported"));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "structured_output_unavailable" });
    expect(lastCode()).toBe("structured_output_unavailable");
    // and it must NOT retry with a downgraded request
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("an unrelated 400 stays generation_failed — capability detection is narrow", async () => {
    mockCreate.mockRejectedValue(new Error("LLM API error: 400 Bad Request — context_length_exceeded"));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_failed" });
  });

  it("generation_failed — a thrown provider error never becomes content", async () => {
    mockCreate.mockRejectedValue(new Error("LLM API error: 500 Internal Server Error"));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_failed" });
  });
});

// ---------------------------------------------------------------------------
describe("canonical schema rejections — exact codes, no invented content", () => {
  const mutate = (fn: (d: ArenaScenarioDraft) => void): string => {
    const d = JSON.parse(JSON.stringify(goodDraft)) as ArenaScenarioDraft;
    fn(d);
    return providerJson(d);
  };

  it("R2.16 — a duplicate model-authored id is UNREPRESENTABLE: the DTO has no id fields", async () => {
    // The old contract asked the model to invent unique ids; duplicates produced
    // `duplicate_choice_id`. The DTO carries no identifiers at all, so the failure class is gone.
    const wire = JSON.parse(providerJson(goodDraft));
    const all = [...wire.primaryChoices, ...wire.flatTradeoffChoices, ...wire.flatActionDecision.choices];
    for (const c of all) expect(c).not.toHaveProperty("id");
    expect(wire).not.toHaveProperty("constraintAssessments"); // no id-keyed map either
    expect(Array.isArray(wire.branches)).toBe(true); // no dynamic keys
  });

  it("R2.16 — model-authored id fields are ignored, and the server still assigns its own", async () => {
    const wire = JSON.parse(providerJson(goodDraft));
    wire.primaryChoices[0].id = "hacked";
    wire.primaryChoices[1].id = "hacked"; // the old duplicate defect, now inert
    routeWithAcceptReview(envelope(JSON.stringify(wire)));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
    const ids = (r as { value: { draft: ArenaScenarioDraft } }).value.draft.primary.choices.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // unique regardless of what the model sent
    expect(ids).not.toContain("hacked");
  });

  it("R2.16 — repeated LABELS are structurally accepted and never merged", async () => {
    // Duplicate wording is a QUALITY question judged elsewhere; it must not collapse identity.
    const wire = JSON.parse(providerJson(goodDraft));
    wire.primaryChoices[1].label = wire.primaryChoices[0].label;
    routeWithAcceptReview(envelope(JSON.stringify(wire)));
    const r = await generateArenaScenarioDraft(input);
    if (r.ok) {
      const choices = r.value.draft.primary.choices;
      expect(choices).toHaveLength(2); // not merged
      expect(choices[0].id).not.toBe(choices[1].id); // distinct identity
      expect(Object.keys(r.value.draft.branches ?? {})).toHaveLength(2); // both continuations kept
    } else {
      // If a quality gate rejects duplicate wording, it must NOT be an identity failure.
      expect(lastCode()).not.toBe("duplicate_choice_id");
    }
  });

  it("REJECTED dto_branch_count_mismatch — fewer branches than primary choices", async () => {
    const wire = JSON.parse(providerJson(goodDraft));
    wire.branches.pop();
    mockCreate.mockResolvedValue(envelope(JSON.stringify(wire)));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("dto_branch_count_mismatch");
  });

  it("REJECTED dto_branch_count_mismatch — an extra branch", async () => {
    const wire = JSON.parse(providerJson(goodDraft));
    wire.branches.push(JSON.parse(JSON.stringify(wire.branches[0])));
    mockCreate.mockResolvedValue(envelope(JSON.stringify(wire)));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("dto_branch_count_mismatch");
  });

  it("REJECTED action_choice_missing_commitment_flag — the exact canary failure", async () => {
    const wire = JSON.parse(providerJson(goodDraft));
    delete wire.branches[0].actionDecision.choices[0].isActionCommitment;
    mockCreate.mockResolvedValue(envelope(JSON.stringify(wire)));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("action_choice_missing_commitment_flag");
  });

  it("REJECTED no_action_commitment — the existing product rule is preserved, not invented", async () => {
    const wire = JSON.parse(providerJson(goodDraft));
    for (const c of wire.flatActionDecision.choices) c.isActionCommitment = false;
    mockCreate.mockResolvedValue(envelope(JSON.stringify(wire)));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).toBe("no_action_commitment");
  });

  it("R2.16 — branch ORDER is the relationship: reordering re-zips deterministically", async () => {
    const wire = JSON.parse(providerJson(goodDraft));
    [wire.branches[0], wire.branches[1]] = [wire.branches[1], wire.branches[0]];
    routeWithAcceptReview(envelope(JSON.stringify(wire)));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
    const draft = (r as { value: { draft: ArenaScenarioDraft } }).value.draft;
    // branch p1 now carries what was authored second — position, not a model-authored key.
    expect(draft.branches!.p1.escalationText).toBe(wire.branches[0].escalationText);
    expect(draft.branches!.p2.escalationText).toBe(wire.branches[1].escalationText);
  });

  it("R2.16 — canonical ids are deterministic across identical DTOs", async () => {
    const wire = providerJson(goodDraft);
    routeWithAcceptReview(envelope(wire));
    const a = await generateArenaScenarioDraft(input);
    routeWithAcceptReview(envelope(wire));
    const b = await generateArenaScenarioDraft(input);
    expect(a.ok && b.ok).toBe(true);
    const ids = (x: typeof a) => JSON.stringify((x as { value: { draft: ArenaScenarioDraft } }).value.draft);
    expect(ids(a)).toBe(ids(b));
  });

  it("REJECTED — too few primary choices", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { d.primary.choices = [d.primary.choices[0]]; delete d.branches!.primary_2; })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — a primary choice with no branch continuation", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { delete d.branches!.primary_2; })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — a branch keyed to an unknown primary choice", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => {
      d.branches!.primary_99 = d.branches!.primary_1;
      delete d.branches!.primary_2;
    })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — an empty choice label is never accepted as content", async () => {
    mockCreate.mockResolvedValue(envelope(mutate((d) => { d.primary.choices[0].label = ""; })));
    expect(await generateArenaScenarioDraft(input)).toMatchObject({ ok: false, reason: "generation_rejected" });
  });

  it("REJECTED — branches whose continuations are semantically identical (ids differ, text does not)", async () => {
    // IDs stay unique on purpose: this must be caught as a DIFFERENTIATION failure, not as
    // duplicate_choice_id. Copying the ids too would make the test pass for the wrong reason.
    mockCreate.mockResolvedValue(envelope(mutate((d) => {
      const a = d.branches!.primary_1;
      const b = d.branches!.primary_2;
      b.escalationText = a.escalationText;
      b.tradeoffChoices = a.tradeoffChoices.map((c, i) => ({ id: `b2_t${i + 1}`, label: c.label }));
      b.actionDecision = {
        prompt: a.actionDecision.prompt,
        choices: a.actionDecision.choices.map((c, i) => ({ id: `b2_a${i + 1}`, label: c.label, isActionCommitment: c.isActionCommitment })),
      };
    })));
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(lastCode()).not.toBe("duplicate_choice_id"); // rejected on differentiation, not identifiers
  });
});

// ---------------------------------------------------------------------------
describe("no fallback, ever", () => {
  it("returns generation_unavailable rather than a deterministic scenario when no model exists", async () => {
    available = false;
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("a rejected generation never returns a draft", async () => {
    mockCreate.mockResolvedValue(envelope("not json at all"));
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(false);
    expect(r as unknown as { value?: unknown }).not.toHaveProperty("value");
  });
});

// ---------------------------------------------------------------------------
describe("R2.17 — every reviewer outcome is observable", () => {
  // The c18 canary recorded an EMPTY attempt trace: the generator succeeded and the semantic
  // reviewer declared no-safe-space, but that return site logged nothing, so the deciding stage
  // was unknowable from the artifact. Each reviewer outcome must now leave a record.
  const constrained = {
    ...input,
    boundary: { mode: "judgment_with_constraints" as const, confirmed: true, constraints: [{ id: "c1", statement: "Verify two identifiers before treatment", provenance: "manager_entered" as const }] },
  };
  /**
   * R2.21 — a GROUNDED constrained draft. `goodDraft` never mentions identity verification, so it
   * "complied" with the confirmed rule only by silence — the measured c18 shape, which the grounding
   * gate now rejects before the reviewer is ever called. The rule is therefore established in the
   * opening AND decided about in the choices.
   */
  const groundedDraft: ArenaScenarioDraft = {
    ...goodDraft,
    opening: `${goodDraft.opening} Two identifiers must be verified before treatment begins, without exception.`,
    primary: {
      choices: [
        { id: "primary_1", label: "Verify both identifiers yourself now and hold the queue while you do it" },
        { id: "primary_2", label: "Assign a colleague to verify both identifiers so the queue keeps moving" },
      ],
    },
  };
  const GROUNDING = [{
    boundaryId: "c1",
    boundaryStatement: "Verify two identifiers before treatment",
    scenarioPresence: "The opening establishes that two identifiers are verified before treatment begins.",
    operationalEffect: "No option may begin treatment before both identifiers are verified; the decision is who verifies and what the pause costs.",
    affectedDecisionStages: ["opening", "primary", "branch_tradeoff"] as const,
    prohibitedAlternativeExcluded: "Beginning treatment and verifying afterwards is never offered.",
    remainingJudgmentDimensions: ["sequencing", "staffing"],
  }];
  /** An accept-shaped review sized to the CONSTRAINED context (one boundary assessment). */
  const groundedReview = (over: Parameters<typeof acceptReview>[1] = {}) => acceptReview(groundedDraft, over, ["c1"]);
  const withAssessments = () => {
    const wire = JSON.parse(providerJson(groundedDraft, undefined, [...GROUNDING] as never));
    const a = [{ constraintId: "c1", status: "satisfied", rationale: "complies" }];
    for (const c of wire.primaryChoices) c.constraintAssessments = a;
    for (const c of wire.flatTradeoffChoices) c.constraintAssessments = a;
    for (const c of wire.flatActionDecision.choices) c.constraintAssessments = a;
    for (const b of wire.branches) {
      for (const c of b.tradeoffChoices) c.constraintAssessments = a;
      for (const c of b.actionDecision.choices) c.constraintAssessments = a;
    }
    return JSON.stringify(wire);
  };
  /** Route generation + a REVIEW body of our choosing. */
  const routeReview = (review: unknown) =>
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
      isReviewRequest(params) ? envelope(JSON.stringify(review)) : envelope(withAssessments()),
    );

  it("a SUPPORTED reviewer no-safe verdict is recorded and terminates", async () => {
    routeReview(groundedReview({
      noSafeJudgmentSpace: true,
      noSafeReasonCode: "all_options_violate_confirmed_boundary",
      remainingJudgmentDimensions: [],
      violatedBoundaryIds: ["c1"],
      // R2.21 — a refusal must be SHOWN in the per-boundary detail, not merely asserted.
      boundaryAssessments: [{
        boundaryId: "c1",
        presentInScenario: true,
        operationalized: true,
        affectedStages: ["opening", "primary"],
        allPrimaryChoicesComply: false,
        allBranchesPreserve: false,
        allTradeoffChoicesComply: false,
        allActionChoicesComply: false,
        prohibitedAlternativeExcluded: false,
        remainingJudgmentDimensions: [],
        violatedChoiceReferences: ["every option starts treatment before verification"],
        violatedBranchReferences: [],
        defectCodes: ["choice_bypasses_boundary"],
        conciseExplanation: "No path leaves room to verify first.",
      }],
      overallVerdict: "reject",
      defectCodes: ["boundary_violation"],
    }));
    const r = await generateArenaScenarioDraft(constrained);
    expect(r).toMatchObject({ ok: false, reason: "no_safe_judgment_space" });
    expect(observed.map((o) => o.outcome)).toContain("review_no_safe_space");
    expect(lastCode()).toBe("all_options_violate_confirmed_boundary");
  });

  it("the c18 OVER-REFUSAL shape is rejected as contradictory, NOT accepted as no-safe", async () => {
    // Unsupported refusal: claims no-safe while still naming remaining judgment. This is the exact
    // shape that terminated c18; it must now be treated as a broken review, never a safety outcome.
    routeReview(groundedReview({
      noSafeJudgmentSpace: true,
      noSafeReasonCode: "all_options_violate_confirmed_boundary",
      remainingJudgmentDimensions: ["sequencing", "notification"],
      violatedBoundaryIds: [],
    }));
    const r = await generateArenaScenarioDraft(constrained);
    expect(r).not.toMatchObject({ reason: "no_safe_judgment_space" });
    expect(observed.map((o) => o.outcome)).toContain("review_malformed");
  });

  it("a reviewer rejection is recorded with its defect code", async () => {
    routeReview(groundedReview({
      primaryChoices: [
        { index: 0, legitimateValue: "transparency", acceptedCost: "slows delivery", defensible: true, defectCodes: [] },
        { index: 1, legitimateValue: "", acceptedCost: "", defensible: false, defectCodes: ["moral_decoy"] },
      ],
      overallVerdict: "reject",
      defectCodes: ["moral_decoy"],
      retryInstruction: "Replace the concealment option.",
    }));
    await generateArenaScenarioDraft(constrained);
    expect(observed.map((o) => o.outcome)).toContain("review_reject");
    expect(observed.map((o) => o.code)).toContain("moral_decoy");
  });

  it("a malformed reviewer response is recorded", async () => {
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
      isReviewRequest(params) ? envelope("not json") : envelope(withAssessments()),
    );
    const r = await generateArenaScenarioDraft(constrained);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(observed.map((o) => o.outcome)).toContain("review_malformed");
  });

  it("a reviewer transport failure is recorded", async () => {
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
      isReviewRequest(params) ? envelope(null) : envelope(withAssessments()),
    );
    const r = await generateArenaScenarioDraft(constrained);
    expect(r).toMatchObject({ ok: false, reason: "generation_failed" });
    expect(observed.map((o) => o.outcome)).toContain("review_transport_failed");
  });
});

describe("R2.18 — defect-specific retry feedback reaches the model", () => {
  const rejectThenAccept = (rejectReview: unknown) => {
    let gen = 0, rev = 0;
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) => {
      if (isReviewRequest(params)) {
        rev += 1;
        return envelope(JSON.stringify(rev === 1 ? rejectReview : acceptReview(goodDraft)));
      }
      gen += 1;
      return envelope(providerJson(goodDraft));
    });
  };
  const decoyReview = acceptReview(goodDraft, {
    primaryChoices: [
      { index: 0, legitimateValue: "transparency", acceptedCost: "slows delivery", defensible: true, defectCodes: [] },
      { index: 1, legitimateValue: "", acceptedCost: "", defensible: false, defectCodes: ["moral_decoy"] },
    ],
    overallVerdict: "reject", defectCodes: ["moral_decoy"], retryInstruction: "Replace the concealment option.",
  });

  it("the SECOND request carries the exact defect codes — it is no longer identical to the first", async () => {
    rejectThenAccept(decoyReview);
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
    const genCalls = mockCreate.mock.calls.filter(([p]) => !isReviewRequest(p));
    expect(genCalls).toHaveLength(2);
    const first = genCalls[0][0].messages.map((m: { content: string }) => m.content).join("\n");
    const second = genCalls[1][0].messages.map((m: { content: string }) => m.content).join("\n");
    expect(second).not.toBe(first); // the measured R2.17 defect was a byte-identical retry
    expect(second).toMatch(/ATTEMPT 1 CORRECTION/);
    expect(second).toContain("moral_decoy");
    expect(second).toMatch(/Primary choice 2/);
  });

  it("21. the retry preserves the original facts and boundaries verbatim", async () => {
    rejectThenAccept(decoyReview);
    await generateArenaScenarioDraft(input);
    const genCalls = mockCreate.mock.calls.filter(([p]) => !isReviewRequest(p));
    const first = genCalls[0][0].messages.map((m: { content: string }) => m.content).join("\n");
    const second = genCalls[1][0].messages.map((m: { content: string }) => m.content).join("\n");
    expect(second).toContain("A teammate proposes cutting a planned design review to hit the deadline");
    expect(second).toMatch(/UNCHANGED: the training facts, the confirmed boundaries/);
    expect(second.startsWith(first.slice(0, 200))).toBe(true); // same system contract, appended correction
  });

  it("24. a SECOND rejection terminates cleanly with no fallback and no draft", async () => {
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
      isReviewRequest(params) ? envelope(JSON.stringify(decoyReview)) : envelope(providerJson(goodDraft)),
    );
    const r = await generateArenaScenarioDraft(input);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(r as unknown as { value?: unknown }).not.toHaveProperty("value");
    const genCalls = mockCreate.mock.calls.filter(([p]) => !isReviewRequest(p));
    expect(genCalls).toHaveLength(2); // bounded — never open-ended
  });

  it("23. rejected first-attempt content never becomes the returned draft", async () => {
    rejectThenAccept(decoyReview);
    const r = await generateArenaScenarioDraft(input);
    expect(r.ok).toBe(true);
    // Only an accepted review yields a draft; the rejected attempt produced none.
    expect((r as { value: { source: string } }).value.source).toBe("ai");
  });

  it("25. an UNSUPPORTED reviewer no-safe does not terminate as an expected decline", async () => {
    let rev = 0;
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) => {
      if (isReviewRequest(params)) {
        rev += 1;
        return envelope(JSON.stringify(rev === 1
          ? acceptReview(goodDraft, { noSafeJudgmentSpace: true, noSafeReasonCode: "all_options_violate_confirmed_boundary", remainingJudgmentDimensions: ["sequencing"], violatedBoundaryIds: [] })
          : acceptReview(goodDraft)));
      }
      return envelope(providerJson(goodDraft));
    });
    const r = await generateArenaScenarioDraft(input);
    // The unsupported refusal is a broken review, so generation retries and succeeds — it is NOT
    // reported as no_safe_judgment_space, which is how c18 was wrongly terminated.
    expect(r.ok).toBe(true);
    expect(observed.map((o) => o.outcome)).toContain("review_malformed");
  });
});

describe("R2.19 — rejected-attempt content capture is opt-in", () => {
  const decoyReview = acceptReview(goodDraft, {
    primaryChoices: [
      { index: 0, legitimateValue: "transparency", acceptedCost: "slows delivery", defensible: true, defectCodes: [] },
      { index: 1, legitimateValue: "", acceptedCost: "", defensible: false, defectCodes: ["moral_decoy"] },
    ],
    overallVerdict: "reject", defectCodes: ["moral_decoy"], retryInstruction: "Replace the concealment option.",
  });
  const routeReject = () =>
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
      isReviewRequest(params) ? envelope(JSON.stringify(decoyReview)) : envelope(providerJson(goodDraft)),
    );

  it("is DISABLED by default — a rejection records the code but no content", async () => {
    __setGenObserver((o) => observed.push(o)); // no captureContent
    routeReject();
    await generateArenaScenarioDraft(input);
    const rej = observed.filter((o) => o.outcome === "review_reject");
    expect(rej.length).toBeGreaterThan(0);
    for (const o of rej) {
      expect(o.scenario).toBeUndefined();
      expect(o.review).toBeUndefined();
      expect(o.retryFeedback).toBeUndefined();
    }
  });

  it("when ENABLED it captures the rejected scenario, reviewer verdict and retry feedback", async () => {
    __setGenObserver((o) => observed.push(o), { captureContent: true });
    routeReject();
    await generateArenaScenarioDraft(input);
    const first = observed.find((o) => o.outcome === "review_reject");
    expect(first).toBeDefined();
    // the rejected scenario itself — the evidence missing from the R2.18 c01 artifact
    expect((first!.scenario as ArenaScenarioDraft).primary.choices).toHaveLength(2);
    expect(JSON.stringify(first!.review)).toContain("moral_decoy");
    expect(first!.retryFeedback).toMatch(/ATTEMPT 1 CORRECTION/);
    expect(first!.retryFeedback).toMatch(/Primary choice 2/);
  });

  it("captured evidence carries no credential, header or account metadata", async () => {
    __setGenObserver((o) => observed.push(o), { captureContent: true });
    routeReject();
    await generateArenaScenarioDraft(input);
    const blob = JSON.stringify(observed);
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(blob).not.toMatch(/Authorization|Bearer /);
  });

  it("production generation is unchanged — the returned result is identical either way", async () => {
    __setGenObserver(null);
    routeReject();
    const a = await generateArenaScenarioDraft(input);
    __setGenObserver((o) => observed.push(o), { captureContent: true });
    routeReject();
    const b = await generateArenaScenarioDraft(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("evaluation observability records the stage, never a secret", () => {
  it("captures the exact rejection code and finish reason", async () => {
    mockCreate.mockResolvedValue(envelope(providerJson(goodDraft).slice(0, 900), { finish_reason: "length" }));
    await generateArenaScenarioDraft(input);
    const o = observed[observed.length - 1];
    expect(o.code).toBe("truncated_output");
    expect(o.finishReason).toBe("length");
  });

  it("never records credential-shaped material", async () => {
    mockCreate.mockResolvedValue(envelope("Here is the scenario:\n{\"broken\":"));
    await generateArenaScenarioDraft(input);
    const blob = JSON.stringify(observed);
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(blob).not.toMatch(/Authorization|Bearer /);
  });

  it("is OFF by default — production installs no sink", async () => {
    __setGenObserver(null);
    mockCreate.mockResolvedValue(envelope("not json"));
    await generateArenaScenarioDraft(input);
    expect(observed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("R2.21 — an ungrounded confirmed boundary is corrected, then terminates", () => {
  const CONSTRAINT = { id: "c1", statement: "Two identifiers must be verified before treatment", provenance: "manager_entered" as const };
  const constrained = { ...input, boundary: { mode: "judgment_with_constraints" as const, confirmed: true, constraints: [CONSTRAINT] } };
  /** Compliant-by-silence provider output: assessments say satisfied, the scenario never mentions the rule. */
  const silentButAttested = () => {
    const wire = JSON.parse(providerJson(goodDraft));
    const a = [{ constraintId: "c1", status: "satisfied", rationale: "complies" }];
    for (const c of wire.primaryChoices) c.constraintAssessments = a;
    for (const c of wire.flatTradeoffChoices) c.constraintAssessments = a;
    for (const c of wire.flatActionDecision.choices) c.constraintAssessments = a;
    for (const b of wire.branches) {
      for (const c of b.tradeoffChoices) c.constraintAssessments = a;
      for (const c of b.actionDecision.choices) c.constraintAssessments = a;
    }
    wire.boundaryGrounding = [{
      boundaryId: "c1",
      boundaryStatement: CONSTRAINT.statement,
      scenarioPresence: "The rule is understood by everyone on the ward.",
      operationalEffect: "Every option respects it.",
      affectedDecisionStages: ["primary"],
      prohibitedAlternativeExcluded: "Skipping the check is not offered.",
      remainingJudgmentDimensions: ["sequencing"],
    }];
    return JSON.stringify(wire);
  };

  it("34. the ungrounded scenario is rejected and NO draft is ever returned", async () => {
    mockCreate.mockImplementation(async () => envelope(silentButAttested()));
    const r = await generateArenaScenarioDraft(constrained);
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(r as unknown as { value?: unknown }).not.toHaveProperty("value");
  });

  it("30/33. the retry states the confirmed rule, and a second failure terminates with no fallback", async () => {
    mockCreate.mockImplementation(async () => envelope(silentButAttested()));
    await generateArenaScenarioDraft(constrained);
    const genCalls = mockCreate.mock.calls.filter(([p]) => !isReviewRequest(p));
    expect(genCalls).toHaveLength(2); // bounded — never open-ended
    const second = genCalls[1][0].messages.map((m: { content: string }) => m.content).join("\n");
    expect(second).toMatch(/ATTEMPT 1 CORRECTION/);
    expect(second).toContain("confirmed_boundary_absent");
    expect(second).toContain('"Two identifiers must be verified before treatment"');
    // Everything that must NOT drift is still pinned.
    expect(second).toContain("A teammate proposes cutting a planned design review to hit the deadline");
    expect(second).toMatch(/UNCHANGED: the training facts, the confirmed boundaries/);
  });

  it("the reviewer is never even consulted for an ungrounded scenario", async () => {
    mockCreate.mockImplementation(async () => envelope(silentButAttested()));
    await generateArenaScenarioDraft(constrained);
    expect(mockCreate.mock.calls.filter(([p]) => isReviewRequest(p))).toHaveLength(0);
    expect(observed.map((o) => o.outcome)).toContain("provider_boundary_ungrounded");
    expect(observed.map((o) => o.code)).toContain("confirmed_boundary_absent");
  });

  it("36. the strict generation schema still requires boundaryGrounding on every request", async () => {
    mockCreate.mockImplementation(async () => envelope(silentButAttested()));
    await generateArenaScenarioDraft(constrained);
    const [params] = mockCreate.mock.calls[0];
    expect(params.response_format.json_schema.name).toBe(PROVIDER_SCHEMA_NAME);
    expect(params.response_format.json_schema.strict).toBe(true);
    expect(params.response_format.json_schema.schema.required).toContain("boundaryGrounding");
  });
});
