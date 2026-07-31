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

/** A compliant, grounded assessment for CTX's single confirmed rule (R2.21). */
const groundedAssessment = (over: Partial<SemanticReview["boundaryAssessments"][number]> = {}): SemanticReview["boundaryAssessments"][number] => ({
  boundaryId: "c1_verify",
  presentInScenario: true,
  operationalized: true,
  affectedStages: ["opening", "primary", "branch_tradeoff"],
  allPrimaryChoicesComply: true,
  allBranchesPreserve: true,
  allTradeoffChoicesComply: true,
  allActionChoicesComply: true,
  prohibitedAlternativeExcluded: true,
  remainingJudgmentDimensions: ["sequencing", "notification timing"],
  violatedChoiceReferences: [],
  violatedBranchReferences: [],
  defectCodes: [],
  conciseExplanation: "Verification is established up front and holds on every path.",
  ...over,
});

/** No urgency in the situation — the neutral default (R2.21). */
const noUrgency = (over: Partial<SemanticReview["urgency"]> = {}): SemanticReview["urgency"] => ({
  urgencyPresent: false,
  urgencySource: "",
  timeSensitiveHarmPossible: false,
  choices: [0, 1].map((index) => ({
    index,
    introducesDelay: false,
    delayPurpose: "",
    safetyBasis: "",
    foreseeableHarm: "",
    escalationUsed: false,
    defensible: true,
    defectCodes: [],
  })),
  overallUrgencyVerdict: "not_applicable",
  ...over,
});

