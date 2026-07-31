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
    overallVerdict: { type: "string", enum: ["accept", "reject"] },
    defectCodes: strArray,
    retryInstruction: { type: "string" },
  },
  required: [
    "noSafeJudgmentSpace", "noSafeReasonCode", "boundaryIdsConsidered", "remainingJudgmentDimensions",
    "violatedBoundaryIds", "explanation", "primaryChoices", "twoValuesInTension", "tensionValueA",
    "tensionValueB", "branches", "boundaryCompliant", "overallVerdict", "defectCodes", "retryInstruction",
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
  if (ctx.reviewerInstruction?.trim()) lines.push(`Reviewer note: ${ctx.reviewerInstruction.trim()}`);

  lines.push(
    "UNCHANGED: the training facts, the confirmed boundaries, the output language, the role, the scenario purpose, and the required JSON shape. Return the complete corrected scenario.",
  );
  return lines.join("\n");
}
