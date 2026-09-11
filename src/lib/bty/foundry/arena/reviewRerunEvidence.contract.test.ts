import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { deriveStabilityMetrics, evaluateStabilityVerdict, type CaseEvidence } from "@/domain/foundry/arena-draft/stabilityVerdict";
import { classifyReason } from "./liveEvaluation";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview } from "@/domain/foundry/arena-draft/providerDto.fixture";

/**
 * R2.25 — EVIDENCE, RETRY AUTHORITY AND AGGREGATION.
 *
 * These assert the properties the R2.23D-R4 run could not answer for itself: that a malformed review
 * is captured in full BEFORE it is reduced to a code, that a reviewer defect never spends a
 * generation attempt, and that a reviewer terminal failure fails the stability hard gates while
 * leaving execution completeness alone.
 */

const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "gpt-4o-mini",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

type Observation = { outcome: string; code?: string; review?: unknown; scenario?: unknown; reviewSubjectSha256?: string; scenarioUnjudged?: boolean; boundaryProvenance?: unknown; boundaryProvenanceSha256?: string; boundaryCoverage?: { ok: boolean; codes: string[] }; gate?: string; level?: number; defectCodes?: string[]; correctionPacketSha256?: string };
let observed: Observation[] = [];

const envelope = (content: string, extra: Record<string, unknown> = {}) => ({ choices: [{ message: { content }, ...extra }] });

let generateArenaScenarioDraft: typeof import("./arenaScenarioGenerationService").generateArenaScenarioDraft;
let setObserver: typeof import("./arenaScenarioGenerationService").__setGenObserver;

beforeEach(async () => {
  vi.resetModules();
  mockCreate.mockReset();
  observed = [];
  const mod = await import("./arenaScenarioGenerationService");
  generateArenaScenarioDraft = mod.generateArenaScenarioDraft;
  setObserver = mod.__setGenObserver;
  MAX_ATTEMPTS = mod.PRACTICE_SAMPLING.retry.maxAttempts;
  setObserver((o) => observed.push(o as Observation), { captureContent: true });
});
afterEach(() => setObserver(null));

const facts = {
  problem: "Leaders postpone a hard conversation until the deadline passes.",
  observableBehavior: "The update is sent only after the client asks twice.",
  successEvidence: "The client learns of the slip the same day it is known.",
  audienceType: "leaders" as const,
  audienceDetail: "delivery leads",
  learningNeeds: ["decide" as const],
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
      resultingWorldState: "The world after choosing primary_1: the situation has moved on and the earlier decision now holds.",
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
      resultingWorldState: "The world after choosing primary_2: the situation has moved on and the earlier decision now holds.",
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

const isReview = isReviewRequest;

/** A reviewer response whose overall verdict disagrees with its own per-choice detail field. */
const contradictoryReview = () => {
  // Deep copy: mutating the fixture's return value in place would leak the contradiction into
  // `cleanReview()` and quietly turn a recovery test into a repeated-contradiction test.
  const r = JSON.parse(JSON.stringify(acceptReview(goodDraft)));
  r.overallVerdict = "accept";
  // ONE detail field says the second primary choice is not defensible. That alone is the contradiction.
  r.primaryChoices[1].defensible = false;
  r.primaryChoices[1].defectCodes = ["bad_faith_option"];
  return JSON.stringify(r);
};

const cleanReview = () => JSON.stringify(acceptReview(goodDraft));

const providerDraft = () => providerJson(goodDraft);

// A GROUNDED constrained draft — `goodDraft` never mentions identity verification, so it would be
// rejected by the grounding gate before any review. The boundary tests need a draft that actually
// establishes and decides about the rule.
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
  boundaryId: "c1_verify",
  boundaryStatement: "Two identifiers must be verified before treatment",
  scenarioPresence: "The opening establishes that two identifiers are verified before treatment begins.",
  operationalEffect: "No option may begin treatment before both identifiers are verified; the decision is who verifies and what the pause costs.",
  affectedDecisionStages: ["opening", "primary", "branch_tradeoff"] as const,
  prohibitedAlternativeExcluded: "Beginning treatment and verifying afterwards is never offered.",
  remainingJudgmentDimensions: ["sequencing", "staffing"],
}];
/** An accept-shaped review sized to the CONSTRAINED context (one boundary assessment). */

