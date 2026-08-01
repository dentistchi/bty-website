import { describe, it, expect } from "vitest";
import {
  CONTRADICTION_CODES,
  MAX_REVIEW_CALLS_PER_SUBJECT,
  NON_RERUNNABLE_EXAMPLES,
  REVIEWER_TERMINAL_FAILURE,
  countsAsGenerationRetry,
  decideAfterReview,
  isContradiction,
  isGeneratorContentRejection,
} from "./reviewRerun";
import {
  buildBoundaryProvenance,
} from "./boundaryProvenance";
import {
  canRerunOverSubject,
  detectSubjectDrift,
  reviewSubjectSha256,
  scenarioDigest,
  type ReviewSubject,
} from "./reviewSubject";

const SCENARIO = {
  title: "t",
  opening: "o",
  primary: { choices: [{ id: "p1", label: "a" }, { id: "p2", label: "b" }] },
  tradeoff: { escalationText: "e", choices: [{ id: "ft1", label: "c" }, { id: "ft2", label: "d" }] },
  actionDecision: { prompt: "p", choices: [{ id: "fa1", label: "e", isActionCommitment: true }, { id: "fa2", label: "f", isActionCommitment: false }] },
};

const subject = (over: Partial<ReviewSubject> = {}): ReviewSubject => {
  const scenario = over.scenario ?? SCENARIO;
  return {
    scenario,
    scenarioSha256: scenarioDigest(scenario),
    generationAttemptId: "gen1",
    caseId: "c01",
    boundaryProvenance: buildBoundaryProvenance({
      available: [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment", provenance: "manager_entered" }],
      activeIds: ["c1_verify"],
      scopeConfirmed: true,
      sourceKind: "canonical_case_input",
      sourceReference: "test",
      sourceSha256: "a".repeat(64),
    }),
    confirmedBoundaries: [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment" }],
    activeBoundaryIds: ["c1_verify"],
    language: "ko",
    generationModel: "gpt-4o-mini",
    generationSampling: { temperature: 0.8, topP: 0.9 },
    generationFinishReason: "stop",
    canonicalValidatorResult: null,
    deterministicGateResult: null,
    reviewContractSha256: "c".repeat(64),
    ...over,
  };
};

// ---------------------------------------------------------------------------
// REVIEW STATE MACHINE (test-matrix 1–8)
// ---------------------------------------------------------------------------

describe("REVIEW STATE MACHINE", () => {
  it("1. a consistent first accept accepts", () => {
    expect(decideAfterReview(1, { kind: "ok" })).toEqual({ action: "accept" });
  });

  it("2. a consistent first reject goes to the existing correction path", () => {
    expect(decideAfterReview(1, { kind: "reject" })).toEqual({ action: "reject_scenario" });
  });

  it("3/4. a first contradiction reruns the REVIEWER, whatever the second verdict turns out to be", () => {
    const d = decideAfterReview(1, { kind: "contradiction", errors: ["review_verdict_contradicts_details"] });
    expect(d.action).toBe("rerun_review");
    if (d.action === "rerun_review") expect(d.because).toContain("NOT regenerated");
    // Whatever the second review says, it is honoured as the semantic result for the SAME scenario.
    expect(decideAfterReview(2, { kind: "ok" })).toEqual({ action: "accept" });
    expect(decideAfterReview(2, { kind: "reject" })).toEqual({ action: "reject_scenario" });
  });

  it("5. a second contradiction terminates as a reviewer failure", () => {
    const d = decideAfterReview(2, { kind: "contradiction", errors: ["review_verdict_contradicts_details"] });
    expect(d.action).toBe("reviewer_terminal_failure");
    if (d.action === "reviewer_terminal_failure") expect(d.because).toContain("frozen subject");
  });

  it("6. there is no third review attempt", () => {
    expect(MAX_REVIEW_CALLS_PER_SUBJECT).toBe(2);
    const d = decideAfterReview(3, { kind: "contradiction", errors: ["review_verdict_contradicts_details"] });
    expect(d.action).toBe("reviewer_infrastructure_failure");
    if (d.action === "reviewer_infrastructure_failure") expect(d.code).toBe("review_attempt_budget_violated");
  });

  it("7. a second contradiction never asks for a new scenario", () => {
    const d = decideAfterReview(2, { kind: "contradiction", errors: ["review_verdict_contradicts_details"] });
    expect(countsAsGenerationRetry(d)).toBe(false);
    // Only a VALID reviewer rejection may spend a generation attempt.
    expect(countsAsGenerationRetry(decideAfterReview(1, { kind: "reject" }))).toBe(true);
  });

  it("8. the reviewer terminal failure is not a generator content rejection", () => {
    expect(isGeneratorContentRejection(REVIEWER_TERMINAL_FAILURE)).toBe(false);
    expect(isGeneratorContentRejection("generation_rejected")).toBe(true);
    expect(isGeneratorContentRejection("no_safe_judgment_space")).toBe(true);
  });

  it("a transport or schema failure is infrastructure, never a rerun", () => {
    expect(decideAfterReview(1, { kind: "transport_failed" }).action).toBe("reviewer_infrastructure_failure");
    for (const code of NON_RERUNNABLE_EXAMPLES) {
      expect(isContradiction([code]), `${code} must not be rerunnable`).toBe(false);
      expect(decideAfterReview(1, { kind: "malformed", errors: [code] }).action).toBe("reviewer_infrastructure_failure");
    }
  });

  it("every contradiction code is a verdict/detail disagreement, and a mixed set is not rerunnable", () => {
    for (const code of CONTRADICTION_CODES) expect(isContradiction([code])).toBe(true);
    // One structural error in the set means the response was not merely inconsistent.
    expect(isContradiction(["review_verdict_contradicts_details", "review_truncated"])).toBe(false);
    expect(isContradiction([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FROZEN IDENTITY (test-matrix 9–14)
// ---------------------------------------------------------------------------

describe("FROZEN SUBJECT IDENTITY", () => {
  it("9. an identical scenario reruns", () => {
    expect(canRerunOverSubject(subject(), subject()).ok).toBe(true);
  });

  it("10/11. identical boundary scope and review contract rerun", () => {
    const f = subject();
    expect(detectSubjectDrift(f, subject())).toEqual([]);
    // Ordering of the active scope is not drift; content is.
    expect(detectSubjectDrift(subject({ activeBoundaryIds: ["a", "b"] }), subject({ activeBoundaryIds: ["b", "a"] }))).toEqual([]);
  });

  it("12. a mutated scenario fails closed", () => {
    const mutated = { ...SCENARIO, opening: "a different opening" };
    const g = canRerunOverSubject(subject(), subject({ scenario: mutated }));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.drift).toContain("scenario_mutated");
  });

  it("12b. a scenario whose digest was NOT recomputed still fails closed", () => {
    // The subtle attack: keep the recorded digest, swap the content. The digest is recomputed from
    // the content, so the lie is caught.
    const lying = subject({ scenario: { ...SCENARIO, opening: "swapped" } });
    lying.scenarioSha256 = scenarioDigest(SCENARIO);
    const g = canRerunOverSubject(subject(), lying);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.drift).toContain("scenario_mutated");
  });

  it("13. a mutated boundary fails closed", () => {
    const g = canRerunOverSubject(subject(), subject({ confirmedBoundaries: [{ id: "c1_verify", statement: "One identifier is enough" }] }));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.drift).toEqual(expect.arrayContaining(["boundary_mutated", "subject_digest_mismatch"]));
  });

  it("13b. a narrowed active scope fails closed", () => {
    const g = canRerunOverSubject(subject(), subject({ activeBoundaryIds: [] }));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.drift).toContain("active_scope_mutated");
  });

  it("14. prompt/schema/sampling drift fails closed", () => {
    const g = canRerunOverSubject(subject(), subject({ reviewContractSha256: "d".repeat(64) }));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.drift).toContain("review_contract_drift");
    // Sampling is inside the digest too.
    expect(canRerunOverSubject(subject(), subject({ generationSampling: { temperature: 0.1 } })).ok).toBe(false);
  });

  it("14b. language and case identity are part of the subject", () => {
    expect(canRerunOverSubject(subject(), subject({ language: "en" })).ok).toBe(false);
    expect(canRerunOverSubject(subject(), subject({ caseId: "c18" })).ok).toBe(false);
  });

  it("the digest ignores what may legitimately differ between attempts", () => {
    // Attempt id, timestamps, latency and the response are NOT in the subject type at all, so they
    // cannot drift it. Fields that are present but non-verdict-bearing are excluded by construction.
    const a = subject({ generationAttemptId: "gen1", canonicalValidatorResult: ["w1"], deterministicGateResult: { x: 1 } });
    const b = subject({ generationAttemptId: "gen2", canonicalValidatorResult: null, deterministicGateResult: null });
    expect(reviewSubjectSha256(a)).toBe(reviewSubjectSha256(b));
  });
});
