/**
 * CANONICAL ASSESSMENT-STATE PARITY TABLE (Slice 3.2I-R5B1A.1-R2.32).
 *
 * THE MEASURED DEFECT (R2.31 over the R2.30 live run)
 *
 * Two live narrow-review responses completed normally — `finishReason: stop`, provider schema
 * PASSED, exact 1 × 12 Cartesian coverage, every evidence field grounded. Both were thrown away
 * because `applies`-state assessments carried `reason: ""`.
 *
 *     schema     `reason` required for PRESENCE, no minLength → "" is schema-valid
 *     prompt     mentions `reason` ONCE, only for `other_grounded_violation`
 *     validator  `if (!a.reason.trim()) push("boundary_reason_missing")` — unconditional
 *
 *     applicability = applies         → reason "" on 7/7 rows across both attempts
 *     applicability = not_applicable  → reason non-empty on 17/17 rows
 *
 * The model obeyed the contract it received. Three documents disagreed about one field, and the
 * disagreement was invisible because each was hand-maintained.
 *
 * THIS MODULE IS THE SINGLE SOURCE.
 *
 * The prompt rules are GENERATED from this table, the validator reads its requirements from this
 * table, the server explanation switches on its states, and the tests assert against it. There is
 * no second hand-written list of state rules that can drift from this one.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";

export const PARITY_TABLE_VERSION = "practice-boundary-reason-parity/1";

/**
 * WHO owns the human-readable explanation for a state.
 *
 * `server_derived` — every semantic input already exists in structured, grounded fields, so prose
 *                    adds nothing a verdict can use. The server renders it.
 * `model_required` — the meaning is NOT encoded by any structured field: which ambiguity blocks a
 *                    judgment, or which mechanism the enum could not name.
 */
export const REASON_AUTHORITIES = ["server_derived", "model_required"] as const;
export type ReasonAuthority = (typeof REASON_AUTHORITIES)[number];

export const ASSESSMENT_STATE_IDS = [
  "not_applicable",
  "applicability_uncertain",
  "complies",
  "violates_registered_mechanism",
  "violates_other_mechanism",
  "compliance_uncertain",
] as const;
export type AssessmentStateId = (typeof ASSESSMENT_STATE_IDS)[number];

export type AssessmentStateRule = {
  id: AssessmentStateId;
  applicability: "applies" | "not_applicable" | "uncertain";
  /** `not_assessed` whenever applicability is not `applies`. */
  compliance: "complies" | "violates" | "uncertain" | "not_assessed";
  /** `none` | `registered` (any mechanism but `none`/`other`) | `other_grounded_violation`. */
  mechanismClass: "none" | "registered" | "other_grounded_violation";
  /** Evidence fields that must be non-empty AND grounded for this state. */
  requiredEvidence: Array<"governedActionEvidence" | "prerequisiteFailureEvidence">;
  /** Evidence fields that must be EMPTY for this state — a claim they do not support. */
  prohibitedEvidence: Array<"prerequisiteFailureEvidence">;
  reasonAuthority: ReasonAuthority;
  /** Short product-facing statement of what the reviewer must do. Rendered into the prompt. */
  promptRule: string;
  /** What the server explanation is composed from. Empty for `model_required` states. */
  explanationSource: string[];
};

/** Any mechanism that is neither `none` nor the open-ended one. */
export const REGISTERED_MECHANISMS = [
  "governed_action_without_prerequisite",
  "resulting_state_missing_prerequisite",
  "boundary_reopened_after_prior_compliance",
  "explicit_boundary_contradiction",
] as const;

/**
 * THE TABLE. Six states, exhaustive over the valid (applicability × compliance × mechanism) space.
 */
export const ASSESSMENT_STATES: readonly AssessmentStateRule[] = [
  {
    id: "not_applicable",
    applicability: "not_applicable",
    compliance: "not_assessed",
    mechanismClass: "none",
    requiredEvidence: ["governedActionEvidence"],
    prohibitedEvidence: ["prerequisiteFailureEvidence"],
    reasonAuthority: "server_derived",
    promptRule:
      "not_applicable — the boundary does not govern this surface. Quote what the surface DOES in governedActionEvidence. Leave prerequisiteFailureEvidence and reason empty.",
    explanationSource: ["surfaceRef", "boundaryId", "governedActionEvidence"],
  },
  {
    id: "applicability_uncertain",
    applicability: "uncertain",
    compliance: "not_assessed",
    mechanismClass: "none",
    // There may genuinely be nothing to excerpt when the text is the problem.
    requiredEvidence: [],
    prohibitedEvidence: ["prerequisiteFailureEvidence"],
    reasonAuthority: "model_required",
    promptRule:
      "uncertain (applicability) — you cannot tell whether the boundary governs this surface. Name the EXACT ambiguity in reason. This is the one place your own words are required.",
    explanationSource: [],
  },
  {
    id: "complies",
    applicability: "applies",
    compliance: "complies",
    mechanismClass: "none",
    requiredEvidence: ["governedActionEvidence"],
    prohibitedEvidence: ["prerequisiteFailureEvidence"],
    reasonAuthority: "server_derived",
    promptRule:
      "applies + complies — the governed action happens with the rule satisfied, or the surface preserves it. Quote the governed action in governedActionEvidence. Leave prerequisiteFailureEvidence and reason empty.",
    explanationSource: ["surfaceRef", "boundaryId", "boundaryStatement", "governedActionEvidence"],
  },
  {
    id: "violates_registered_mechanism",
    applicability: "applies",
    compliance: "violates",
    mechanismClass: "registered",
    requiredEvidence: ["governedActionEvidence", "prerequisiteFailureEvidence"],
    prohibitedEvidence: [],
    reasonAuthority: "server_derived",
    promptRule:
      "applies + violates with a named mechanism — quote the governed action AND the prerequisite failure, and name the mechanism. Leave reason empty: the mechanism and the two excerpts already say it.",
    explanationSource: ["surfaceRef", "boundaryId", "boundaryStatement", "violationMechanism", "governedActionEvidence", "prerequisiteFailureEvidence"],
  },
  {
    id: "violates_other_mechanism",
    applicability: "applies",
    compliance: "violates",
    mechanismClass: "other_grounded_violation",
    requiredEvidence: ["governedActionEvidence", "prerequisiteFailureEvidence"],
    prohibitedEvidence: [],
    reasonAuthority: "model_required",
    promptRule:
      "applies + violates via other_grounded_violation — a real mechanism the list does not name. Quote both excerpts AND explain the mechanism in reason, because no enum value carries it.",
    explanationSource: [],
  },
  {
    id: "compliance_uncertain",
    applicability: "applies",
    compliance: "uncertain",
    mechanismClass: "none",
    requiredEvidence: ["governedActionEvidence"],
    prohibitedEvidence: ["prerequisiteFailureEvidence"],
    reasonAuthority: "model_required",
    promptRule:
      "applies + uncertain — the boundary governs this surface but the text does not settle compliance. Quote the governed action, then name the EXACT ambiguity in reason.",
    explanationSource: [],
  },
] as const;