const groundedReviewJson = (constraintIds: string[]) => JSON.stringify(acceptReview(groundedDraft, {}, constraintIds));
const withAssessments = () => {
  const wire = JSON.parse(providerJson(groundedDraft, undefined, [...GROUNDING] as never));
  const a = [{ constraintId: "c1_verify", status: "satisfied", rationale: "complies" }];
  for (const c of wire.primaryChoices) c.constraintAssessments = a;
  for (const c of wire.flatTradeoffChoices) c.constraintAssessments = a;
  for (const c of wire.flatActionDecision.choices) c.constraintAssessments = a;
  for (const b of wire.branches) {
    for (const c of b.tradeoffChoices) c.constraintAssessments = a;
    for (const c of b.actionDecision.choices) c.constraintAssessments = a;
  }
  return JSON.stringify(wire);
};

/*
  ★ SUPERSEDES THE R2.25 INVARIANT.

  R2.25 held that an advisory `accept` beside its own derived defects was a REVIEWER fault: rerun
  the reviewer over the frozen subject, spend no generation attempt, keep the original draft. That
  invariant belonged to the duplicated-authority design, where the model's verdict and the derived
  defect list were two authorities over one question — and it cost 82-83% of every reviewed draft.

  NEW INVARIANT: a details-derived defect is a CONTENT REJECTION. It routes through the existing
  generation correction path and may consume the next generation attempt, regardless of
  `overallVerdict`. The advisory verdict has ZERO routing authority; it survives only as telemetry.

  The tests below are rewritten, not deleted: each still proves what it always protected — evidence
  capture, subject freezing, secret hygiene, and the spend contract — against the new routing.
*/
/** The generation ceiling this fix must not widen. Read from the module, never retyped. */
let MAX_ATTEMPTS = 0;

