/**
 * NARROW CONFIRMED-BOUNDARY REVIEW — APPLICABILITY FIRST (Slice 3.2I-R5B1A.1-R2.30).
 *
 * WHAT R2.29 GOT RIGHT, AND WHAT IT GOT WRONG
 *
 * The live c18 run correctly returned `boundary_review_reject` and correctly identified four real
 * violations. It also returned five it could not support, all on one rationale family:
 *
 *     flat_tradeoff[1]       "requesting additional staff"                          → "Does not address verification of identifiers."
 *     branch[1].tradeoff[0]  "Prepare a summary of events for the administrator"    → "Does not address verification of identifiers."
 *     branch[1].action[0]    "Finish the summary and send it to the administrator"  → "Does not address verification of identifiers."
 *
 * Requesting staff, writing a summary and sending it to an administrator do not treat a patient.
 * None of them authorizes, continues or produces the governed action. The old contract had no way to
 * say so: every surface was forced into complies/violates, so "this surface is silent about the rule"
 * collapsed into "this surface breaks the rule".
 *
 * THE CORRECTION — TWO QUESTIONS, IN ORDER
 *
 *   1. APPLICABILITY. Does this surface initiate, authorize, continue, reopen or produce the
 *      governed action or state? `not_applicable` is a first-class, evidenced answer.
 *   2. COMPLIANCE. Only for `applies` surfaces.
 *
 * And a violation must now prove a MECHANISM, not an absence: the governed action must be shown
 * present (`governedActionEvidence`) AND the prerequisite shown missing (`prerequisiteFailureEvidence`).
 * "Does not mention verification" cannot satisfy either, so it can no longer produce a violation.
 *
 * Pure domain: no I/O, no provider, no DB, no clock.
 */

import { MAX_ACTIVE_BOUNDARIES } from "./boundaryScope";
import { BRANCH_AWARE_REACHABLE_SURFACE_COUNT, type BoundarySurface } from "./boundarySurfaces";
import { explainAll, type ServerExplanation } from "./boundaryExplanation";
import {
  GENERIC_REASON_PHRASES,
  MODEL_REASON_MIN_CHARS,
  classifyAssessmentState,
  normalizeReason,
  type AssessmentStateRule,
} from "./boundaryReasonParity";

export const NARROW_BOUNDARY_SCHEMA_NAME = "bty_practice_boundary_surface_review_v2";
export const NARROW_BOUNDARY_CONTRACT_VERSION = "practice-narrow-boundary-review/2";

/**
 * Bounded so the schema's permitted maximum stays well under the model output cap. Worst case is
 * MAX_ACTIVE_BOUNDARIES × the reachable surface count; every character is multiplied by that, and by
 * roughly one token per character in Korean.
 */
export const NARROW_EVIDENCE_MAX = 120;
export const NARROW_REASON_MAX = 100;
export const NARROW_BOUNDARY_ID_MAX = 48;
export const NARROW_SURFACE_REF_MAX = 48;
export const MAX_NARROW_ASSESSMENTS = MAX_ACTIVE_BOUNDARIES * BRANCH_AWARE_REACHABLE_SURFACE_COUNT;

/** Does the boundary govern this surface at all? Asked BEFORE compliance. */
export const APPLICABILITY_RESULTS = ["applies", "not_applicable", "uncertain"] as const;
export type ApplicabilityResult = (typeof APPLICABILITY_RESULTS)[number];

/** Only meaningful for an `applies` surface. `not_assessed` is the required value otherwise. */
export const COMPLIANCE_RESULTS = ["complies", "violates", "uncertain", "not_assessed"] as const;
export type ComplianceResult = (typeof COMPLIANCE_RESULTS)[number];

/** HOW the boundary is broken. A violation with `none` is not a violation, it is an assertion. */
export const VIOLATION_MECHANISMS = [
  "none",
  /** The surface commits to the governed action while the prerequisite is unmet. */
  "governed_action_without_prerequisite",
  /** The asserted state already contains the governed action having happened without the prerequisite. */
  "resulting_state_missing_prerequisite",
  /** The prerequisite was satisfied earlier and this surface undoes or bypasses it. */
  "boundary_reopened_after_prior_compliance",
  /** The surface states something the rule forbids outright. */
  "explicit_boundary_contradiction",
  "other_grounded_violation",
] as const;
export type ViolationMechanism = (typeof VIOLATION_MECHANISMS)[number];

