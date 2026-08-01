import { describe, it, expect } from "vitest";
import {
  deriveStabilityMetrics,
  evaluateHardGates,
  evaluateStabilityVerdict,
  PRODUCT_QUALITY_AUTHORITY,
  type CaseEvidence,
  type StabilityMetrics,
} from "./stabilityVerdict";
import { STABILITY_PASS_LABEL, stabilityTerminalLabel } from "@/lib/bty/foundry/arena/stabilityReport";

const CLEAN = { missingCases: [], problems: [] };

/** A run that satisfies every hard gate. Each test degrades exactly one thing from here. */
const perfect = (): StabilityMetrics => ({
  expectedCases: 6,
  executedCases: 6,
  generatedValid: 6,
  generationRejected: 0,
  infrastructureFailure: 0,
  firstAttemptValid: 6,
  retryRecovered: 0,
  retryExhausted: 0,
  reviewerMalformed: 0,
  truncation: 0,
  fallback: 0,
  semanticDefectTotal: 0,
  generationCallCount: 6,
  reviewCallCount: 6,
  reviewRerunCount: 0,
  reviewerRecoveredCount: 0,
  reviewerTerminalFailureCount: 0,
  generatorRejectedCount: 0,
  deterministicRejectedCount: 0,
  semanticRejectedCount: 0,
  generationRetryCount: 0,
});

/**
 * The measured R2.23D-R4 run, run 20260801T024949Z. These are the numbers the six immutable
 * artifacts carry, and the terminal that printed "STRUCTURAL + SEMANTIC GATES PASS" over them.
 */
const R4_MEASURED = (): StabilityMetrics => ({
  expectedCases: 6,
  executedCases: 6,
  generatedValid: 1,
  generationRejected: 5,
  infrastructureFailure: 0,
  firstAttemptValid: 1,
  retryRecovered: 0,
  retryExhausted: 5,
  reviewerMalformed: 4,
  truncation: 0,
  fallback: 0,
  semanticDefectTotal: 11,
  // R2.25 call accounting, recomputed from the same six artifacts. The historical run predates the
  // rerun authority, so it has zero reruns: every contradiction spent a GENERATION instead.
  generationCallCount: 11,
  reviewCallCount: 0,
  reviewRerunCount: 0,
  reviewerRecoveredCount: 0,
  reviewerTerminalFailureCount: 0,
  generatorRejectedCount: 5,
  deterministicRejectedCount: 4,
  semanticRejectedCount: 2,
  generationRetryCount: 5,
});

describe("VERDICT AUTHORITY — execution completeness is not stability", () => {
  it("1. six completed with one generated fails the hard gates", () => {
    const m = { ...perfect(), generatedValid: 1, generationRejected: 5, firstAttemptValid: 1 };
    const v = evaluateStabilityVerdict(m, CLEAN);
    expect(v.executionComplete).toBe(true);
    expect(v.stabilityHardGatesPass).toBe(false);
    expect(v.hardGateFailures.map((f) => f.rule)).toContain("generatedValid");
  });

  it("2. six completed and six generated is eligible and passes", () => {
    const v = evaluateStabilityVerdict(perfect(), CLEAN);
    expect(v.stabilityHardGatesPass).toBe(true);
    expect(v.hardGateFailures).toEqual([]);
  });

  it("3. any reviewer-malformed attempt fails the hard gates", () => {
    const v = evaluateStabilityVerdict({ ...perfect(), reviewerMalformed: 1 }, CLEAN);
    expect(v.stabilityHardGatesPass).toBe(false);
    expect(v.hardGateFailures.map((f) => f.rule)).toContain("reviewerMalformed");
  });

  it("4. any retry-exhausted case fails the hard gates", () => {
    const v = evaluateStabilityVerdict({ ...perfect(), retryExhausted: 1 }, CLEAN);
    expect(v.stabilityHardGatesPass).toBe(false);
    expect(v.hardGateFailures.map((f) => f.rule)).toContain("retryExhausted");
  });

  it("5. a healthy infrastructure does not imply a stability pass", () => {
    // The exact shape of the R2.23D-R4 defect: A and C true, D false.
    const v = evaluateStabilityVerdict(R4_MEASURED(), CLEAN);
    expect(v.infrastructureHealthy).toBe(true);
    expect(v.executionComplete).toBe(true);
    expect(v.evidenceComplete).toBe(true);
    expect(v.stabilityHardGatesPass).toBe(false);
  });

  it("6. productQualityPass is never automatically true, however good the metrics are", () => {
    const v = evaluateStabilityVerdict(perfect(), CLEAN);
    expect(v.productQualityPass).toBeNull();
    expect(v.productQualityPass).not.toBe(true);
    expect(v.productQualityAuthority).toBe(PRODUCT_QUALITY_AUTHORITY);
    expect(v.humanReviewRequired).toBe(true);
  });

  it("7. the historical R2.23D-R4 metrics produce FAIL, naming every broken gate", () => {
    const v = evaluateStabilityVerdict(R4_MEASURED(), CLEAN);
    expect(v.stabilityHardGatesPass).toBe(false);
    expect(v.hardGateFailures.map((f) => f.rule).sort()).toEqual(
      ["firstAttemptValid", "generatedValid", "retryExhausted", "reviewerMalformed", "semanticDefectTotal"].sort(),
    );
  });

  it("8. the pass label cannot be printed on failed metrics", () => {
    const m = R4_MEASURED();
    const lines = stabilityTerminalLabel(evaluateStabilityVerdict(m, CLEAN), m);
    expect(lines).not.toContain(STABILITY_PASS_LABEL);
    expect(lines).toEqual([
      "LIVE EXECUTION COMPLETE · 6/6 EVIDENCE WRITTEN",
      "STABILITY HARD GATES FAILED",
      "HUMAN CONTENT REVIEW LIMITED TO GENERATED OUTPUTS",
    ]);
  });

  it("8b. the pass label appears only when every hard gate holds", () => {
    const m = perfect();
    expect(stabilityTerminalLabel(evaluateStabilityVerdict(m, CLEAN), m)).toEqual([
      STABILITY_PASS_LABEL,
      "HUMAN PRODUCT REVIEW REQUIRED",
    ]);
  });

  it("incomplete evidence fails the hard gates even when every other count is perfect", () => {
    const v = evaluateStabilityVerdict(perfect(), { missingCases: ["pass2/c18"], problems: [] });
    expect(v.evidenceComplete).toBe(false);
    expect(v.stabilityHardGatesPass).toBe(false);
  });

  it("truncation and fallback each fail on their own", () => {
    expect(evaluateHardGates({ ...perfect(), truncation: 1 }, CLEAN).map((f) => f.rule)).toContain("truncation");
    expect(evaluateHardGates({ ...perfect(), fallback: 1 }, CLEAN).map((f) => f.rule)).toContain("fallback");
  });

  it("a contract that only holds on the second attempt is not stable", () => {
    // 5 first-attempt valid + 1 recovered passes; 4 + 2 does not.
    expect(evaluateStabilityVerdict({ ...perfect(), firstAttemptValid: 5, retryRecovered: 1 }, CLEAN).stabilityHardGatesPass).toBe(true);
    expect(evaluateStabilityVerdict({ ...perfect(), firstAttemptValid: 4, retryRecovered: 2 }, CLEAN).stabilityHardGatesPass).toBe(false);
  });
});

