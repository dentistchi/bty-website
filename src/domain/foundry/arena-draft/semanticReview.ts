/**
 * SEMANTIC REVIEW contract (Slice 3.2I-R5B1A.1-R2.18).
 *
 * THREE MEASURED DEFECTS DROVE THIS
 *
 * c18 — the reviewer returned `noSafeJudgmentSpace` for a case whose corpus entry says
 * `expectDecline: false` ("Manager confirmed rule; generate only inside it") and whose single
 * constraint ("verify two identifiers before treatment") leaves sequencing, notification, staffing
 * and recovery wide open. The old reviewer was asked to decide no-safe in ONE clause bundled with
 * violation detection, with no definition of the term and no rationale required — free text alone
 * could authorise a refusal.
 *
 * c01 — primary choices were "acknowledge the missed delivery" vs "provide a vague timeline without
 * admitting the mistake": honesty vs concealment, one indefensible option.
 *
 * c09 — both branches re-asked the primary question (notify now vs verify first), with two action
 * labels identical across branches.
 *
 * c01 and c09 carried NO confirmed constraints, and the reviewer only ran when constraints existed —
 * so neither was ever semantically reviewed. The deterministic gates passed both. That gap, not
 * model luck, is why defective content reached a green run.
 *
 * A confirmed rule NARROWS the choice space. It does not eliminate judgment.
 *
 * Pure domain: no I/O, no provider calls. This module defines what a review must say and when a
 * review is internally contradictory; it never rewrites a scenario.
 */

import { BOUNDARY_DEFECT_CODES, DECISION_STAGES, OPERATIVE_STAGES, type DecisionStage } from "./boundaryGrounding";

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

export const NO_SAFE_REASON_CODES = [
  "all_options_violate_confirmed_boundary",
  "unresolved_boundary_requires_confirmation",
  "prohibited_choice_only",
  "judgment_space_remains",
] as const;
export type NoSafeReasonCode = (typeof NO_SAFE_REASON_CODES)[number];

/** Per-choice defects. `moral_decoy` / `bad_faith_option` are the measured c01 failure. */
export const CHOICE_DEFECT_CODES = [
  "no_legitimate_value",
  "bad_faith_option",
  "moral_decoy",
  "dominated_choice",
  "obvious_correct_answer",
  "unsafe_option",
  "vague_evasion",
  "duplicate_tradeoff",
] as const;
export type ChoiceDefectCode = (typeof CHOICE_DEFECT_CODES)[number];

/** Per-branch defects. Both are the measured c09 failure. */
export const BRANCH_DEFECT_CODES = ["branch_repeats_primary", "branch_semantic_collapse"] as const;
export type BranchDefectCode = (typeof BRANCH_DEFECT_CODES)[number];

/**
 * URGENCY-SAFETY defects (R2.21). Domain-neutral leadership safety, NOT clinical decision-making:
 * the question is never "what treatment", it is whether a leadership choice knowingly trades
 * foreseeable harm for speed, appearance or convenience, and whether escalation was available.
 *
 * The measured c18 failure: one primary option delayed urgent care with foreseeable deterioration
 * and the reviewer accepted it, because nothing in the contract asked about delay at all.
 */
export const URGENCY_DEFECT_CODES = [
  "unsafe_delay",
  "convenience_over_safety",
  "avoidable_foreseeable_harm",
  "missing_required_escalation",
  "boundary_treated_as_optional",
  "unsupported_urgency_claim",
] as const;
export type UrgencyDefectCode = (typeof URGENCY_DEFECT_CODES)[number];

/**
 * Retry classification. A capability gap, an unresolved boundary or a VALIDATED no-safe result is
 * terminal — retrying cannot change them. A quality defect is retryable exactly once, and only with
 * defect-specific feedback (a blind retry is what let c09 "recover" into an equally collapsed
 * scenario).
 */
export const TERMINAL_CODES = [
  "structured_output_unavailable",
  "provider_refusal",
  "unresolved_boundary_requires_confirmation",
  "all_options_violate_confirmed_boundary",
  "prohibited_choice_only",
] as const;

export const RETRYABLE_CODES = [
  ...CHOICE_DEFECT_CODES,
  ...BRANCH_DEFECT_CODES,
  ...BOUNDARY_DEFECT_CODES,
  ...URGENCY_DEFECT_CODES,
  "branch_paraphrase",
  "boundary_violation",
  "review_contradictory",
] as const;

