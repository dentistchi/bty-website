import { describe, it, expect } from "vitest";
import {
  SEMANTIC_REVIEW_JSON_SCHEMA,
  buildRetryFeedback,
  isRetryableCode,
  isTerminalCode,
  validateSemanticReview,
  type SemanticReview,
} from "./semanticReview";

/**
 * SEMANTIC REVIEW contract (Slice 3.2I-R5B1A.1-R2.18).
 *
 * Every case here reproduces a MEASURED defect: c18's unsupported no-safe refusal, c01's
 * honesty-vs-concealment decoy, c09's branches re-asking the primary question, and the blind retry
 * that let c09 "recover" into an equally collapsed scenario.
 */

const CTX = { primaryCount: 2, branchCount: 2, constraintIds: ["c1_verify"] };

function review(over: Partial<SemanticReview> = {}): SemanticReview {
  return {
    noSafeJudgmentSpace: false,
    noSafeReasonCode: "judgment_space_remains",
    boundaryIdsConsidered: ["c1_verify"],
    remainingJudgmentDimensions: ["sequencing", "notification timing"],
    violatedBoundaryIds: [],
    explanation: "Verification always happens; how to sequence and notify remains open.",
    primaryChoices: [
      { index: 0, legitimateValue: "speed", acceptedCost: "less certainty", defensible: true, defectCodes: [] },
      { index: 1, legitimateValue: "certainty", acceptedCost: "costs time", defensible: true, defectCodes: [] },
    ],
    twoValuesInTension: true,
    tensionValueA: "speed",
    tensionValueB: "certainty",
    branches: [
      { index: 0, selectedPrimarySummary: "moved first", resultingWorldState: "queue re-ordered", newConstraintOrPressure: "family waiting", nextDecisionDimension: "escalation order", repeatsPrimaryDecision: false, overlapsOtherBranchIndex: -1, overlapReason: "", branchDistinct: true, defectCodes: [] },
      { index: 1, selectedPrimarySummary: "verified first", resultingWorldState: "buffer consumed", newConstraintOrPressure: "staffing gap", nextDecisionDimension: "who covers the gap", repeatsPrimaryDecision: false, overlapsOtherBranchIndex: -1, overlapReason: "", branchDistinct: true, defectCodes: [] },
    ],
    boundaryCompliant: true,
    overallVerdict: "accept",
    defectCodes: [],
    retryInstruction: "",
    ...over,
  };
}

describe("strict reviewer schema", () => {
  it("names every field, forbids extras, and constrains the reason code", () => {
    const s = SEMANTIC_REVIEW_JSON_SCHEMA;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(Object.keys(s.properties));
    expect(s.properties.noSafeReasonCode.enum).toContain("judgment_space_remains");
    expect(s.properties.overallVerdict.enum).toEqual(["accept", "reject"]);
  });
});