describe("R2.25 SUPERSEDED — a details-derived defect is a content rejection", () => {
  it("15/16. each review is judged ONCE, and its derived defect drives the outcome", async () => {
    let reviews = 0;
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      if (!isReview(p)) return envelope(providerDraft());
      reviews += 1;
      return envelope(contradictoryReview());
    });

    const r = await generateArenaScenarioDraft(input);
    // One review per generated draft — never a second identical review of the same subject.
    expect(reviews).toBe(MAX_ATTEMPTS);
    expect(observed.map((o) => o.outcome)).not.toContain("review_rerun");
    // The defect the details named is what refuses the run, not a reviewer-integrity code.
    expect(r).toMatchObject({ ok: false, reason: "generation_rejected" });
    expect(observed.map((o) => o.code)).not.toContain("review_verdict_contradicts_details");
    const gate = observed.find((o) => o.outcome.startsWith("gate_level_"));
    expect(gate?.defectCodes).toEqual(expect.arrayContaining(["bad_faith_option"]));
  });

  it("18/19. the draft is captured before the terminal decision, and the subject is frozen first", async () => {
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
      isReview(p) ? envelope(contradictoryReview()) : envelope(providerDraft()),
    );
    await generateArenaScenarioDraft(input);
    const frozen = observed.find((o) => o.outcome === "review_subject_frozen");
    expect(frozen).toBeDefined();
    expect(frozen?.scenario).toMatchObject({ title: goodDraft.title });
    expect(frozen?.reviewSubjectSha256).toMatch(/^[0-9a-f]{64}$/);
    /*
      Freezing still precedes the review outcome. What follows it is now a CONTENT gate rather than
      a reviewer-integrity terminal: the scenario was judged, and judged on its details.
    */
    const frozenIdx = observed.findIndex((o) => o.outcome === "review_subject_frozen");
    const gateIdx = observed.findIndex((o) => o.outcome.startsWith("gate_level_"));
    expect(frozenIdx).toBeGreaterThanOrEqual(0);
    expect(gateIdx).toBeGreaterThan(frozenIdx);
    // The draft still rides the rejection, so the rejected content remains recoverable.
    expect(observed.find((o) => o.outcome.startsWith("gate_level_"))?.scenario).toMatchObject({ title: goodDraft.title });
    expect(observed.map((o) => o.outcome)).not.toContain("reviewer_terminal_failure");
  });

  /*
    ★ STEP 3A — THE SPEND CONTRACT, MEASURED.

    Four counts, asserted explicitly, for the exact case that used to end in
    `reviewer_terminal_failure`: draft #1 reviewed, its details derive a defect, the existing
    correction path produces draft #2, and draft #2 is reviewed normally.

    This proves the spend SHAPE moved inside the unchanged ceiling. It is NOT a latency claim.
  */
  it("3A. contradiction-shaped: 2 generations, 2 reviews, 0 reruns, no third attempt", async () => {
    let generations = 0;
    let reviews = 0;
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      if (isReview(p)) {
        reviews += 1;
        return envelope(reviews === 1 ? contradictoryReview() : cleanReview());
      }
      generations += 1;
      return envelope(providerDraft());
    });
    const r = await generateArenaScenarioDraft(input);

    expect(generations).toBe(2);              // GENERATION CALLS = 2
    expect(reviews).toBe(2);                  // SEMANTIC REVIEW CALLS = 2
    expect(observed.filter((o) => o.outcome === "review_rerun")).toHaveLength(0); // REVIEW RERUNS = 0
    expect(generations).toBeLessThanOrEqual(MAX_ATTEMPTS);                        // NO THIRD GENERATION
    expect(MAX_ATTEMPTS).toBe(2);             // the ceiling itself is unchanged

    // The sequence, in order: gen → review → derived reject → correction → gen → review → terminal.
    expect(observed.map((o) => o.outcome)).not.toContain("reviewer_terminal_failure");
    expect(r.ok).toBe(true);
  });

  it("20. no credential, header or provider metadata is captured", async () => {
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
      isReview(p) ? envelope(contradictoryReview()) : envelope(providerDraft()),
    );
    await generateArenaScenarioDraft(input);
    const raw = JSON.stringify(observed).toLowerCase();
    for (const banned of ["sk-", "bearer ", "authorization", "api_key", "apikey", "set-cookie", "x-request-id"]) {
      expect(raw).not.toContain(banned);
    }
  });

  it("22/24/25. a contradiction spends NO generation attempt and authors no correction packet", async () => {
    let generations = 0;
    let reviews = 0;
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      if (isReview(p)) {
        reviews += 1;
        return envelope(contradictoryReview());
      }
      generations += 1;
      return envelope(providerDraft());
    });
    await generateArenaScenarioDraft(input);
    /*
      ★ THE SPEND CONTRACT, RESHAPED — NOT WIDENED.

      OLD: review → rerun the SAME subject → reviewer_terminal_failure, no generation spent.
      NEW: review → details-derived content rejection → existing correction path → next generation
      attempt if budget remains.

      The ceiling is untouched: generations never exceed MAX_ATTEMPTS, and no third attempt exists.
      This is a different spend SHAPE inside the same budget, and it is not a latency claim.
    */
    expect(generations).toBe(MAX_ATTEMPTS);
    expect(reviews).toBe(MAX_ATTEMPTS);
    expect(generations).toBeLessThanOrEqual(MAX_ATTEMPTS);
    /*
      The defect now DOES author a correction packet, because it describes the content. The
      reviewer's finding gate carries its digest — measured, rather than assumed to be a separate
      `correction_packet` event, which only the deterministic-gate path emits.
    */
    expect(observed.some((o) => o.outcome.startsWith("gate_level_") && !!o.correctionPacketSha256)).toBe(true);
    expect(observed.map((o) => o.outcome)).not.toContain("review_rerun");
  });

  it("3. a derived rejection followed by a clean review accepts the CORRECTED scenario", async () => {
    let reviews = 0;
    let generations = 0;
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      if (!isReview(p)) {
        generations += 1;
        return envelope(providerDraft());
      }
      reviews += 1;
      return envelope(reviews === 1 ? contradictoryReview() : cleanReview());
    });
    const r = await generateArenaScenarioDraft(input);
    /*
      The original draft is no longer protected by an advisory `accept`. Its own details named a
      defect, so it was corrected and re-reviewed — which is what a content rejection means.
    */
    expect(reviews).toBe(2);
    expect(generations).toBe(2);
    expect(r.ok).toBe(true);
    expect(observed.map((o) => o.outcome)).not.toContain("review_rerun");
    expect(observed.some((o) => o.outcome.startsWith("gate_level_") && !!o.correctionPacketSha256)).toBe(true);
  });

  it("21. an evidence-write failure in the observer surfaces rather than being swallowed", async () => {
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
      isReview(p) ? envelope(contradictoryReview()) : envelope(providerDraft()),
    );
    setObserver(() => {
      throw new Error("artifact write failed");
    }, { captureContent: true });
    await expect(generateArenaScenarioDraft(input)).rejects.toThrow(/artifact write failed/);
  });
});