export type NarrowBoundaryAssessment = {
  boundaryId: string;
  /** A canonical coordinate from the server's reachable surface map. Never invented. */
  surfaceRef: string;
  applicability: ApplicabilityResult;
  compliance: ComplianceResult;
  /**
   * A same-surface excerpt showing WHAT THE SURFACE DOES. For `applies` it shows the governed
   * action or state; for `not_applicable` it shows the non-governed action that is actually there.
   */
  governedActionEvidence: string;
  /** For a violation: the excerpt showing the prerequisite missing, bypassed or contradicted. */
  prerequisiteFailureEvidence: string;
  violationMechanism: ViolationMechanism;
  reason: string;
};

export type NarrowBoundaryReview = { assessments: NarrowBoundaryAssessment[] };

/**
 * The strict provider schema.
 *
 * Deliberately absent: `overallVerdict`, `boundaryCompliant`, `violatedBoundaryIds`,
 * `retryInstruction`, and any aggregate conclusion. The server derives the result.
 */
export const NARROW_BOUNDARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assessments: {
      type: "array",
      minItems: 1,
      maxItems: MAX_NARROW_ASSESSMENTS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          boundaryId: { type: "string", maxLength: NARROW_BOUNDARY_ID_MAX },
          surfaceRef: { type: "string", maxLength: NARROW_SURFACE_REF_MAX },
          applicability: { type: "string", enum: [...APPLICABILITY_RESULTS] },
          compliance: { type: "string", enum: [...COMPLIANCE_RESULTS] },
          governedActionEvidence: { type: "string", maxLength: NARROW_EVIDENCE_MAX },
          prerequisiteFailureEvidence: { type: "string", maxLength: NARROW_EVIDENCE_MAX },
          violationMechanism: { type: "string", enum: [...VIOLATION_MECHANISMS] },
          reason: { type: "string", maxLength: NARROW_REASON_MAX },
        },
        required: [
          "boundaryId",
          "surfaceRef",
          "applicability",
          "compliance",
          "governedActionEvidence",
          "prerequisiteFailureEvidence",
          "violationMechanism",
          "reason",
        ],
      },
    },
  },
  required: ["assessments"],
} as const;

// ---------------------------------------------------------------------------
// Defect codes
// ---------------------------------------------------------------------------

export const NARROW_COVERAGE_CODES = [
  "boundary_review_truncated",
  "boundary_review_not_json",
  "boundary_review_not_an_object",
  "boundary_review_assessments_missing",
  "boundary_review_missing_pair",
  "boundary_review_extra_pair",
  "boundary_review_duplicate_pair",
  "boundary_review_unknown_boundary",
  "boundary_review_unknown_surface",
  "boundary_review_unreviewable_surface",
  "boundary_review_invalid_result",
] as const;

export const NARROW_GROUNDING_CODES = [
  "boundary_evidence_missing",
  "boundary_evidence_generic",
  "boundary_evidence_too_short",
  "boundary_evidence_from_other_surface",
  "boundary_evidence_restates_boundary",
  "boundary_evidence_ungrounded",
  /**
   * R2.32 — `boundary_reason_missing` (an unconditional non-empty requirement) is REMOVED. It
   * discarded two complete live responses over a field no verdict used. Its replacements fire only
   * where the parity table says the model's own words are the only possible source.
   */
  "boundary_reason_required_missing",
  "boundary_reason_generic",
  "boundary_assessment_state_invalid",
  /** `violates` with no governed action shown — the R2.28/R2.29 "does not mention it" shape. */
  "boundary_violation_mechanism_missing",
  "boundary_violation_governed_action_missing",
  "boundary_violation_prerequisite_evidence_missing",
  /** A compliance result that contradicts its applicability. */
  "boundary_applicability_compliance_mismatch",
] as const;

export const NARROW_BOUNDARY_CODES = [...NARROW_COVERAGE_CODES, ...NARROW_GROUNDING_CODES] as const;
export type NarrowBoundaryCode = (typeof NARROW_BOUNDARY_CODES)[number];