describe("metrics are derived from artifact evidence, not from terminal text", () => {
  /** The six R2.23D-R4 cases, in the exact attempt shapes the artifacts carry. */
  const R4_CASES: CaseEvidence[] = [
    { passId: "pass1", caseId: "c01", ok: false, classification: "content", attempts: [
      { outcome: "review_malformed", code: "review_verdict_contradicts_details" },
      { outcome: "review_malformed", code: "review_verdict_contradicts_details" },
    ] },
    { passId: "pass1", caseId: "c09", ok: false, classification: "content", attempts: [
      { outcome: "gate_level_4", code: "construction_metadata_generic", defectCodes: ["construction_metadata_generic"] },
      { outcome: "correction_packet", code: "construction_metadata_generic", defectCodes: ["construction_metadata_generic"] },
      { outcome: "gate_level_6", code: "repeated_action_meaning", defectCodes: ["repeated_action_meaning"] },
    ] },
    { passId: "pass1", caseId: "c18", ok: false, classification: "content", attempts: [
      { outcome: "gate_level_4", code: "unsupported_boundary_compliance", defectCodes: ["unsupported_boundary_compliance"] },
      { outcome: "correction_packet", code: "unsupported_boundary_compliance", defectCodes: ["unsupported_boundary_compliance"] },
      // Rejected by the semantic REVIEWER — it carries a review, unlike the deterministic ones.
      { outcome: "gate_level_3", code: "unsafe_delay", defectCodes: ["unsafe_delay"], review: { defects: ["unsafe_delay"] } },
    ] },
    { passId: "pass2", caseId: "c01", ok: false, classification: "content", attempts: [
      { outcome: "review_malformed", code: "review_verdict_contradicts_details" },
      { outcome: "gate_level_3", code: "unsafe_delay", defectCodes: ["unsafe_delay", "bad_faith_option", "vague_reassurance", "branch_semantic_collapse", "cross_branch_axis_collapse"], review: { defects: ["unsafe_delay"] } },
    ] },
    { passId: "pass2", caseId: "c09", ok: true, classification: "content", attempts: [{ outcome: "generated_valid" }] },
    { passId: "pass2", caseId: "c18", ok: false, classification: "content", attempts: [
      { outcome: "gate_level_3", code: "confirmed_boundary_absent", defectCodes: ["confirmed_boundary_absent", "unsupported_boundary_compliance"] },
      { outcome: "correction_packet", code: "confirmed_boundary_absent", defectCodes: ["confirmed_boundary_absent", "unsupported_boundary_compliance"] },
      { outcome: "review_malformed", code: "review_verdict_contradicts_details" },
    ] },
  ];

  it("reproduces the measured R2.23D-R4 numbers exactly", () => {
    expect(deriveStabilityMetrics(R4_CASES, 6)).toEqual(R4_MEASURED());
  });

  it("does not count a correction_packet entry as a generation attempt or a defect", () => {
    // c18 pass1 records `unsupported_boundary_compliance` twice — once as a finding, once as the
    // retry ledger entry. Counting both doubled every defect and inflated the retry count.
    const m = deriveStabilityMetrics(R4_CASES, 6);
    expect(m.semanticDefectTotal).toBe(11);
    expect(m.retryExhausted).toBe(5);
  });

  it("counts a malformed review on its own axis, never as a generation defect", () => {
    const m = deriveStabilityMetrics(R4_CASES, 6);
    expect(m.reviewerMalformed).toBe(4);
    // The four malformed attempts contribute nothing to the semantic defect total.
    expect(m.semanticDefectTotal).toBe(11);
  });
});