function review(over: Partial<SemanticReview> = {}): SemanticReview {
  return {
    boundaryAssessments: [groundedAssessment()],
    urgency: noUrgency(),
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
      // R2.21 — the claim must be SHOWN in the per-boundary detail, not just asserted.
      boundaryAssessments: [groundedAssessment({
        allPrimaryChoicesComply: false,
        violatedChoiceReferences: ["Begin treatment and verify afterwards"],
        remainingJudgmentDimensions: [],
        defectCodes: ["choice_bypasses_boundary"],
      })],
      overallVerdict: "reject",
      defectCodes: ["boundary_violation"],
    }), CTX);
    expect(r.ok && r.verdict).toBe("no_safe");
  });

  it("17. a confirmed rule ALONE does not authorise a refusal — no shown violation is unsupported", () => {
    // The c18 shape: the reviewer claims every option violates the boundary while its own per-boundary
    // detail reports full compliance. A rule narrows the choice space; it never eliminates judgment.
    const r = validateSemanticReview(review({
      noSafeJudgmentSpace: true,
      noSafeReasonCode: "all_options_violate_confirmed_boundary",
      remainingJudgmentDimensions: [],
      violatedBoundaryIds: ["c1_verify"],
      overallVerdict: "reject",
      defectCodes: ["boundary_violation"],
    }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_no_safe_unsupported_by_boundary");
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

// ---------------------------------------------------------------------------
// R2.21 — CONFIRMED-BOUNDARY GROUNDING
// ---------------------------------------------------------------------------

describe("reviewer boundary grounding (R2.21)", () => {
  const withAssessment = (over: Partial<SemanticReview["boundaryAssessments"][number]>, codes: string[]) =>
    validateSemanticReview(review({ boundaryAssessments: [groundedAssessment(over)], overallVerdict: "reject", defectCodes: codes }), CTX);

  it("4. a confirmed boundary with NO assessment is rejected", () => {
    const r = validateSemanticReview(review({ boundaryAssessments: [] }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_boundary_assessment_count_mismatch");
    expect(!r.ok && r.errors).toContain("review_missing_boundary_assessment");
  });

  it("5. the same boundary assessed twice is rejected", () => {
    const two = { ...CTX, constraintIds: ["c1_verify", "c2_privacy"] };
    const r = validateSemanticReview(review({ boundaryAssessments: [groundedAssessment(), groundedAssessment()] }), two);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_duplicate_boundary_assessment");
    expect(!r.ok && r.errors).toContain("review_missing_boundary_assessment");
  });

  it("an id the Manager never confirmed is rejected", () => {
    const r = validateSemanticReview(review({ boundaryAssessments: [groundedAssessment({ boundaryId: "c9_invented" })] }), CTX);
    expect(!r.ok && r.errors).toContain("review_unknown_boundary_reference");
  });

  it("6. THE c18 DEFECT — a rule the reviewer reports as ABSENT can never produce an accept", () => {
    const r = withAssessment({ presentInScenario: false, defectCodes: ["confirmed_boundary_absent"] }, ["confirmed_boundary_absent"]);
    expect(r.ok && r.verdict).toBe("reject");
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("confirmed_boundary_absent");
  });

  it("7. a rule present but NOT operationalized is rejected", () => {
    const r = withAssessment({ operationalized: false, defectCodes: ["boundary_not_operationalized"] }, ["boundary_not_operationalized"]);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("boundary_not_operationalized");
  });

  it("13. claimed operational but biting no DECISION stage is VACUOUS compliance", () => {
    // Deleting the rule would leave the scenario byte-for-byte identical.
    const r = withAssessment({ affectedStages: ["opening"] }, ["vacuous_boundary_compliance"]);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("vacuous_boundary_compliance");
  });

  it("9/19/20. a primary choice that bypasses the rule is rejected", () => {
    // The c18 shapes: starting treatment before verification, or verifying afterwards.
    const r = withAssessment(
      { allPrimaryChoicesComply: false, violatedChoiceReferences: ["Begin treatment and confirm identity afterwards"] },
      ["choice_bypasses_boundary"],
    );
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("choice_bypasses_boundary");
  });

  it("9b. a tradeoff choice that bypasses the rule is rejected", () => {
    const r = withAssessment({ allTradeoffChoicesComply: false }, ["choice_bypasses_boundary"]);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("choice_bypasses_boundary");
  });

  it("10. a branch that drops the rule after the primary consequence is rejected", () => {
    const r = withAssessment({ allBranchesPreserve: false, violatedBranchReferences: ["branch 2 proceeds without the check"] }, ["branch_drops_boundary"]);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("branch_drops_boundary");
  });

  it("11. an action choice that reopens the rule is rejected", () => {
    const r = withAssessment({ allActionChoicesComply: false }, ["action_reopens_boundary"]);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("action_reopens_boundary");
  });

  it("a rule offered as advisory rather than excluded is rejected", () => {
    const r = withAssessment({ prohibitedAlternativeExcluded: false }, ["boundary_treated_as_optional"]);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("boundary_treated_as_optional");
  });

  it("8/12/14. a rule that is present, operational and obeyed at every stage is ACCEPTED", () => {
    expect(validateSemanticReview(review(), CTX).ok && validateSemanticReview(review(), CTX)).toMatchObject({ verdict: "accept" });
  });

  it("a generated scenario must report the judgment that survives inside each rule", () => {
    const r = validateSemanticReview(review({ boundaryAssessments: [groundedAssessment({ remainingJudgmentDimensions: [] })] }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_boundary_missing_remaining_judgment");
  });

  it("an unconstrained scenario needs no assessments at all", () => {
    const free = { primaryCount: 2, branchCount: 2, constraintIds: [] as string[] };
    expect(validateSemanticReview(review({ boundaryAssessments: [] }), free).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R2.21 — URGENCY SAFETY
// ---------------------------------------------------------------------------

describe("urgency safety (R2.21)", () => {
  const urgent = (over: Partial<SemanticReview["urgency"]>) =>
    noUrgency({ urgencyPresent: true, urgencySource: "a patient is waiting past their slot", timeSensitiveHarmPossible: true, overallUrgencyVerdict: "safe", ...over });
  const choice = (over: Partial<SemanticReview["urgency"]["choices"][number]>, index = 0) => ({
    index,
    introducesDelay: false,
    delayPurpose: "",
    safetyBasis: "",
    foreseeableHarm: "",
    escalationUsed: false,
    defensible: true,
    defectCodes: [] as string[],
    ...over,
  });

  it("23. THE c18 DEFECT — urgent action delayed for convenience is rejected", () => {
    const r = validateSemanticReview(review({
      urgency: urgent({
        overallUrgencyVerdict: "unsafe",
        choices: [
          choice({ introducesDelay: true, delayPurpose: "finish the shift paperwork first", defensible: false, defectCodes: ["convenience_over_safety"] }),
          choice({}, 1),
        ],
      }),
      overallVerdict: "reject",
      defectCodes: ["convenience_over_safety"],
    }), CTX);
    expect(r.ok && r.verdict).toBe("reject");
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("convenience_over_safety");
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("unsafe_delay");
  });

  it("24. a choice that creates avoidable foreseeable deterioration is rejected", () => {
    const r = validateSemanticReview(review({
      urgency: urgent({
        overallUrgencyVerdict: "unsafe",
        choices: [
          choice({ foreseeableHarm: "the waiting patient deteriorates while the update is drafted", defensible: false, defectCodes: ["avoidable_foreseeable_harm"] }),
          choice({}, 1),
        ],
      }),
      overallVerdict: "reject",
      defectCodes: ["avoidable_foreseeable_harm"],
    }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("avoidable_foreseeable_harm");
  });

  it("25. a pause REQUIRED by a confirmed safety rule is ACCEPTED — time cost is not a defect", () => {
    // The critical non-over-reach case: safety enforcement must not be punished for costing time.
    const r = validateSemanticReview(review({
      urgency: urgent({
        choices: [
          choice({ introducesDelay: true, delayPurpose: "complete the mandatory identifier check", safetyBasis: "the confirmed two-identifier rule" }),
          choice({}, 1),
        ],
      }),
    }), CTX);
    expect(r.ok && r.verdict).toBe("accept");
  });

  it("26. escalating staffing while preserving the rule and the urgency is ACCEPTED", () => {
    const r = validateSemanticReview(review({
      urgency: urgent({
        choices: [
          choice({ introducesDelay: true, delayPurpose: "bring in a second colleague", safetyBasis: "keeps the mandatory check intact while the queue moves", escalationUsed: true }),
          choice({}, 1),
        ],
      }),
    }), CTX);
    expect(r.ok && r.verdict).toBe("accept");
  });

  it("27. referral or supervision when safe capacity is unavailable is ACCEPTED", () => {
    const r = validateSemanticReview(review({
      urgency: urgent({
        choices: [
          choice({ escalationUsed: true, delayPurpose: "", safetyBasis: "redirects to a bay with safe capacity" }),
          choice({ escalationUsed: true, safetyBasis: "asks the charge nurse to supervise" }, 1),
        ],
      }),
    }), CTX);
    expect(r.ok && r.verdict).toBe("accept");
  });

  it("a delay with NO stated safety basis is rejected however it is described", () => {
    const r = validateSemanticReview(review({
      urgency: urgent({
        overallUrgencyVerdict: "unsafe",
        choices: [choice({ introducesDelay: true, delayPurpose: "wait for a quieter moment" }), choice({}, 1)],
      }),
      overallVerdict: "reject",
      defectCodes: ["unsafe_delay"],
    }), CTX);
    expect(r.ok && r.verdict === "reject" && r.defects).toContain("unsafe_delay");
  });

  it("28. urgency FABRICATED where the situation has none is a broken review, not a finding", () => {
    // Practice must not turn a leadership rehearsal into an invented clinical emergency.
    expect(!validateSemanticReview(review({ urgency: noUrgency({ timeSensitiveHarmPossible: true }) }), CTX).ok).toBe(true);
    const r = validateSemanticReview(review({
      urgency: noUrgency({ choices: [choice({ foreseeableHarm: "the patient could deteriorate" }), choice({}, 1)] }),
    }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_urgency_fabricated");
  });

  it("an urgency claim with no named source is unsupported", () => {
    const r = validateSemanticReview(review({ urgency: urgent({ urgencySource: "  " }) }), CTX);
    expect(!r.ok && r.errors).toContain("review_urgency_unsupported");
  });

  it("an unsafe verdict naming no unsafe choice is contradictory in the other direction", () => {
    const r = validateSemanticReview(review({ urgency: urgent({ overallUrgencyVerdict: "unsafe" }) }), CTX);
    expect(!r.ok && r.errors).toContain("review_urgency_contradictory");
  });

  it("29. an unsafe delay can NEVER coexist with an accept verdict", () => {
    const r = validateSemanticReview(review({
      urgency: urgent({
        overallUrgencyVerdict: "unsafe",
        choices: [choice({ introducesDelay: true, delayPurpose: "later is easier", defensible: false, defectCodes: ["unsafe_delay"] }), choice({}, 1)],
      }),
      overallVerdict: "accept",
    }), CTX);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("review_verdict_contradicts_details");
  });

  it("the urgency block must cover every primary choice", () => {
    const r = validateSemanticReview(review({ urgency: noUrgency({ choices: [choice({})] }) }), CTX);
    expect(!r.ok && r.errors).toContain("review_urgency_choice_count_mismatch");
  });

  it("a missing urgency block is rejected rather than assumed safe", () => {
    const r = validateSemanticReview(review({ urgency: undefined as unknown as SemanticReview["urgency"] }), CTX);
    expect(!r.ok && r.errors).toContain("review_urgency_missing");
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

  it("30. boundary-absence feedback is actionable and names the CONFIRMED rule verbatim", () => {
    const m = buildRetryFeedback({
      attempt: 1,
      defects: ["confirmed_boundary_absent"],
      choiceDefects: [],
      branchDefects: [],
      boundaryDefects: [{ boundaryId: "c1_verify", statement: "Two identifiers must be verified before treatment", codes: ["confirmed_boundary_absent"] }],
    });
    expect(m).toContain("[c1_verify]");
    expect(m).toContain('"Two identifiers must be verified before treatment"'); // never a paraphrase
    expect(m).toMatch(/does not appear in the scenario at all/);
    expect(m).toMatch(/Establish it in the opening/);
    expect(m).toMatch(/ACTIVELY constrains/);
  });

  it("30b. decorative grounding feedback says to make the rule bite, not to restate it", () => {
    const m = buildRetryFeedback({
      attempt: 1,
      defects: ["vacuous_boundary_compliance"],
      choiceDefects: [],
      branchDefects: [],
      boundaryDefects: [{ boundaryId: "c1_verify", statement: "Two identifiers must be verified before treatment", codes: ["vacuous_boundary_compliance"] }],
    });
    expect(m).toMatch(/would read identically if it were deleted/);
    expect(m).toMatch(/Do not append it as decorative text/);
  });

  it("30c. bypass, branch-drop and action-reopen each get their own correction", () => {
    const of = (code: string) =>
      buildRetryFeedback({
        attempt: 1, defects: [code], choiceDefects: [], branchDefects: [],
        boundaryDefects: [{ boundaryId: "c1_verify", statement: "Two identifiers must be verified before treatment", codes: [code] }],
      });
    expect(of("choice_bypasses_boundary")).toMatch(/never make obeying it one of the options/);
    expect(of("branch_drops_boundary")).toMatch(/every consequence must preserve it/);
    expect(of("action_reopens_boundary")).toMatch(/may not put the rule back on the table/);
  });

  it("31. unsafe-delay feedback demands a competent alternative, never a refusal", () => {
    const m = buildRetryFeedback({
      attempt: 1,
      defects: ["unsafe_delay"],
      choiceDefects: [],
      branchDefects: [],
      urgencyDefects: [{ index: 1, codes: ["unsafe_delay"] }],
    });
    expect(m).toMatch(/Primary choice 2/);
    expect(m).toMatch(/Replace it with a competent leadership option/);
    expect(m).toMatch(/sequencing|reallocating staff|redirecting/);
    // The safe-pause carve-out must survive into the correction, or the retry over-corrects.
    expect(m).toMatch(/A short pause REQUIRED by a safety rule is acceptable/);
  });

  it("31b. missing-escalation feedback forbids inventing resources", () => {
    const m = buildRetryFeedback({
      attempt: 1, defects: ["missing_required_escalation"], choiceDefects: [], branchDefects: [],
      urgencyDefects: [{ index: 0, codes: ["missing_required_escalation"] }],
    });
    expect(m).toMatch(/escalation, staffing, supervision or referral/);
    expect(m).toMatch(/do not invent people, teams or capacity/);
  });

  it("32. the retry pins the facts, the CONFIRMED boundaries, the locale and the purpose", () => {
    const m = buildRetryFeedback({
      attempt: 1, defects: ["confirmed_boundary_absent"], choiceDefects: [], branchDefects: [],
      boundaryDefects: [{ boundaryId: "c1_verify", statement: "Two identifiers must be verified before treatment", codes: ["confirmed_boundary_absent"] }],
    });
    expect(m).toMatch(/UNCHANGED: the training facts, the confirmed boundaries, the output language, the role, the scenario purpose/);
  });

  it("carries no credential, header or reviewer chain-of-thought", () => {
    const m = buildRetryFeedback({ attempt: 1, defects: ["moral_decoy"], choiceDefects: [{ index: 0, codes: ["moral_decoy"] }], branchDefects: [], reviewerInstruction: "Replace option 1." });
    expect(m).not.toMatch(/sk-|Authorization|Bearer /);
    expect(m).toContain("Reviewer note: Replace option 1.");
  });
});