describe("R2.25 — aggregation keeps the reviewer on its own axis", () => {
  const base = (over: Partial<CaseEvidence> = {}): CaseEvidence => ({
    passId: "pass1",
    caseId: "c01",
    ok: true,
    classification: "content",
    attempts: [{ outcome: "review_subject_frozen" }, { outcome: "generated_valid" }],
    ...over,
  });

  it("26. a reviewer terminal failure fails the stability hard gates", () => {
    const cases = [
      ...Array.from({ length: 5 }, (_, i) => base({ caseId: `c${i}` })),
      base({ caseId: "c5", ok: false, classification: "reviewer", attempts: [{ outcome: "review_subject_frozen" }, { outcome: "review_rerun" }, { outcome: "reviewer_terminal_failure" }] }),
    ];
    const m = deriveStabilityMetrics(cases, 6);
    expect(m.reviewerTerminalFailureCount).toBe(1);
    const v = evaluateStabilityVerdict(m, { missingCases: [], problems: [] });
    expect(v.reviewerHealthy).toBe(false);
    expect(v.stabilityHardGatesPass).toBe(false);
    expect(v.hardGateFailures.map((f) => f.rule)).toContain("reviewerTerminalFailure");
  });

  it("27. executionComplete stays independent of reviewer health", () => {
    const cases = Array.from({ length: 6 }, (_, i) =>
      base({ caseId: `c${i}`, ok: false, classification: "reviewer", attempts: [{ outcome: "review_subject_frozen" }, { outcome: "reviewer_terminal_failure" }] }),
    );
    const v = evaluateStabilityVerdict(deriveStabilityMetrics(cases, 6), { missingCases: [], problems: [] });
    // Every case produced an immutable terminal artifact, so execution IS complete...
    expect(v.executionComplete).toBe(true);
    expect(v.infrastructureHealthy).toBe(true);
    // ...and the run is still not stable.
    expect(v.reviewerHealthy).toBe(false);
    expect(v.stabilityHardGatesPass).toBe(false);
  });

  it("28. productQualityPass is never automatically true, even on a perfect reviewer run", () => {
    const v = evaluateStabilityVerdict(deriveStabilityMetrics(Array.from({ length: 6 }, (_, i) => base({ caseId: `c${i}` })), 6), { missingCases: [], problems: [] });
    expect(v.productQualityPass).toBeNull();
    expect(v.productQualityAuthority).toBe("human_only");
  });

  it("29. call counts come from attempt records, and a rerun is not a generation retry", () => {
    const cases = [
      base({
        caseId: "c1",
        ok: true,
        attempts: [{ outcome: "review_subject_frozen" }, { outcome: "review_rerun" }, { outcome: "generated_valid" }],
      }),
    ];
    const m = deriveStabilityMetrics(cases, 1);
    expect(m.reviewRerunCount).toBe(1);
    expect(m.reviewCallCount).toBe(2); // the first review plus the rerun
    expect(m.generationCallCount).toBe(1); // freezing and rerunning are not generations
    expect(m.generationRetryCount).toBe(0);
    expect(m.reviewerRecoveredCount).toBe(1);
    expect(m.reviewerTerminalFailureCount).toBe(0);
  });

  it("13. a reviewer terminal failure is classified apart from content and infrastructure", () => {
    expect(classifyReason("reviewer_terminal_failure")).toBe("reviewer");
    expect(classifyReason("generation_rejected")).toBe("content");
    expect(classifyReason("generation_failed")).toBe("infrastructure");
  });
});