describe("no-safe contract", () => {
  it("1. c18 shape — a confirmed boundary with remaining sequencing judgment is ACCEPTED, not refused", () => {
    const r = validateSemanticReview(review(), CTX);
    expect(r.ok && r.verdict).toBe("accept");
  });

  it("2. every option violates a confirmed boundary → a valid no-safe result", () => {
    const r = validateSemanticReview(review({
      noSafeJudgmentSpace: true,
      noSafeReasonCode: "all_options_violate_confirmed_boundary",
      remainingJudgmentDimensions: [],
      violatedBoundaryIds: ["c1_verify"],
      overallVerdict: "reject",
      defectCodes: ["boundary_violation"],
    }), CTX);
    expect(r.ok && r.verdict).toBe("no_safe");
  });

  it("3. an unresolved required boundary is a valid no-safe result", () => {
    const r = validateSemanticReview(review({
      noSafeJudgmentSpace: true,
      noSafeReasonCode: "unresolved_boundary_requires_confirmation",
      remainingJudgmentDimensions: [],
      overallVerdict: "reject",
      defectCodes: ["unresolved_boundary_requires_confirmation"],
    }), CTX);
    expect(r.ok && r.verdict).toBe("no_safe");
  });

  it("4. THE c18 OVER-REFUSAL — no-safe while still naming remaining judgment is CONTRADICTORY", () => {
    const r = validateSemanticReview(review({
      noSafeJudgmentSpace: true,
      noSafeReasonCode: "all_options_violate_confirmed_boundary",
      remainingJudgmentDimensions: ["sequencing"],
      violatedBoundaryIds: ["c1_verify"],
    }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_contradictory_no_safe_with_remaining_judgment");
  });

  it("5. no-safe without any supporting boundary is UNSUPPORTED", () => {
    const r = validateSemanticReview(review({
      noSafeJudgmentSpace: true,
      noSafeReasonCode: "all_options_violate_confirmed_boundary",
      remainingJudgmentDimensions: [],
      violatedBoundaryIds: [],
    }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_no_safe_unsupported");
  });

  it("not refusing but naming no remaining judgment is rejected", () => {
    const r = validateSemanticReview(review({ remainingJudgmentDimensions: [] }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_missing_remaining_judgment");
  });
});

describe("difficult-choice contract", () => {
  it("6. c01 shape — honesty versus concealment is a moral decoy", () => {
    const r = validateSemanticReview(review({
      primaryChoices: [
        { index: 0, legitimateValue: "transparency", acceptedCost: "loses face", defensible: true, defectCodes: [] },
        { index: 1, legitimateValue: "", acceptedCost: "", defensible: false, defectCodes: ["moral_decoy"] },
      ],
      overallVerdict: "reject",
      defectCodes: ["moral_decoy"],
    }), CTX);
    expect(r.ok && r.verdict).toBe("reject");
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("moral_decoy");
  });

  it("7. vague evasion is rejected", () => {
    const r = validateSemanticReview(review({
      primaryChoices: [
        { index: 0, legitimateValue: "accountability", acceptedCost: "exposes error", defensible: true, defectCodes: [] },
        { index: 1, legitimateValue: "", acceptedCost: "", defensible: false, defectCodes: ["vague_evasion"] },
      ],
      overallVerdict: "reject", defectCodes: ["vague_evasion"],
    }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("vague_evasion");
  });

  it("8/9. two genuinely defensible options are ACCEPTED", () => {
    expect(validateSemanticReview(review(), CTX).ok && validateSemanticReview(review(), CTX)).toMatchObject({ verdict: "accept" });
  });

  it("10. a choice with no legitimate value is rejected", () => {
    const r = validateSemanticReview(review({
      primaryChoices: [
        { index: 0, legitimateValue: "speed", acceptedCost: "less certainty", defensible: true, defectCodes: [] },
        { index: 1, legitimateValue: "", acceptedCost: "costs time", defensible: true, defectCodes: [] },
      ],
      overallVerdict: "reject", defectCodes: ["no_legitimate_value"],
    }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("no_legitimate_value");
  });

  it("11. a choice accepting no cost dominates and is rejected", () => {
    const r = validateSemanticReview(review({
      primaryChoices: [
        { index: 0, legitimateValue: "speed", acceptedCost: "", defensible: true, defectCodes: [] },
        { index: 1, legitimateValue: "certainty", acceptedCost: "costs time", defensible: true, defectCodes: [] },
      ],
      overallVerdict: "reject", defectCodes: ["dominated_choice"],
    }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("dominated_choice");
  });

  it("options with no value tension are rejected", () => {
    const r = validateSemanticReview(review({ twoValuesInTension: false, overallVerdict: "reject", defectCodes: ["no_value_tension"] }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("no_value_tension");
  });
});

describe("branch consequence contract", () => {
  it("13. c09 shape — a branch that re-asks the primary question is rejected", () => {
    const b = review().branches;
    b[0] = { ...b[0], repeatsPrimaryDecision: true };
    const r = validateSemanticReview(review({ branches: b, overallVerdict: "reject", defectCodes: ["branch_repeats_primary"] }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("branch_repeats_primary");
  });

  it("14/16. siblings that mean the same thing collapse, however they are worded", () => {
    const b = review().branches;
    b[1] = { ...b[1], overlapsOtherBranchIndex: 0, overlapReason: "same next decision", branchDistinct: false };
    const r = validateSemanticReview(review({ branches: b, overallVerdict: "reject", defectCodes: ["branch_semantic_collapse"] }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("branch_semantic_collapse");
  });

  it("15/18. shared vocabulary but genuinely different causal states is ACCEPTED", () => {
    const b = review().branches.map((x) => ({ ...x, nextDecisionDimension: "escalation" }));
    b[0] = { ...b[0], resultingWorldState: "queue re-ordered", newConstraintOrPressure: "family waiting" };
    b[1] = { ...b[1], resultingWorldState: "buffer consumed", newConstraintOrPressure: "staffing gap" };
    expect(validateSemanticReview(review({ branches: b }), CTX).ok).toBe(true);
  });
});

describe("reviewer consistency gates", () => {
  it("a verdict of accept that contradicts its own defects is rejected", () => {
    const b = review().branches;
    b[0] = { ...b[0], repeatsPrimaryDecision: true };
    const r = validateSemanticReview(review({ branches: b, overallVerdict: "accept" }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_verdict_contradicts_details");
  });

  it("a verdict of reject with no defect at all is rejected", () => {
    const r = validateSemanticReview(review({ overallVerdict: "reject" }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_reject_without_defect");
  });

  it("choice and branch counts must match the scenario reviewed", () => {
    expect(validateSemanticReview(review({ primaryChoices: [review().primaryChoices[0]] }), CTX).ok).toBe(false);
    expect(validateSemanticReview(review({ branches: [review().branches[0]] }), CTX).ok).toBe(false);
  });

  it("a non-object review is rejected", () => {
    expect(validateSemanticReview(null, CTX).ok).toBe(false);
  });
});

describe("terminal versus retryable classification", () => {
  it("capability, unresolved boundary and true no-safe are terminal", () => {
    for (const c of ["structured_output_unavailable", "provider_refusal", "unresolved_boundary_requires_confirmation", "all_options_violate_confirmed_boundary", "prohibited_choice_only"]) {
      expect(isTerminalCode(c)).toBe(true);
    }
  });
  it("quality defects are retryable", () => {
    for (const c of ["moral_decoy", "dominated_choice", "branch_repeats_primary", "branch_semantic_collapse", "branch_paraphrase"]) {
      expect(isRetryableCode(c)).toBe(true);
      expect(isTerminalCode(c)).toBe(false);
    }
  });
});

describe("defect-specific retry feedback", () => {
  it("19. a moral decoy produces actionable, position-specific correction", () => {
    const m = buildRetryFeedback({ attempt: 1, defects: ["moral_decoy"], choiceDefects: [{ index: 1, codes: ["moral_decoy"] }], branchDefects: [] });
    expect(m).toMatch(/ATTEMPT 1 CORRECTION/);
    expect(m).toMatch(/Primary choice 2/);
    expect(m).toMatch(/concealment|bad faith/i);
    expect(m).toMatch(/legitimate value/i);
  });

  it("20. a branch repeat produces actionable correction naming the branch", () => {
    const m = buildRetryFeedback({ attempt: 1, defects: ["branch_repeats_primary"], choiceDefects: [], branchDefects: [{ index: 0, codes: ["branch_repeats_primary"] }] });
    expect(m).toMatch(/Branch 1/);
    expect(m).toMatch(/ALREADY been made/);
    expect(m).toMatch(/DIFFERENT next decision/);
  });

  it("22. the exact defect codes are always stated", () => {
    const m = buildRetryFeedback({ attempt: 1, defects: ["moral_decoy", "branch_semantic_collapse"], choiceDefects: [], branchDefects: [] });
    expect(m).toContain("moral_decoy");
    expect(m).toContain("branch_semantic_collapse");
  });

  it("21. everything that must NOT change is pinned", () => {
    const m = buildRetryFeedback({ attempt: 1, defects: ["moral_decoy"], choiceDefects: [], branchDefects: [] });
    expect(m).toMatch(/UNCHANGED: the training facts, the confirmed boundaries, the output language/);
  });

  it("carries no credential, header or reviewer chain-of-thought", () => {
    const m = buildRetryFeedback({ attempt: 1, defects: ["moral_decoy"], choiceDefects: [{ index: 0, codes: ["moral_decoy"] }], branchDefects: [], reviewerInstruction: "Replace option 1." });
    expect(m).not.toMatch(/sk-|Authorization|Bearer /);
    expect(m).toContain("Reviewer note: Replace option 1.");
  });
});