export function isTerminalCode(code: string): boolean {
  return (TERMINAL_CODES as readonly string[]).includes(code);
}
export function isRetryableCode(code: string): boolean {
  return (RETRYABLE_CODES as readonly string[]).includes(code);
}

// ---------------------------------------------------------------------------
// The reviewer's structured response
// ---------------------------------------------------------------------------

export type ChoiceReview = {
  index: number;
  legitimateValue: string;
  acceptedCost: string;
  defensible: boolean;
  defectCodes: string[];
};

export type BranchReview = {
  index: number;
  selectedPrimarySummary: string;
  resultingWorldState: string;
  newConstraintOrPressure: string;
  nextDecisionDimension: string;
  repeatsPrimaryDecision: boolean;
  /** -1 when this branch overlaps no sibling. */
  overlapsOtherBranchIndex: number;
  overlapReason: string;
  branchDistinct: boolean;
  defectCodes: string[];
};

/**
 * One INDEPENDENT assessment per confirmed boundary (R2.21). This replaces the single global
 * `boundaryCompliant` boolean, under which c18 passed: with no choice touching identity
 * verification, "no choice violates the rule" was trivially true. Presence and operational effect
 * are now separate, required judgments — and a `false` on either can never produce an accept.
 */
export type BoundaryAssessment = {
  boundaryId: string;
  presentInScenario: boolean;
  operationalized: boolean;
  affectedStages: DecisionStage[];
  allPrimaryChoicesComply: boolean;
  allBranchesPreserve: boolean;
  allTradeoffChoicesComply: boolean;
  allActionChoicesComply: boolean;
  prohibitedAlternativeExcluded: boolean;
  remainingJudgmentDimensions: string[];
  violatedChoiceReferences: string[];
  violatedBranchReferences: string[];
  defectCodes: string[];
  conciseExplanation: string;
};

export type UrgencyChoiceReview = {
  index: number;
  introducesDelay: boolean;
  /** What the delay is FOR. A purpose is not a justification — `safetyBasis` is. */
  delayPurpose: string;
  /** The safety or verification requirement that makes the delay legitimate. Empty = none. */
  safetyBasis: string;
  /** Concrete foreseeable harm the choice creates or worsens. Empty = none identified. */
  foreseeableHarm: string;
  escalationUsed: boolean;
  defensible: boolean;
  defectCodes: string[];
};

export type UrgencyReview = {
  urgencyPresent: boolean;
  urgencySource: string;
  timeSensitiveHarmPossible: boolean;
  choices: UrgencyChoiceReview[];
  overallUrgencyVerdict: "safe" | "unsafe" | "not_applicable";
};

export type SemanticReview = {
  noSafeJudgmentSpace: boolean;
  noSafeReasonCode: NoSafeReasonCode;
  boundaryIdsConsidered: string[];
  remainingJudgmentDimensions: string[];
  violatedBoundaryIds: string[];
  explanation: string;
  primaryChoices: ChoiceReview[];
  twoValuesInTension: boolean;
  tensionValueA: string;
  tensionValueB: string;
  branches: BranchReview[];
  boundaryCompliant: boolean;
  boundaryAssessments: BoundaryAssessment[];
  urgency: UrgencyReview;
  overallVerdict: "accept" | "reject";
  defectCodes: string[];
  retryInstruction: string;
};

export const SEMANTIC_REVIEW_SCHEMA_NAME = "bty_practice_semantic_review_v1";

const strArray = { type: "array", items: { type: "string" } } as const;