/** The shape `classifyAssessmentState` reads. Deliberately structural, not the full DTO type. */
export type ClassifiableAssessment = {
  applicability: string;
  compliance: string;
  violationMechanism: string;
};

/**
 * Which canonical state is this assessment in? `null` means the combination is not a valid state at
 * all — an output-contract failure, never a semantic finding.
 */
export function classifyAssessmentState(a: ClassifiableAssessment): AssessmentStateRule | null {
  const mechanismClass: AssessmentStateRule["mechanismClass"] =
    a.violationMechanism === "other_grounded_violation"
      ? "other_grounded_violation"
      : (REGISTERED_MECHANISMS as readonly string[]).includes(a.violationMechanism)
        ? "registered"
        : "none";
  return (
    ASSESSMENT_STATES.find(
      (s) => s.applicability === a.applicability && s.compliance === a.compliance && s.mechanismClass === mechanismClass,
    ) ?? null
  );
}

export const requiresModelReason = (s: AssessmentStateRule): boolean => s.reasonAuthority === "model_required";

/** States whose explanation the server owns — listed so a test can assert the split directly. */
export const SERVER_DERIVED_STATES = ASSESSMENT_STATES.filter((s) => s.reasonAuthority === "server_derived").map((s) => s.id);
export const MODEL_REQUIRED_STATES = ASSESSMENT_STATES.filter((s) => s.reasonAuthority === "model_required").map((s) => s.id);

/**
 * The shortest text that can name an ambiguity or an unnamed mechanism. Below this the field is
 * filler, and filler is exactly what a blanket non-empty rule produces.
 */
export const MODEL_REASON_MIN_CHARS = 12;

/**
 * Prose that asserts a conclusion instead of naming the ambiguity. R2.29 measured the
 * absence-of-mention family; these are its equivalents for the reason field.
 */
export const GENERIC_REASON_PHRASES = [
  "unclear",
  "not clear",
  "uncertain",
  "cannot tell",
  "not sure",
  "ambiguous",
  "needs review",
  "see evidence",
  "n a",
  "none",
] as const;

/** Comparison form for the generic-prose guard. */
export const normalizeReason = (s: string): string =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/**
 * PROMPT RULES, GENERATED. The prompt is assembled from this array, so a state rule cannot be
 * changed here without changing what the reviewer is told — the exact drift R2.31 measured.
 */
export function renderPromptStateRules(): string[] {
  return ASSESSMENT_STATES.map((s) => `  ${s.promptRule}`);
}

export function renderReasonPolicyLines(): string[] {
  const serverStates = ASSESSMENT_STATES.filter((s) => s.reasonAuthority === "server_derived");
  const modelStates = ASSESSMENT_STATES.filter((s) => s.reasonAuthority === "model_required");
  return [
    "THE `reason` FIELD — READ THIS BEFORE YOU WRITE ANY.",
    `Leave reason as an EMPTY STRING for: ${serverStates.map((s) => s.id).join(", ")}. For these the structured fields already carry the whole meaning, and the human-readable explanation is composed by the server. Prose here adds nothing and is ignored.`,
    `Write a concise, specific reason ONLY for: ${modelStates.map((s) => s.id).join(", ")}. These are the states where no structured field can carry the meaning: which ambiguity blocks the judgment, or which mechanism the enum could not name.`,
    `A required reason must be at least ${MODEL_REASON_MIN_CHARS} characters after trimming and must name the specific thing. "unclear", "ambiguous" or "see evidence" are not reasons.`,
    "Never write filler to fill a field. An empty reason in a server-derived state is correct and expected.",
  ];
}

/** Digest over the whole table — the contract a runner and an artifact bind to. */
export function parityTableSha256(): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: PARITY_TABLE_VERSION,
        states: ASSESSMENT_STATES,
        registeredMechanisms: REGISTERED_MECHANISMS,
        minChars: MODEL_REASON_MIN_CHARS,
        genericPhrases: GENERIC_REASON_PHRASES,
      }),
    )
    .digest("hex");
}