/**
 * R2.32 Part 7 — codes where the response satisfied the PROVIDER contract (parsed, schema-valid,
 * fully covered) and failed the SERVER's state contract. Distinct from a coverage failure and from
 * a grounding failure, because the remedy is different: the parity table or the prompt is wrong,
 * not the model's evidence.
 */
export const OUTPUT_CONTRACT_CODES = [
  "boundary_reason_required_missing",
  "boundary_reason_generic",
  "boundary_assessment_state_invalid",
  "boundary_applicability_compliance_mismatch",
] as const;

export const COVERAGE_FAILURE_CODES = [...NARROW_COVERAGE_CODES] as readonly string[];

export type NarrowFailureClass = "coverage" | "grounding" | "output_contract";

/** The single classifier. Coverage outranks output-contract, which outranks grounding. */
export function classifyFailure(codes: readonly string[]): NarrowFailureClass {
  if (codes.some((c) => COVERAGE_FAILURE_CODES.includes(c))) return "coverage";
  if (codes.some((c) => (OUTPUT_CONTRACT_CODES as readonly string[]).includes(c))) return "output_contract";
  return "grounding";
}

/**
 * Phrases that assert a conclusion instead of showing the text that supports it, PLUS the exact
 * absence-of-mention family R2.29 measured. This is a GUARD, never the semantic authority: grounding
 * is proved by same-surface excerpt containment below.
 */
export const GENERIC_EVIDENCE_PHRASES = [
  "complies with the boundary",
  "complies with the rule",
  "safe and appropriate",
  "follows the rule",
  "follows the boundary",
  "meets the requirement",
  "no violation",
  "not a violation",
  "is compliant",
  "fully compliant",
  "ensuring compliance",
  "adheres to the boundary",
  "respects the boundary",
  "boundary is respected",
  "boundary is operational",
  // R2.30 — the measured false-positive rationale family. Absence of mention is not evidence.
  "does not address verification",
  "does not address verification of identifiers",
  "does not mention verification",
  "no verification mentioned",
  "does not mention the boundary",
  "does not address the boundary",
] as const;

/** Shortest excerpt that can prove anything. Below this, containment is coincidence. */
export const MIN_EVIDENCE_CHARS = 12;