export const SEMANTIC_REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    noSafeJudgmentSpace: { type: "boolean" },
    noSafeReasonCode: { type: "string", enum: NO_SAFE_REASON_CODES },
    boundaryIdsConsidered: strArray,
    remainingJudgmentDimensions: strArray,
    violatedBoundaryIds: strArray,
    explanation: { type: "string" },
    primaryChoices: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          legitimateValue: { type: "string" },
          acceptedCost: { type: "string" },
          defensible: { type: "boolean" },
          defectCodes: { type: "array", items: { type: "string", enum: CHOICE_DEFECT_CODES } },
        },
        required: ["index", "legitimateValue", "acceptedCost", "defensible", "defectCodes"],
      },
    },
    twoValuesInTension: { type: "boolean" },
    tensionValueA: { type: "string" },
    tensionValueB: { type: "string" },
    branches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          selectedPrimarySummary: { type: "string" },
          resultingWorldState: { type: "string" },
          newConstraintOrPressure: { type: "string" },
          nextDecisionDimension: { type: "string" },
          repeatsPrimaryDecision: { type: "boolean" },
          overlapsOtherBranchIndex: { type: "integer" },
          overlapReason: { type: "string" },
          branchDistinct: { type: "boolean" },
          defectCodes: { type: "array", items: { type: "string", enum: BRANCH_DEFECT_CODES } },
        },
        required: [
          "index", "selectedPrimarySummary", "resultingWorldState", "newConstraintOrPressure",
          "nextDecisionDimension", "repeatsPrimaryDecision", "overlapsOtherBranchIndex",
          "overlapReason", "branchDistinct", "defectCodes",
        ],
      },
    },
    boundaryCompliant: { type: "boolean" },
    boundaryAssessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          boundaryId: { type: "string" },
          presentInScenario: { type: "boolean" },
          operationalized: { type: "boolean" },
          affectedStages: { type: "array", items: { type: "string", enum: DECISION_STAGES } },
          allPrimaryChoicesComply: { type: "boolean" },
          allBranchesPreserve: { type: "boolean" },
          allTradeoffChoicesComply: { type: "boolean" },
          allActionChoicesComply: { type: "boolean" },
          prohibitedAlternativeExcluded: { type: "boolean" },
          remainingJudgmentDimensions: strArray,
          violatedChoiceReferences: strArray,
          violatedBranchReferences: strArray,
          defectCodes: { type: "array", items: { type: "string", enum: BOUNDARY_DEFECT_CODES } },
          conciseExplanation: { type: "string" },
        },
        required: [
          "boundaryId", "presentInScenario", "operationalized", "affectedStages",
          "allPrimaryChoicesComply", "allBranchesPreserve", "allTradeoffChoicesComply",
          "allActionChoicesComply", "prohibitedAlternativeExcluded", "remainingJudgmentDimensions",
          "violatedChoiceReferences", "violatedBranchReferences", "defectCodes", "conciseExplanation",
        ],
      },
    },
    urgency: {
      type: "object",
      additionalProperties: false,
      properties: {
        urgencyPresent: { type: "boolean" },
        urgencySource: { type: "string" },
        timeSensitiveHarmPossible: { type: "boolean" },
        choices: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              index: { type: "integer" },
              introducesDelay: { type: "boolean" },
              delayPurpose: { type: "string" },
              safetyBasis: { type: "string" },
              foreseeableHarm: { type: "string" },
              escalationUsed: { type: "boolean" },
              defensible: { type: "boolean" },
              defectCodes: { type: "array", items: { type: "string", enum: URGENCY_DEFECT_CODES } },
            },
            required: ["index", "introducesDelay", "delayPurpose", "safetyBasis", "foreseeableHarm", "escalationUsed", "defensible", "defectCodes"],
          },
        },
        overallUrgencyVerdict: { type: "string", enum: ["safe", "unsafe", "not_applicable"] },
      },
      required: ["urgencyPresent", "urgencySource", "timeSensitiveHarmPossible", "choices", "overallUrgencyVerdict"],
    },
    overallVerdict: { type: "string", enum: ["accept", "reject"] },
    defectCodes: strArray,
    retryInstruction: { type: "string" },
  },
  required: [
    "noSafeJudgmentSpace", "noSafeReasonCode", "boundaryIdsConsidered", "remainingJudgmentDimensions",
    "violatedBoundaryIds", "explanation", "primaryChoices", "twoValuesInTension", "tensionValueA",
    "tensionValueB", "branches", "boundaryCompliant", "boundaryAssessments", "urgency",
    "overallVerdict", "defectCodes", "retryInstruction",
  ],
} as const;

// ---------------------------------------------------------------------------
// Consistency gates — fail closed on a contradictory review
// ---------------------------------------------------------------------------

export type ReviewValidation =
  | { ok: true; value: SemanticReview; verdict: "accept" }
  | { ok: true; value: SemanticReview; verdict: "reject"; defects: string[] }
  | { ok: true; value: SemanticReview; verdict: "no_safe"; reasonCode: NoSafeReasonCode }
  | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * Validate a reviewer response against the scenario it reviewed.
 *
 * The reviewer is an evaluator, never an author: it may reject, it may declare no-safe — but only
 * with structure that actually supports the claim. A free-text explanation alone can no longer
 * authorise a refusal, which is exactly how c18 was refused.
 */