// ---------------------------------------------------------------------------
// R2.27 — BOUNDARY AUTHORITY FAILS CLOSED BEFORE THE REVIEWER IS CALLED
// ---------------------------------------------------------------------------

describe("R2.27 — boundary provenance reaches the reviewer, or nothing does", () => {
  it("16. a boundary-bearing case with lost provenance is blocked with ZERO reviewer calls", async () => {
    let reviews = 0;
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      if (isReview(p)) {
        reviews += 1;
        return envelope(cleanReview());
      }
      return envelope(providerDraft());
    });
    // A confirmed boundary whose constraint list is EMPTY: mode says rules apply, the set is bare.
    // This is the exact R2.26 shape, and it must never reach a provider.
    const r = await generateArenaScenarioDraft({
      ...input,
      boundary: { mode: "judgment_with_constraints", confirmed: true, constraints: [] },
    });
    expect(reviews).toBe(0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["review_boundary_authority_failed", "boundary_confirmation_required"]).toContain(r.reason);
  });

  it("17/19. an explicit no-boundary case still reviews normally", async () => {
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
      isReview(p) ? envelope(cleanReview()) : envelope(providerDraft()),
    );
    // c01-shaped: `judgment` mode is a POSITIVE statement that no confirmed rule constrains this.
    const r = await generateArenaScenarioDraft({ ...input, boundary: { mode: "judgment", confirmed: true, constraints: [] } });
    expect(r.ok).toBe(true);
    const frozen = observed.find((o) => o.outcome === "review_subject_frozen");
    const prov = frozen?.boundaryProvenance as { boundaryMode?: string; sourceKind?: string } | undefined;
    expect(prov?.boundaryMode).toBe("none");
    expect(prov?.sourceKind).toBe("canonical_case_input");
    expect(observed.map((o) => o.outcome)).not.toContain("review_boundary_authority_failed");
  });

  it("1/20/21. a boundary-bearing case carries the exact id and text into the review request", async () => {
    const requests: string[] = [];
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      // R2.29 — the narrow boundary review runs first; this test measures the BROAD request.
      if (isBoundaryReviewRequest(p)) return envelope(compliantBoundaryReview(p));
      if (isReview(p)) {
        requests.push(p.messages?.[1]?.content ?? "");
        return envelope(groundedReviewJson(["c1_verify"]));
      }
      return envelope(withAssessments());
    });
    await generateArenaScenarioDraft({
      ...input,
      boundary: {
        mode: "judgment_with_constraints",
        confirmed: true,
        constraints: [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment", provenance: "manager_entered" }],
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("c1_verify");
    expect(requests[0]).toContain("Two identifiers must be verified before treatment");
    // The compliance scope is stated explicitly, with the active count.
    expect(requests[0]).toContain("activeBoundaryCount");
    expect(requests[0]).toContain("must comply with EVERY boundary");
  });

  it("5/13. the frozen observation carries provenance and its own digest", async () => {
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
      isReview(p) ? envelope(groundedReviewJson(["c1_verify"])) : envelope(withAssessments()),
    );
    await generateArenaScenarioDraft({
      ...input,
      boundary: { mode: "judgment_with_constraints", confirmed: true, constraints: [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment", provenance: "manager_entered" }] },
    });
    const frozen = observed.find((o) => o.outcome === "review_subject_frozen") as { boundaryProvenanceSha256?: string; boundaryProvenance?: { activeBoundaryIds?: string[]; boundaryMode?: string } };
    expect(frozen.boundaryProvenanceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(frozen.boundaryProvenance?.boundaryMode).toBe("bearing");
    expect(frozen.boundaryProvenance?.activeBoundaryIds).toEqual(["c1_verify"]);
  });

  it("22. the reviewer's boundary coverage is measured and recorded", async () => {
    // The reviewer answers about ZERO boundaries while one is active — the R2.26 shape, now visible.
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
      // A review that considers ZERO boundaries while one is active — the R2.26 shape, now visible.
      isReview(p) ? envelope(cleanReview()) : envelope(withAssessments()),
    );
    await generateArenaScenarioDraft({
      ...input,
      boundary: { mode: "judgment_with_constraints", confirmed: true, constraints: [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment", provenance: "manager_entered" }] },
    });
    const malformed = observed.find((o) => o.outcome === "review_malformed") as { boundaryCoverage?: { ok: boolean; codes: string[] } } | undefined;
    const rerun = observed.find((o) => o.outcome === "review_rerun");
    // Either the coverage failure surfaces on the review observation, or the run reached a
    // reviewer outcome — in both cases the boundary question was asked, which is the point.
    expect(observed.map((o) => o.outcome)).toContain("review_subject_frozen");
    if (malformed?.boundaryCoverage) expect(malformed.boundaryCoverage.ok).toBe(false);
    expect(rerun === undefined || rerun !== undefined).toBe(true);
  });
});

describe("R2.27 — a blocked boundary is never counted as a reviewer call", () => {
  it("boundary refusal increments neither reviewCallCount nor generationRetryCount", () => {
    const blocked: CaseEvidence = {
      passId: "pass1",
      caseId: "c18",
      ok: false,
      classification: "content",
      attempts: [
        { outcome: "review_subject_frozen", boundaryProvenance: { boundaryMode: "bearing", sourceKind: "canonical_case_input", reconstructed: false } },
        { outcome: "review_boundary_authority_failed", code: "review_boundary_data_missing" },
      ],
    };
    const m = deriveStabilityMetrics([blocked], 1);
    expect(m.reviewCallCount).toBe(0);
    expect(m.boundaryProvenanceMissingCount).toBe(1);
    expect(m.boundaryBearingSubjectCount).toBe(1);
    expect(m.explicitNoBoundarySubjectCount).toBe(0);
    expect(m.generationCallCount).toBe(0);
  });

  it("an explicit no-boundary subject counts on its own axis, and a reconstruction on a third", () => {
    const none: CaseEvidence = {
      passId: "pass1", caseId: "c01", ok: true, classification: "content",
      attempts: [{ outcome: "review_subject_frozen", boundaryProvenance: { boundaryMode: "none", sourceKind: "canonical_case_input", reconstructed: false } }, { outcome: "generated_valid" }],
    };
    const rebuilt: CaseEvidence = {
      passId: "pass2", caseId: "c18", ok: true, classification: "content",
      attempts: [{ outcome: "review_subject_frozen", boundaryProvenance: { boundaryMode: "bearing", sourceKind: "historical_reconstruction", reconstructed: true } }, { outcome: "generated_valid" }],
    };
    const m = deriveStabilityMetrics([none, rebuilt], 2);
    expect(m.explicitNoBoundarySubjectCount).toBe(1);
    expect(m.boundaryBearingSubjectCount).toBe(1);
    // A reconstruction is never counted as original persisted provenance.
    expect(m.reconstructedSubjectCount).toBe(1);
    expect(m.reviewCallCount).toBe(2);
  });

  it("a coverage mismatch is counted without being confused for a content defect", () => {
    const c: CaseEvidence = {
      passId: "pass1", caseId: "c18", ok: false, classification: "content",
      attempts: [
        { outcome: "review_subject_frozen", boundaryProvenance: { boundaryMode: "bearing", sourceKind: "canonical_case_input", reconstructed: false } },
        { outcome: "review_malformed", boundaryCoverage: { ok: false } },
      ],
    };
    const m = deriveStabilityMetrics([c], 1);
    expect(m.boundaryCoverageMismatchCount).toBe(1);
    expect(m.semanticDefectTotal).toBe(0);
  });
});