/** Comparison form: lowercase, punctuation-insensitive, whitespace-collapsed. */
export function normalizeForGrounding(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const surfacePairKey = (boundaryId: string, surfaceRef: string): string => `${boundaryId} ${surfaceRef}`;

// ---------------------------------------------------------------------------
// Coverage + grounding validation
// ---------------------------------------------------------------------------

export type NarrowReviewContext = {
  boundaries: Array<{ id: string; statement: string }>;
  /** ONLY the reachable surfaces. Compatibility projections never enter the matrix. */
  surfaces: BoundarySurface[];
};

export type GroundingFinding = { boundaryId: string; surfaceRef: string; code: NarrowBoundaryCode };

export type NarrowValidationResult =
  | { ok: true; value: NarrowBoundaryReview }
  | { ok: false; codes: NarrowBoundaryCode[]; findings: GroundingFinding[]; value: NarrowBoundaryReview | null };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const oneOf = <T extends readonly string[]>(set: T, v: unknown, fallback: T[number]): T[number] =>
  (set as readonly string[]).includes(str(v)) ? (str(v) as T[number]) : fallback;

/**
 * Prove EXACT Cartesian coverage over the REACHABLE surfaces, then prove every answer is grounded.
 *
 * Two grounding corpora, because they answer different questions:
 *   own text        — what this surface itself does  → `governedActionEvidence`
 *   own + premise   — the world state and escalation this surface happens inside of
 *                     → `prerequisiteFailureEvidence`, because a treatment action's missing
 *                       prerequisite is usually stated by the branch world, not by the label.
 */
export function validateNarrowBoundaryReview(raw: unknown, ctx: NarrowReviewContext): NarrowValidationResult {
  const codes: NarrowBoundaryCode[] = [];
  const findings: GroundingFinding[] = [];

  if (!isObj(raw)) return { ok: false, codes: ["boundary_review_not_an_object"], findings, value: null };
  const rawList = Array.isArray(raw.assessments) ? raw.assessments : null;
  if (!rawList) return { ok: false, codes: ["boundary_review_assessments_missing"], findings, value: null };

  const assessments: NarrowBoundaryAssessment[] = rawList.map((a) => {
    const o = isObj(a) ? a : {};
    return {
      boundaryId: str(o.boundaryId).trim(),
      surfaceRef: str(o.surfaceRef).trim(),
      applicability: oneOf(APPLICABILITY_RESULTS, o.applicability, "uncertain"),
      compliance: oneOf(COMPLIANCE_RESULTS, o.compliance, "not_assessed"),
      governedActionEvidence: str(o.governedActionEvidence),
      prerequisiteFailureEvidence: str(o.prerequisiteFailureEvidence),
      violationMechanism: oneOf(VIOLATION_MECHANISMS, o.violationMechanism, "none"),
      reason: str(o.reason),
    };
  });
  const value: NarrowBoundaryReview = { assessments };

  for (const a of rawList) {
    const o = isObj(a) ? a : {};
    if (
      !(APPLICABILITY_RESULTS as readonly string[]).includes(str(o.applicability)) ||
      !(COMPLIANCE_RESULTS as readonly string[]).includes(str(o.compliance)) ||
      !(VIOLATION_MECHANISMS as readonly string[]).includes(str(o.violationMechanism))
    ) {
      codes.push("boundary_review_invalid_result");
    }
  }

  // --- exact Cartesian coverage over REACHABLE surfaces ----------------------
  const boundaryIds = new Set(ctx.boundaries.map((b) => b.id));
  const surfaceByRef = new Map(ctx.surfaces.map((s) => [s.coordinate, s]));
  const required = new Set<string>();
  for (const b of ctx.boundaries) for (const s of ctx.surfaces) required.add(surfacePairKey(b.id, s.coordinate));

  const seen = new Set<string>();
  for (const a of assessments) {
    if (!boundaryIds.has(a.boundaryId)) {
      codes.push("boundary_review_unknown_boundary");
      continue;
    }
    const surface = surfaceByRef.get(a.surfaceRef);
    if (!surface) {
      codes.push("boundary_review_unknown_surface");
      continue;
    }
    // A compatibility projection can never be handed to the reviewer, so an answer about one means
    // the request and the map disagree.
    if (surface.reachability === "compatibility_projection") {
      codes.push("boundary_review_unreviewable_surface");
      continue;
    }
    const key = surfacePairKey(a.boundaryId, a.surfaceRef);
    if (seen.has(key)) codes.push("boundary_review_duplicate_pair");
    else if (!required.has(key)) codes.push("boundary_review_extra_pair");
    seen.add(key);
  }
  for (const key of required) if (!seen.has(key)) codes.push("boundary_review_missing_pair");

  if (codes.length > 0) return { ok: false, codes: [...new Set(codes)], findings, value };

  // --- grounding + semantic shape -------------------------------------------
  const ownText = new Map(ctx.surfaces.map((s) => [s.coordinate, normalizeForGrounding(s.text)]));
  const premiseText = new Map(
    ctx.surfaces.map((s) => [s.coordinate, normalizeForGrounding([s.text, s.inheritedWorldState, s.branchContext].filter(Boolean).join(" "))]),
  );
  const boundaryText = new Map(ctx.boundaries.map((b) => [b.id, normalizeForGrounding(b.statement)]));

  for (const a of assessments) {
    const push = (code: NarrowBoundaryCode) => {
      codes.push(code);
      findings.push({ boundaryId: a.boundaryId, surfaceRef: a.surfaceRef, code });
    };

    // R2.32 — the CANONICAL PARITY TABLE decides what this assessment must carry. There is no
    // second hand-written rule set here; a state that is not in the table is not a state.
    const state: AssessmentStateRule | null = classifyAssessmentState(a);
    if (!state) {
      push("boundary_assessment_state_invalid");
      continue;
    }

    // `reason` is required ONLY where no structured field can carry the meaning: which ambiguity
    // blocks the judgment, or which mechanism the enum could not name. Everywhere else the server
    // renders the explanation and prose here is IGNORED — never an alternate authority, and never
    // a failure. R2.31 measured two complete live responses discarded by the old blanket rule.
    if (state.reasonAuthority === "model_required") {
      const trimmed = a.reason.trim();
      if (trimmed.length < MODEL_REASON_MIN_CHARS) push("boundary_reason_required_missing");
      else if (GENERIC_REASON_PHRASES.includes(normalizeReason(trimmed) as (typeof GENERIC_REASON_PHRASES)[number])) {
        push("boundary_reason_generic");
      }
    }

    /** Grounded excerpt check against one corpus. Returns a code, or null when grounded. */
    const check = (excerpt: string, corpus: string, allowOtherSurfaceScan: boolean): NarrowBoundaryCode | null => {
      const e = normalizeForGrounding(excerpt);
      if (!e) return "boundary_evidence_missing";
      if (GENERIC_EVIDENCE_PHRASES.some((p) => e === p || e.includes(p))) return "boundary_evidence_generic";
      if (e.length < MIN_EVIDENCE_CHARS) return "boundary_evidence_too_short";
      if (corpus.includes(e)) return null;
      const bt = boundaryText.get(a.boundaryId) ?? "";
      if (bt && bt.includes(e)) return "boundary_evidence_restates_boundary";
      if (allowOtherSurfaceScan && [...ownText.entries()].some(([ref, t]) => ref !== a.surfaceRef && t.includes(e))) {
        return "boundary_evidence_from_other_surface";
      }
      return "boundary_evidence_ungrounded";
    };

    const own = ownText.get(a.surfaceRef) ?? "";
    const premise = premiseText.get(a.surfaceRef) ?? "";

    // Required evidence comes from the table, so a state's obligations live in exactly one place.
    if (state.requiredEvidence.includes("governedActionEvidence")) {
      const govCode = check(a.governedActionEvidence, own, true);
      if (govCode) push(govCode);
    }

    if (a.compliance === "violates") {
      // A VIOLATION MUST SHOW A MECHANISM. Absence of mention cannot reach this point.
      if (a.violationMechanism === "none") push("boundary_violation_mechanism_missing");
      if (!a.governedActionEvidence.trim()) push("boundary_violation_governed_action_missing");
      if (!a.prerequisiteFailureEvidence.trim()) push("boundary_violation_prerequisite_evidence_missing");
      else {
        const preCode = check(a.prerequisiteFailureEvidence, premise, false);
        if (preCode) push(preCode);
      }
    } else if (state.prohibitedEvidence.includes("prerequisiteFailureEvidence") && a.prerequisiteFailureEvidence.trim()) {
      // A state that cannot have a prerequisite failure claims one. It disagrees with itself.
      push("boundary_applicability_compliance_mismatch");
    }
  }

  if (codes.length > 0) return { ok: false, codes: [...new Set(codes)], findings, value };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Server-derived verdict
// ---------------------------------------------------------------------------

export const BOUNDARY_REVIEW_OUTCOMES = [
  "boundary_review_pass",
  "boundary_review_reject",
  "boundary_review_inconclusive",
  "boundary_review_malformed",
  "boundary_review_not_applicable",
] as const;
export type BoundaryReviewOutcome = (typeof BOUNDARY_REVIEW_OUTCOMES)[number];

export type BoundaryViolation = {
  boundaryId: string;
  boundaryStatement: string;
  surfaceRef: string;
  governedActionEvidence: string;
  prerequisiteFailureEvidence: string;
  violationMechanism: ViolationMechanism;
  reason: string;
  /** Causal ancestors of this surface, nearest-first. */
  lineage: string[];
  /** True when an ancestor already violates with the same mechanism AND governed action. */
  downstreamOfPriorViolation: boolean;
  /** True when it violates with no violating ancestor at all. */
  earliestCausal: boolean;
};

export type BoundaryUncertainty = { boundaryId: string; surfaceRef: string; reason: string; level: "applicability" | "compliance" };

export type DerivedBoundaryVerdict =
  | { outcome: "boundary_review_pass"; assessedPairs: number; notApplicableCount: number; explanations: ServerExplanation[] }
  | {
      outcome: "boundary_review_reject";
      /** Every grounded violation, in surface order. */
      violations: BoundaryViolation[];
      /** The subset that drives correction: earliest causal + independently new descendants. */
      causalViolations: BoundaryViolation[];
      /** Descendants that merely repeat an ancestor's violation. Evidence only. */
      downstreamViolations: BoundaryViolation[];
      assessedPairs: number;
      explanations: ServerExplanation[];
    }
  | { outcome: "boundary_review_inconclusive"; uncertainties: BoundaryUncertainty[]; assessedPairs: number; explanations: ServerExplanation[] }
  | {
      outcome: "boundary_review_malformed";
      codes: NarrowBoundaryCode[];
      findings: GroundingFinding[];
      /** R2.32 Part 7 — WHY it is unusable. The remedy differs by class. */
      failureClass: NarrowFailureClass;
    };

/**
 * Derive the boundary result from the per-surface answers. THE SERVER, NOT THE MODEL.
 *
 * A violation is never inferred from silence: only an `applies` + `violates` assessment that survived
 * mechanism and evidence grounding can reach here.
 */
export function deriveBoundaryVerdict(raw: unknown, ctx: NarrowReviewContext): DerivedBoundaryVerdict {
  const v = validateNarrowBoundaryReview(raw, ctx);
  if (!v.ok) return { outcome: "boundary_review_malformed", codes: v.codes, findings: v.findings, failureClass: classifyFailure(v.codes) };

  const statements = new Map(ctx.boundaries.map((b) => [b.id, b.statement]));
  /**
   * R2.32 — the explanation is RENDERED from findings the validator already established, after the
   * response is known valid. Nothing below reads it back: every verdict branch is computed from the
   * structured fields alone, so a rendering change can never move a verdict.
   */
  const explanations = explainAll(
    v.value.assessments.map((a) => ({
      boundaryId: a.boundaryId,
      boundaryStatement: statements.get(a.boundaryId) ?? "",
      surfaceRef: a.surfaceRef,
      applicability: a.applicability,
      compliance: a.compliance,
      violationMechanism: a.violationMechanism,
      governedActionEvidence: a.governedActionEvidence,
      prerequisiteFailureEvidence: a.prerequisiteFailureEvidence,
      modelReason: a.reason,
    })),
  );
  const lineageOf = new Map(ctx.surfaces.map((s) => [s.coordinate, s.lineage]));
  const selectableOf = new Map(ctx.surfaces.map((s) => [s.coordinate, s.independentlySelectable]));
  const order = new Map(ctx.surfaces.map((s, i) => [s.coordinate, i]));
  const assessedPairs = v.value.assessments.length;

  const violating = v.value.assessments.filter((a) => a.applicability === "applies" && a.compliance === "violates");

  if (violating.length > 0) {
    // R2.30 Part 7 — CAUSAL LINEAGE. A descendant of an already-violating ancestor is only its own
    // finding when it introduces something new: a different mechanism, or a different governed
    // action. Otherwise it repeats the ancestor and would inflate the correction packet.
    const byRef = new Map(violating.map((a) => [`${a.boundaryId} ${a.surfaceRef}`, a]));
    const violations: BoundaryViolation[] = violating
      .map((a) => {
        const lineage = lineageOf.get(a.surfaceRef) ?? [];
        const violatingAncestors = lineage.map((anc) => byRef.get(`${a.boundaryId} ${anc}`)).filter((x): x is NarrowBoundaryAssessment => !!x);
        // A descendant is a REPEAT only when it adds nothing an ancestor did not already establish:
        // the same mechanism AND no new authorization of its own.
        //
        // Grounding guarantees `governedActionEvidence` is quoted from the surface's OWN text, so a
        // SELECTABLE descendant that violates is a decision the learner can actually take — it newly
        // authorizes the governed action and therefore needs its own correction. An asserted state
        // that merely restates the ancestor's mechanism authorizes nothing new, and would only
        // duplicate the instruction.
        const sameMechanismAsAncestor = violatingAncestors.some((anc) => anc.violationMechanism === a.violationMechanism);
        const newlyAuthorizes = selectableOf.get(a.surfaceRef) === true;
        const repeatsAncestor = sameMechanismAsAncestor && !newlyAuthorizes;
        return {
          boundaryId: a.boundaryId,
          boundaryStatement: statements.get(a.boundaryId) ?? "",
          surfaceRef: a.surfaceRef,
          governedActionEvidence: a.governedActionEvidence,
          prerequisiteFailureEvidence: a.prerequisiteFailureEvidence,
          violationMechanism: a.violationMechanism,
          reason: a.reason,
          lineage,
          downstreamOfPriorViolation: repeatsAncestor,
          earliestCausal: violatingAncestors.length === 0,
        };
      })
      .sort((a, b) => (order.get(a.surfaceRef) ?? 0) - (order.get(b.surfaceRef) ?? 0));

    return {
      outcome: "boundary_review_reject",
      violations,
      causalViolations: violations.filter((x) => !x.downstreamOfPriorViolation),
      downstreamViolations: violations.filter((x) => x.downstreamOfPriorViolation),
      assessedPairs,
      explanations,
    };
  }

  const uncertainties: BoundaryUncertainty[] = v.value.assessments
    .filter((a) => a.applicability === "uncertain" || (a.applicability === "applies" && a.compliance === "uncertain"))
    .map((a) => ({
      boundaryId: a.boundaryId,
      surfaceRef: a.surfaceRef,
      reason: a.reason,
      level: a.applicability === "uncertain" ? ("applicability" as const) : ("compliance" as const),
    }));
  if (uncertainties.length > 0) return { outcome: "boundary_review_inconclusive", uncertainties, assessedPairs, explanations };

  const requiredPairs = ctx.boundaries.length * ctx.surfaces.length;
  const settled = v.value.assessments.every(
    (a) => a.applicability === "not_applicable" || (a.applicability === "applies" && a.compliance === "complies"),
  );
  if (assessedPairs !== requiredPairs || !settled) {
    return { outcome: "boundary_review_malformed", codes: ["boundary_review_missing_pair"], findings: [], failureClass: "coverage" };
  }
  return {
    outcome: "boundary_review_pass",
    assessedPairs,
    notApplicableCount: v.value.assessments.filter((a) => a.applicability === "not_applicable").length,
    explanations,
  };
}

export const BOUNDARY_OUTCOMES_ALLOWING_BROAD_REVIEW: readonly BoundaryReviewOutcome[] = [
  "boundary_review_pass",
  "boundary_review_not_applicable",
];

export const allowsBroadReview = (outcome: BoundaryReviewOutcome): boolean =>
  BOUNDARY_OUTCOMES_ALLOWING_BROAD_REVIEW.includes(outcome);

export const producesCorrectionPacket = (
  v: DerivedBoundaryVerdict,
): v is Extract<DerivedBoundaryVerdict, { outcome: "boundary_review_reject" }> => v.outcome === "boundary_review_reject";

// ---------------------------------------------------------------------------
// Rerun authority (unchanged from R2.29)
// ---------------------------------------------------------------------------

export const MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT = 2;

export const BOUNDARY_REVIEWER_TERMINAL_FAILURE = "boundary_reviewer_terminal_failure" as const;
export const BOUNDARY_REVIEW_AUTHORITY_FAILURE = "boundary_review_authority_failure" as const;

export type BoundaryReviewDecision =
  | { action: "continue" }
  | { action: "correction_path" }
  | { action: "inconclusive" }
  | { action: "rerun_boundary_review"; because: string }
  | { action: "boundary_reviewer_terminal_failure"; because: string }
  | { action: "boundary_reviewer_infrastructure_failure"; code: string };

export function decideAfterBoundaryReview(
  attempt: number,
  outcome: { kind: "derived"; verdict: DerivedBoundaryVerdict } | { kind: "transport_failed" },
): BoundaryReviewDecision {
  if (attempt < 1 || attempt > MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT) {
    return { action: "boundary_reviewer_infrastructure_failure", code: "boundary_review_attempt_budget_violated" };
  }
  if (outcome.kind === "transport_failed") {
    return { action: "boundary_reviewer_infrastructure_failure", code: "boundary_review_transport_failed" };
  }
  switch (outcome.verdict.outcome) {
    case "boundary_review_pass":
      return { action: "continue" };
    case "boundary_review_reject":
      return { action: "correction_path" };
    case "boundary_review_inconclusive":
      return { action: "inconclusive" };
    case "boundary_review_malformed": {
      const code = outcome.verdict.codes[0] ?? "boundary_review_malformed";
      if (attempt < MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT) {
        return { action: "rerun_boundary_review", because: `${code} — the boundary review was unusable; the scenario is unjudged and is NOT regenerated` };
      }
      return {
        action: "boundary_reviewer_terminal_failure",
        because: `${code} on boundary review attempt ${attempt} of ${MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT} over an identical frozen subject`,
      };
    }
  }
}

/** A boundary-review rerun is a review call. It is never a generation attempt. */
export const boundaryReviewCountsAsGenerationRetry = (d: BoundaryReviewDecision): boolean => d.action === "correction_path";