export function validateSemanticReview(
  raw: unknown,
  ctx: { primaryCount: number; branchCount: number; constraintIds: string[] },
): ReviewValidation {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ["review_not_an_object"] };

  const noSafe = raw.noSafeJudgmentSpace === true;
  const reason = raw.noSafeReasonCode;
  if (typeof reason !== "string" || !(NO_SAFE_REASON_CODES as readonly string[]).includes(reason)) {
    errors.push("review_reason_code_invalid");
  }
  const remaining = strs(raw.remainingJudgmentDimensions);
  const violated = strs(raw.violatedBoundaryIds);
  const considered = strs(raw.boundaryIdsConsidered);

  // --- the no-safe contract ------------------------------------------------
  if (noSafe) {
    // A refusal must be SUPPORTED, not asserted.
    if (remaining.length > 0) errors.push("review_contradictory_no_safe_with_remaining_judgment");
    if (reason === "judgment_space_remains") errors.push("review_contradictory_no_safe_reason");
    if (reason === "all_options_violate_confirmed_boundary" && violated.length === 0) {
      errors.push("review_no_safe_unsupported");
    }
    if (reason === "prohibited_choice_only" && violated.length === 0 && considered.length === 0) {
      errors.push("review_no_safe_unsupported");
    }
  } else {
    // Not refusing → it must name what judgment actually remains.
    if (reason !== "judgment_space_remains") errors.push("review_contradictory_reason_without_no_safe");
    if (remaining.length === 0) errors.push("review_missing_remaining_judgment");
  }

  // --- coverage ------------------------------------------------------------
  const choices = Array.isArray(raw.primaryChoices) ? raw.primaryChoices : null;
  if (!choices) errors.push("review_choices_missing");
  else if (choices.length !== ctx.primaryCount) errors.push("review_choice_count_mismatch");

  const branches = Array.isArray(raw.branches) ? raw.branches : null;
  if (!branches) errors.push("review_branches_missing");
  else if (branches.length !== ctx.branchCount) errors.push("review_branch_count_mismatch");

  const choiceReviews: ChoiceReview[] = (choices ?? []).map((c, i) => {
    const o = isObj(c) ? c : {};
    if (typeof o.index !== "number" || o.index < 0 || o.index >= ctx.primaryCount) errors.push("review_choice_index_invalid");
    return {
      index: typeof o.index === "number" ? o.index : i,
      legitimateValue: typeof o.legitimateValue === "string" ? o.legitimateValue : "",
      acceptedCost: typeof o.acceptedCost === "string" ? o.acceptedCost : "",
      defensible: o.defensible === true,
      defectCodes: strs(o.defectCodes),
    };
  });

  const branchReviews: BranchReview[] = (branches ?? []).map((b, i) => {
    const o = isObj(b) ? b : {};
    if (typeof o.index !== "number" || o.index < 0 || o.index >= ctx.branchCount) errors.push("review_branch_index_invalid");
    return {
      index: typeof o.index === "number" ? o.index : i,
      selectedPrimarySummary: typeof o.selectedPrimarySummary === "string" ? o.selectedPrimarySummary : "",
      resultingWorldState: typeof o.resultingWorldState === "string" ? o.resultingWorldState : "",
      newConstraintOrPressure: typeof o.newConstraintOrPressure === "string" ? o.newConstraintOrPressure : "",
      nextDecisionDimension: typeof o.nextDecisionDimension === "string" ? o.nextDecisionDimension : "",
      repeatsPrimaryDecision: o.repeatsPrimaryDecision === true,
      overlapsOtherBranchIndex: typeof o.overlapsOtherBranchIndex === "number" ? o.overlapsOtherBranchIndex : -1,
      overlapReason: typeof o.overlapReason === "string" ? o.overlapReason : "",
      branchDistinct: o.branchDistinct === true,
      defectCodes: strs(o.defectCodes),
    };
  });

  // --- confirmed-boundary grounding (R2.21) --------------------------------
  // One assessment per confirmed boundary, mapped exactly once. c18 passed the old single
  // `boundaryCompliant` boolean while never mentioning its rule; that is now unrepresentable.
  const rawAssessments = Array.isArray(raw.boundaryAssessments) ? raw.boundaryAssessments : null;
  if (!rawAssessments) errors.push("review_boundary_assessments_missing");
  else if (rawAssessments.length !== ctx.constraintIds.length) errors.push("review_boundary_assessment_count_mismatch");

  const confirmedIds = new Set(ctx.constraintIds);
  const seenBoundaryIds = new Set<string>();
  const boundaryAssessments: BoundaryAssessment[] = (rawAssessments ?? []).map((a) => {
    const o = isObj(a) ? a : {};
    const id = typeof o.boundaryId === "string" ? o.boundaryId.trim() : "";
    if (!confirmedIds.has(id)) errors.push("review_unknown_boundary_reference");
    else if (seenBoundaryIds.has(id)) errors.push("review_duplicate_boundary_assessment");
    else seenBoundaryIds.add(id);
    return {
      boundaryId: id,
      presentInScenario: o.presentInScenario === true,
      operationalized: o.operationalized === true,
      affectedStages: strs(o.affectedStages).filter((s): s is DecisionStage => (DECISION_STAGES as readonly string[]).includes(s)),
      allPrimaryChoicesComply: o.allPrimaryChoicesComply === true,
      allBranchesPreserve: o.allBranchesPreserve === true,
      allTradeoffChoicesComply: o.allTradeoffChoicesComply === true,
      allActionChoicesComply: o.allActionChoicesComply === true,
      prohibitedAlternativeExcluded: o.prohibitedAlternativeExcluded === true,
      remainingJudgmentDimensions: strs(o.remainingJudgmentDimensions).filter((d) => d.trim().length > 0),
      violatedChoiceReferences: strs(o.violatedChoiceReferences).filter((d) => d.trim().length > 0),
      violatedBranchReferences: strs(o.violatedBranchReferences).filter((d) => d.trim().length > 0),
      defectCodes: strs(o.defectCodes),
      conciseExplanation: typeof o.conciseExplanation === "string" ? o.conciseExplanation : "",
    };
  });
  for (const id of ctx.constraintIds) if (!seenBoundaryIds.has(id)) errors.push("review_missing_boundary_assessment");

  // A confirmed rule NARROWS the choice space; it never authorises a refusal on its own. Claiming
  // every option violates the boundary requires at least one assessment that actually shows one.
  if (noSafe && reason === "all_options_violate_confirmed_boundary") {
    const shown = boundaryAssessments.some(
      (b) =>
        !b.allPrimaryChoicesComply || !b.allTradeoffChoicesComply || !b.allActionChoicesComply ||
        !b.allBranchesPreserve || b.violatedChoiceReferences.length > 0 || b.violatedBranchReferences.length > 0,
    );
    if (!shown) errors.push("review_no_safe_unsupported_by_boundary");
  }
  // Generation is expected → each boundary must name what judgment survives inside it.
  if (!noSafe) {
    for (const b of boundaryAssessments) {
      if (b.remainingJudgmentDimensions.length === 0) errors.push("review_boundary_missing_remaining_judgment");
    }
  }

  // --- urgency safety (R2.21) ----------------------------------------------
  const rawUrgency = isObj(raw.urgency) ? raw.urgency : null;
  if (!rawUrgency) errors.push("review_urgency_missing");
  const rawUrgencyChoices = Array.isArray(rawUrgency?.choices) ? (rawUrgency.choices as unknown[]) : null;
  if (rawUrgency && !rawUrgencyChoices) errors.push("review_urgency_choices_missing");
  else if (rawUrgencyChoices && rawUrgencyChoices.length !== ctx.primaryCount) errors.push("review_urgency_choice_count_mismatch");

  const urgencyChoices: UrgencyChoiceReview[] = (rawUrgencyChoices ?? []).map((c, i) => {
    const o = isObj(c) ? c : {};
    if (typeof o.index !== "number" || o.index < 0 || o.index >= ctx.primaryCount) errors.push("review_urgency_index_invalid");
    return {
      index: typeof o.index === "number" ? o.index : i,
      introducesDelay: o.introducesDelay === true,
      delayPurpose: typeof o.delayPurpose === "string" ? o.delayPurpose : "",
      safetyBasis: typeof o.safetyBasis === "string" ? o.safetyBasis : "",
      foreseeableHarm: typeof o.foreseeableHarm === "string" ? o.foreseeableHarm : "",
      escalationUsed: o.escalationUsed === true,
      defensible: o.defensible === true,
      defectCodes: strs(o.defectCodes),
    };
  });
  const urgencyVerdictRaw = rawUrgency?.overallUrgencyVerdict;
  if (urgencyVerdictRaw !== "safe" && urgencyVerdictRaw !== "unsafe" && urgencyVerdictRaw !== "not_applicable") {
    errors.push("review_urgency_verdict_invalid");
  }
  const urgency: UrgencyReview = {
    urgencyPresent: rawUrgency?.urgencyPresent === true,
    urgencySource: typeof rawUrgency?.urgencySource === "string" ? rawUrgency.urgencySource : "",
    timeSensitiveHarmPossible: rawUrgency?.timeSensitiveHarmPossible === true,
    choices: urgencyChoices,
    overallUrgencyVerdict: (urgencyVerdictRaw as UrgencyReview["overallUrgencyVerdict"]) ?? "not_applicable",
  };
  if (rawUrgency) {
    // Practice must not INVENT clinical or safety risk where the situation has none — that is how a
    // leadership rehearsal turns into a fake medical decision.
    if (!urgency.urgencyPresent) {
      if (urgency.timeSensitiveHarmPossible) errors.push("review_urgency_fabricated");
      if (urgencyChoices.some((c) => c.foreseeableHarm.trim().length > 0)) errors.push("review_urgency_fabricated");
      if (urgency.overallUrgencyVerdict === "unsafe") errors.push("review_urgency_contradictory");
    } else {
      if (!urgency.urgencySource.trim()) errors.push("review_urgency_unsupported");
      if (urgency.overallUrgencyVerdict === "not_applicable") errors.push("review_urgency_contradictory");
    }
    // An unsafe verdict that identifies no unsafe choice is contradictory in the other direction.
    if (
      urgency.overallUrgencyVerdict === "unsafe" &&
      !urgencyChoices.some((c) => !c.defensible || c.defectCodes.length > 0 || (c.introducesDelay && !c.safetyBasis.trim()))
    ) {
      errors.push("review_urgency_contradictory");
    }
  }

  const verdictRaw = raw.overallVerdict;
  if (verdictRaw !== "accept" && verdictRaw !== "reject") errors.push("review_verdict_invalid");
  const boundaryCompliant = raw.boundaryCompliant === true;

  if (errors.length) return { ok: false, errors };

  const value: SemanticReview = {
    noSafeJudgmentSpace: noSafe,
    noSafeReasonCode: reason as NoSafeReasonCode,
    boundaryIdsConsidered: considered,
    remainingJudgmentDimensions: remaining,
    violatedBoundaryIds: violated,
    explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    primaryChoices: choiceReviews,
    twoValuesInTension: raw.twoValuesInTension === true,
    tensionValueA: typeof raw.tensionValueA === "string" ? raw.tensionValueA : "",
    tensionValueB: typeof raw.tensionValueB === "string" ? raw.tensionValueB : "",
    branches: branchReviews,
    boundaryCompliant,
    boundaryAssessments,
    urgency,
    overallVerdict: verdictRaw as "accept" | "reject",
    defectCodes: strs(raw.defectCodes),
    retryInstruction: typeof raw.retryInstruction === "string" ? raw.retryInstruction : "",
  };

  if (value.noSafeJudgmentSpace) return { ok: true, value, verdict: "no_safe", reasonCode: value.noSafeReasonCode };

  // Collect the defects the detail fields actually establish.
  const defects: string[] = [];
  for (const c of choiceReviews) {
    if (!c.defensible) defects.push(...(c.defectCodes.length ? c.defectCodes : ["bad_faith_option"]));
    else defects.push(...c.defectCodes);
    if (!c.legitimateValue.trim() && c.defensible) defects.push("no_legitimate_value");
    if (!c.acceptedCost.trim() && c.defensible) defects.push("dominated_choice");
  }
  for (const b of branchReviews) {
    if (b.repeatsPrimaryDecision) defects.push("branch_repeats_primary");
    if (!b.branchDistinct || b.overlapsOtherBranchIndex >= 0) defects.push("branch_semantic_collapse");
    defects.push(...b.defectCodes);
  }
  if (!boundaryCompliant && ctx.constraintIds.length > 0) defects.push("boundary_violation");
  if (!value.twoValuesInTension) defects.push("no_value_tension");

  // BOUNDARY GROUNDING — silence about a rule is not compliance.
  for (const b of boundaryAssessments) {
    if (!b.presentInScenario) defects.push("confirmed_boundary_absent");
    if (!b.operationalized) defects.push("boundary_not_operationalized");
    // Present, claimed operational, yet biting no DECISION stage: deleting the rule would leave the
    // scenario unchanged. That is the exact c18 shape.
    if (b.presentInScenario && b.operationalized && !b.affectedStages.some((s) => OPERATIVE_STAGES.includes(s))) {
      defects.push("vacuous_boundary_compliance");
    }
    if (!b.allPrimaryChoicesComply || !b.allTradeoffChoicesComply || b.violatedChoiceReferences.length > 0) {
      defects.push("choice_bypasses_boundary");
    }
    if (!b.allActionChoicesComply) defects.push("action_reopens_boundary");
    if (!b.allBranchesPreserve || b.violatedBranchReferences.length > 0) defects.push("branch_drops_boundary");
    if (!b.prohibitedAlternativeExcluded) defects.push("boundary_treated_as_optional");
    defects.push(...b.defectCodes);
  }

  // URGENCY SAFETY — a pause to satisfy a safety rule is legitimate; a pause for convenience is not.
  if (urgency.overallUrgencyVerdict === "unsafe") defects.push("unsafe_delay");
  for (const c of urgency.choices) {
    // A delay with no stated safety basis is not defensible however it is described.
    if (c.introducesDelay && !c.safetyBasis.trim()) defects.push("unsafe_delay");
    if (c.foreseeableHarm.trim() && !c.safetyBasis.trim()) defects.push("avoidable_foreseeable_harm");
    if (!c.defensible) defects.push(...(c.defectCodes.length ? c.defectCodes : ["unsafe_delay"]));
    else defects.push(...c.defectCodes);
  }

  const unique = [...new Set(defects)];

  // A verdict that contradicts its own detail is not trustworthy in either direction.
  if (value.overallVerdict === "accept" && unique.length > 0) return { ok: false, errors: ["review_verdict_contradicts_details"] };
  if (value.overallVerdict === "reject" && unique.length === 0) return { ok: false, errors: ["review_reject_without_defect"] };

  return unique.length ? { ok: true, value, verdict: "reject", defects: unique } : { ok: true, value, verdict: "accept" };
}

// ---------------------------------------------------------------------------
// Defect-specific retry feedback
// ---------------------------------------------------------------------------

export type RetryContext = {
  attempt: number;
  defects: string[];
  choiceDefects: Array<{ index: number; codes: string[] }>;
  branchDefects: Array<{ index: number; codes: string[] }>;
  /** R2.21 — per-confirmed-boundary correction. `statement` is the CONFIRMED text, never a paraphrase. */
  boundaryDefects?: Array<{ boundaryId: string; statement: string; codes: string[] }>;
  /** R2.21 — per-primary-choice urgency correction. */
  urgencyDefects?: Array<{ index: number; codes: string[] }>;
  reviewerInstruction?: string;
};

/**
 * Build the correction message appended to the SECOND generation request.
 *
 * The measured retry defect was that the second request was byte-identical to the first: the model
 * was never told what failed, so c09 "recovered" by chance into an equally collapsed scenario. This
 * states the exact defects and positions, and pins everything that must NOT change.
 *
 * It carries no rejected scenario text, no reviewer chain-of-thought, and no infrastructure detail.
 */
export function buildRetryFeedback(ctx: RetryContext): string {
  const lines: string[] = [
    `ATTEMPT ${ctx.attempt} CORRECTION — your previous scenario was rejected by an independent review.`,
    `Rejection codes: ${ctx.defects.join(", ")}.`,
  ];

  for (const c of ctx.choiceDefects) {
    const n = c.index + 1;
    if (c.codes.includes("moral_decoy") || c.codes.includes("bad_faith_option")) {
      lines.push(
        `Primary choice ${n} is not defensible: it relies on concealment, evasion, negligence or bad faith. ` +
          `Replace it with a DIFFERENT strategy that a competent, well-intentioned person would choose — it must protect a named legitimate value and accept a real, stated cost. Keep the same underlying dilemma.`,
      );
    }
    if (c.codes.includes("no_legitimate_value")) lines.push(`Primary choice ${n} protects no legitimate value. Give it one, or replace it.`);
    if (c.codes.includes("dominated_choice")) lines.push(`Primary choice ${n} accepts no real cost, so it dominates the alternatives. Give it a genuine sacrifice.`);
    if (c.codes.includes("obvious_correct_answer")) lines.push(`Primary choice ${n} reads as the intended answer. Rebalance both options so neither is signposted.`);
    if (c.codes.includes("vague_evasion")) lines.push(`Primary choice ${n} is vague evasion. Name a concrete action and its cost.`);
  }

  for (const b of ctx.branchDefects) {
    const n = b.index + 1;
    if (b.codes.includes("branch_repeats_primary")) {
      lines.push(
        `Branch ${n} re-asks the primary question. The primary choice has ALREADY been made — treat it as done. ` +
          `Show the new situation it produced, then pose a DIFFERENT next decision (for example about scope, timing, escalation, ownership, evidence standard, documentation or recovery — choose what genuinely follows).`,
      );
    }
    if (b.codes.includes("branch_semantic_collapse")) {
      lines.push(
        `Branch ${n} is not meaningfully different from another branch. Each branch must follow causally from ITS OWN primary choice, ` +
          `introduce a concrete new fact or pressure, and lead to a different next decision. Do not reuse the same action labels across branches.`,
      );
    }
  }

  if (ctx.defects.includes("no_value_tension")) {
    lines.push("The two options do not put two legitimate values in genuine tension. Make the tension explicit in what each protects and gives up.");
  }
  if (ctx.defects.includes("boundary_violation")) {
    lines.push("A choice crossed a confirmed non-negotiable boundary. Every path must fully obey every constraint; put the difficulty in HOW to comply.");
  }

  // BOUNDARY GROUNDING (R2.21) — the confirmed statement is restated verbatim so the correction can
  // never drift into a weaker rule than the Manager confirmed.
  for (const b of ctx.boundaryDefects ?? []) {
    const rule = `confirmed rule [${b.boundaryId}] "${b.statement}"`;
    if (b.codes.includes("confirmed_boundary_absent")) {
      lines.push(
        `The ${rule} does not appear in the scenario at all. Establish it in the opening or immediate context in natural language a person in this role would actually use, ` +
          `then regenerate the decisions so the rule ACTIVELY constrains what can be chosen. Do not state it as a policy quotation or a lecture.`,
      );
    }
    if (b.codes.includes("boundary_not_operationalized") || b.codes.includes("vacuous_boundary_compliance")) {
      lines.push(
        `The ${rule} is present but changes nothing: the choices and branch consequences would read identically if it were deleted. ` +
          `Make it bite — it must rule out a tempting option and shape what each remaining option costs. Do not append it as decorative text.`,
      );
    }
    if (b.codes.includes("choice_bypasses_boundary")) {
      lines.push(`A choice bypasses the ${rule}. Replace that choice, keeping the legitimate decision tension INSIDE the rule — never make obeying it one of the options.`);
    }
    if (b.codes.includes("branch_drops_boundary")) {
      lines.push(`A branch stops honouring the ${rule} after the primary consequence. The rule holds for the whole scenario; every consequence must preserve it.`);
    }
    if (b.codes.includes("action_reopens_boundary")) {
      lines.push(`An action choice reopens or waives the ${rule}. The action decision may not put the rule back on the table.`);
    }
    if (b.codes.includes("boundary_treated_as_optional")) {
      lines.push(`The ${rule} reads as advisory. It is non-negotiable: show the prohibited alternative being excluded, not weighed.`);
    }
  }

  // URGENCY SAFETY (R2.21) — never resolved by refusing to generate; resolved by a competent option.
  for (const u of ctx.urgencyDefects ?? []) {
    const n = u.index + 1;
    if (u.codes.includes("unsafe_delay") || u.codes.includes("convenience_over_safety") || u.codes.includes("avoidable_foreseeable_harm")) {
      lines.push(
        `Primary choice ${n} delays urgent or time-sensitive action without a safety or verification basis, so it creates foreseeable harm for convenience. ` +
          `Replace it with a competent leadership option that protects safety AND a real operational value — for example sequencing work so the mandatory check still happens, reallocating staff, or redirecting when safe capacity is unavailable. A short pause REQUIRED by a safety rule is acceptable; an unexplained delay is not.`,
      );
    }
    if (u.codes.includes("missing_required_escalation")) {
      lines.push(
        `Primary choice ${n} leaves an unsafe capacity or supervision situation un-escalated. Give it a defensible escalation, staffing, supervision or referral response using only resources the training context supports — do not invent people, teams or capacity that were never mentioned.`,
      );
    }
  }

  if (ctx.reviewerInstruction?.trim()) lines.push(`Reviewer note: ${ctx.reviewerInstruction.trim()}`);

  lines.push(
    "UNCHANGED: the training facts, the confirmed boundaries, the output language, the role, the scenario purpose, and the required JSON shape. Return the complete corrected scenario.",
  );
  return lines.join("\n");
}
