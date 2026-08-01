/**
 * NARROW CONFIRMED-BOUNDARY REVIEW — PREREQUISITE TRUTH (Slice 3.2I-R5B1A.1-R2.36).
 *
 * WHAT R2.34 MEASURED LIVE, AND WHY
 *
 * One complete DTO over the frozen c18 subject. The unsafe case was rejected — for the wrong set:
 *
 *   branch[0].resulting_world_state  own text: "You have VERIFIED identifiers for both patients …"
 *                                    claimed failure: "but you still face DELAYS in the ward"
 *                                    → a state that satisfies the rule, rejected over a schedule.
 *
 *   branch[0].action[0]              "Finalize the report and communicate with the administrator"
 *                                    claimed failure: the PARENT world state's delay clause
 *                                    → an administrative action made applicable by inherited text.
 *
 *   primary[1]                       "Notify the families and proceed with one patient"
 *                                    → not_applicable in 3/3 live runs, judged as a bare label.
 *
 * R2.35 proved the common cause: the contract could prove where an excerpt LIVED and never what it
 * MEANT. Grounding is a location rule; nothing represented prerequisite truth, so nothing could
 * refuse a semantically wrong assessment.
 *
 * WHAT THIS CONTRACT ADDS
 *
 *   governedActionStatus   is the governed action present on THIS surface at all?
 *   prerequisiteStatus     satisfied · explicitly_missing · contradicted · not_established · …
 *   temporalRelation       did the action come before the prerequisite, or after?
 *   EvidenceReference      every excerpt cites a SERVER-ASSIGNED context segment, so the server
 *                          knows whether it came from the surface's own text or from its parent.
 *
 * The gates below are deterministic and anchored to the boundary's OWN decomposed clauses — never
 * to a hand-written keyword list.
 *
 * MEASURED BUDGET DECISION. Prerequisite SATISFACTION and FAILURE share one `prerequisiteEvidence`
 * reference, disambiguated by `prerequisiteStatus`. Two separate references measured ~13.5k Korean
 * schema tokens (headroom 1.19, under the required 1.25); one reference measures comfortably above
 * it with a far more generous excerpt bound. Every gate R2.35 required survives the merge — a
 * satisfied prerequisite plus a violation is still a contradiction, detected from the enums.
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
import { segmentIndex, type ContextSegment, type SegmentKind } from "./boundaryContextSegments";
import type { BoundarySemanticFrame } from "./boundarySemanticFrame";

export const NARROW_BOUNDARY_SCHEMA_NAME = "bty_practice_boundary_surface_review_v3";
export const NARROW_BOUNDARY_CONTRACT_VERSION = "practice-narrow-boundary-review/3";

/** Measured against the 3 x 12 worst case — see the budget note above. */
export const NARROW_EVIDENCE_MAX = 100;
export const NARROW_REASON_MAX = 80;
export const NARROW_SEGMENT_REF_MAX = 12;
export const NARROW_BOUNDARY_ID_MAX = 32;
export const NARROW_SURFACE_REF_MAX = 32;
export const MAX_NARROW_ASSESSMENTS = MAX_ACTIVE_BOUNDARIES * BRANCH_AWARE_REACHABLE_SURFACE_COUNT;

export const APPLICABILITY_RESULTS = ["applies", "not_applicable", "uncertain"] as const;
export type ApplicabilityResult = (typeof APPLICABILITY_RESULTS)[number];

/** Is the action the boundary governs present on THIS surface? Asked separately from applicability. */
export const GOVERNED_ACTION_STATUSES = ["present", "absent", "uncertain"] as const;
export type GovernedActionStatus = (typeof GOVERNED_ACTION_STATUSES)[number];

/** The truth R2.35 proved was unrepresentable. */
export const PREREQUISITE_STATUSES = [
  "satisfied",
  "explicitly_missing",
  "contradicted",
  /** Nothing establishes it either way. NOT a violation on its own. */
  "not_established",
  "uncertain",
  "not_applicable",
] as const;
export type PrerequisiteStatus = (typeof PREREQUISITE_STATUSES)[number];

export const TEMPORAL_RELATIONS = [
  "prerequisite_before_action",
  "action_before_prerequisite",
  "simultaneous_or_unclear",
  "unrelated",
  "not_applicable",
] as const;
export type TemporalRelation = (typeof TEMPORAL_RELATIONS)[number];

export const COMPLIANCE_RESULTS = ["complies", "violates", "uncertain", "not_assessed"] as const;
export type ComplianceResult = (typeof COMPLIANCE_RESULTS)[number];

export const VIOLATION_MECHANISMS = [
  "none",
  "governed_action_without_prerequisite",
  "resulting_state_missing_prerequisite",
  "boundary_reopened_after_prior_compliance",
  "explicit_boundary_contradiction",
  "other_grounded_violation",
] as const;
export type ViolationMechanism = (typeof VIOLATION_MECHANISMS)[number];

/** An excerpt plus the SERVER-ASSIGNED segment it came from. Location is declared, not guessed. */
export type EvidenceReference = { segmentRef: string; excerpt: string };

export type NarrowBoundaryAssessment = {
  boundaryId: string;
  surfaceRef: string;
  applicability: ApplicabilityResult;
  governedActionStatus: GovernedActionStatus;
  prerequisiteStatus: PrerequisiteStatus;
  temporalRelation: TemporalRelation;
  compliance: ComplianceResult;
  violationMechanism: ViolationMechanism;
  /** What THIS surface does. Serves both the governed-action and the applicability question. */
  actionEvidence: EvidenceReference;
  /** Supports whatever `prerequisiteStatus` asserts — satisfaction OR failure. */
  prerequisiteEvidence: EvidenceReference;
  reason: string;
};

export type NarrowBoundaryReview = { assessments: NarrowBoundaryAssessment[] };

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    segmentRef: { type: "string", maxLength: NARROW_SEGMENT_REF_MAX },
    excerpt: { type: "string", maxLength: NARROW_EVIDENCE_MAX },
  },
  required: ["segmentRef", "excerpt"],
} as const;

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
          governedActionStatus: { type: "string", enum: [...GOVERNED_ACTION_STATUSES] },
          prerequisiteStatus: { type: "string", enum: [...PREREQUISITE_STATUSES] },
          temporalRelation: { type: "string", enum: [...TEMPORAL_RELATIONS] },
          compliance: { type: "string", enum: [...COMPLIANCE_RESULTS] },
          violationMechanism: { type: "string", enum: [...VIOLATION_MECHANISMS] },
          actionEvidence: evidenceSchema,
          prerequisiteEvidence: evidenceSchema,
          reason: { type: "string", maxLength: NARROW_REASON_MAX },
        },
        required: [
          "boundaryId",
          "surfaceRef",
          "applicability",
          "governedActionStatus",
          "prerequisiteStatus",
          "temporalRelation",
          "compliance",
          "violationMechanism",
          "actionEvidence",
          "prerequisiteEvidence",
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
  "boundary_review_transport_failed",
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
  "boundary_evidence_ungrounded",
  // R2.36 keeps the R2.29/R2.32 code NAMES wherever the check is unchanged. Renaming a registered
  // defect code retires it silently for every downstream reader — the exact drift this stage exists
  // to prevent — so new names appear only for genuinely new checks.
  "boundary_evidence_from_other_surface",
  "boundary_evidence_restates_boundary",
  "boundary_violation_mechanism_missing",
  "boundary_violation_governed_action_missing",
  "boundary_violation_prerequisite_evidence_missing",
  "boundary_reason_required_missing",
  "boundary_reason_generic",
  "boundary_assessment_state_invalid",
  "boundary_applicability_compliance_mismatch",
  // R2.36 — evidence locality
  "boundary_evidence_unknown_segment",
  "boundary_evidence_segment_not_visible",
  "boundary_evidence_wrong_segment_kind",
  "boundary_evidence_excerpt_not_in_segment",
  // R2.36 — prerequisite truth
  "boundary_governed_action_absent_for_applies",
  "boundary_prerequisite_failure_ungrounded",
  "boundary_prerequisite_contradiction",
  "boundary_temporal_relation_unresolved",
  "boundary_inherited_state_without_own_action",
  "boundary_semantic_frame_uncertain",
] as const;

export const NARROW_BOUNDARY_CODES = [...NARROW_COVERAGE_CODES, ...NARROW_GROUNDING_CODES] as const;
export type NarrowBoundaryCode = (typeof NARROW_BOUNDARY_CODES)[number];

export const OUTPUT_CONTRACT_CODES = [
  "boundary_reason_required_missing",
  "boundary_reason_generic",
  "boundary_assessment_state_invalid",
  "boundary_applicability_compliance_mismatch",
  "boundary_governed_action_absent_for_applies",
  "boundary_prerequisite_contradiction",
  "boundary_temporal_relation_unresolved",
] as const;

export const COVERAGE_FAILURE_CODES = [...NARROW_COVERAGE_CODES] as readonly string[];

export type NarrowFailureClass = "coverage" | "grounding" | "output_contract" | "transport";

export function classifyFailure(codes: readonly string[]): NarrowFailureClass {
  if (codes.includes("boundary_review_transport_failed")) return "transport";
  if (codes.some((c) => COVERAGE_FAILURE_CODES.includes(c))) return "coverage";
  if (codes.some((c) => (OUTPUT_CONTRACT_CODES as readonly string[]).includes(c))) return "output_contract";
  return "grounding";
}

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
  "does not address verification",
  "does not address verification of identifiers",
  "does not mention verification",
  "no verification mentioned",
  "does not mention the boundary",
  "does not address the boundary",
] as const;

export const MIN_EVIDENCE_CHARS = 12;

export function normalizeForGrounding(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const surfacePairKey = (boundaryId: string, surfaceRef: string): string => boundaryId + " " + surfaceRef;

// ---------------------------------------------------------------------------
// Prerequisite-term anchoring — derived from the BOUNDARY, never hand-written
// ---------------------------------------------------------------------------

/** Words that carry no content in a rule clause. Modal verbs and articles; nothing domain-specific. */
const CLAUSE_STOP_WORDS = new Set([
  "a", "an", "the", "must", "be", "is", "are", "was", "were", "shall", "should", "will", "to", "of",
  "for", "and", "or", "in", "on", "at", "by", "with", "before", "after", "prior", "that", "this",
  "it", "its", "has", "have", "had", "not", "no", "any", "all", "each", "every", "required",
]);

/**
 * Content stems of a boundary clause. Light suffix stripping only — enough that "verified",
 * "verification" and "unverified" reduce to a shared prefix, so a NEGATED form of the prerequisite
 * still matches. Anchored to the boundary's own decomposed clause; not a domain keyword list.
 */
export function clauseStems(clause: string): string[] {
  return normalizeForGrounding(clause)
    .split(" ")
    .filter((w) => w.length >= 4 && !CLAUSE_STOP_WORDS.has(w))
    .map((w) => w.replace(/(ications?|ication|ations?|ation|ing|ied|ies|ed|es|s)$/u, ""))
    .filter((w) => w.length >= 4);
}

/**
 * Does this excerpt actually concern the prerequisite the boundary names?
 *
 * THE HIGHEST-YIELD GATE R2.35 MEASURED: it refuses "delays in the ward" (no shared stem with
 * "Two identifiers must be verified") while accepting "left the second patient unverified"
 * (shares `verif`). Both measured false positives die here; neither true positive is touched.
 */
export function excerptConcernsPrerequisite(excerpt: string, frame: BoundarySemanticFrame | undefined): boolean {
  if (!frame || frame.ruleKind === "uncertain") return false;
  const stems = clauseStems(frame.prerequisiteClause || frame.exactBoundaryText);
  if (stems.length === 0) return false;
  const e = normalizeForGrounding(excerpt);
  return stems.some((stem) => e.includes(stem));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type NarrowReviewContext = {
  boundaries: Array<{ id: string; statement: string }>;
  /** ONLY the reachable surfaces. */
  surfaces: BoundarySurface[];
  /** Server-assigned context segments. Evidence cites these. */
  segments: ContextSegment[];
  /** One decomposed frame per boundary. */
  frames: BoundarySemanticFrame[];
};

export type GroundingFinding = { boundaryId: string; surfaceRef: string; code: NarrowBoundaryCode };

/**
 * A VIOLATION CLAIM THE SERVER REFUSED — the R2.34 false positives.
 *
 * A refuted claim is NOT a malformed response. R2.35 measured 4 violation claims of which 2 were
 * semantically wrong; refusing the whole response would have sent the scenario back for a rerun, and
 * a rerun that came back clean would ship a scenario with a REAL violation in it. So a claim that
 * fails a truth gate is demoted to `uncertain` and recorded here, and the surviving grounded
 * violations still reject the scenario. The refusal is narrower than the response, and strictly
 * safer than either accepting or discarding it.
 */
export type RefutedViolationClaim = {
  boundaryId: string;
  surfaceRef: string;
  codes: NarrowBoundaryCode[];
  claimedMechanism: ViolationMechanism;
  claimedPrerequisiteEvidence: string;
  claimedPrerequisiteSegmentRef: string;
};

export type NarrowValidationResult =
  | { ok: true; value: NarrowBoundaryReview; refutations: RefutedViolationClaim[] }
  | { ok: false; codes: NarrowBoundaryCode[]; findings: GroundingFinding[]; value: NarrowBoundaryReview | null };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const oneOf = <T extends readonly string[]>(set: T, v: unknown, fallback: T[number]): T[number] =>
  (set as readonly string[]).includes(str(v)) ? (str(v) as T[number]) : fallback;
const asRef = (v: unknown): EvidenceReference => {
  const o = isObj(v) ? v : {};
  return { segmentRef: str(o.segmentRef).trim(), excerpt: str(o.excerpt) };
};

/**
 * QUOTING SOMETHING THAT IS NOT THERE is never survivable. A wrong segment, an invisible segment or
 * an excerpt absent from the segment it names means the model is not reading the text it was given —
 * a defect of the RESPONSE, not of one claim. These stay fatal even on a violation row.
 */
const FABRICATION_CODES: readonly NarrowBoundaryCode[] = [
  "boundary_evidence_unknown_segment",
  "boundary_evidence_segment_not_visible",
  "boundary_evidence_wrong_segment_kind",
  "boundary_evidence_excerpt_not_in_segment",
  "boundary_evidence_from_other_surface",
  "boundary_evidence_restates_boundary",
];

/** Evidence kinds each field may legitimately cite. */
const OWN_ONLY: SegmentKind[] = ["own_surface"];
const PREREQUISITE_SOURCES: SegmentKind[] = ["own_surface", "parent_generated_state"];

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
      governedActionStatus: oneOf(GOVERNED_ACTION_STATUSES, o.governedActionStatus, "uncertain"),
      prerequisiteStatus: oneOf(PREREQUISITE_STATUSES, o.prerequisiteStatus, "uncertain"),
      temporalRelation: oneOf(TEMPORAL_RELATIONS, o.temporalRelation, "not_applicable"),
      compliance: oneOf(COMPLIANCE_RESULTS, o.compliance, "not_assessed"),
      violationMechanism: oneOf(VIOLATION_MECHANISMS, o.violationMechanism, "none"),
      actionEvidence: asRef(o.actionEvidence),
      prerequisiteEvidence: asRef(o.prerequisiteEvidence),
      reason: str(o.reason),
    };
  });
  const value: NarrowBoundaryReview = { assessments };

  for (const a of rawList) {
    const o = isObj(a) ? a : {};
    if (
      !(APPLICABILITY_RESULTS as readonly string[]).includes(str(o.applicability)) ||
      !(GOVERNED_ACTION_STATUSES as readonly string[]).includes(str(o.governedActionStatus)) ||
      !(PREREQUISITE_STATUSES as readonly string[]).includes(str(o.prerequisiteStatus)) ||
      !(TEMPORAL_RELATIONS as readonly string[]).includes(str(o.temporalRelation)) ||
      !(COMPLIANCE_RESULTS as readonly string[]).includes(str(o.compliance)) ||
      !(VIOLATION_MECHANISMS as readonly string[]).includes(str(o.violationMechanism))
    ) {
      codes.push("boundary_review_invalid_result");
    }
  }

  // --- exact Cartesian coverage ---------------------------------------------
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

  // --- evidence locality, prerequisite truth, gates --------------------------
  const segByRef = segmentIndex(ctx.segments);
  const frameById = new Map(ctx.frames.map((f) => [f.boundaryId, f]));
  const refutations: RefutedViolationClaim[] = [];

  for (const a of assessments) {
    /**
     * A claim row's gate failures REFUTE THE CLAIM; every other row's are fatal. Fabricated quotes
     * are fatal wherever they appear — see `FABRICATION_CODES`.
     */
    const claiming = a.compliance === "violates";
    const rowCodes: NarrowBoundaryCode[] = [];
    const push = (code: NarrowBoundaryCode) => {
      if (claiming && !FABRICATION_CODES.includes(code)) rowCodes.push(code);
      else {
        codes.push(code);
        findings.push({ boundaryId: a.boundaryId, surfaceRef: a.surfaceRef, code });
      }
    };
    const fatal = (code: NarrowBoundaryCode) => {
      codes.push(code);
      findings.push({ boundaryId: a.boundaryId, surfaceRef: a.surfaceRef, code });
    };

    const boundaryStatement = ctx.boundaries.find((x) => x.id === a.boundaryId)?.statement ?? "";
    const frame = frameById.get(a.boundaryId);
    if (!frame || frame.ruleKind === "uncertain") {
      fatal("boundary_semantic_frame_uncertain");
      continue;
    }

    const state: AssessmentStateRule | null = classifyAssessmentState(a);
    if (!state) {
      fatal("boundary_assessment_state_invalid");
      continue;
    }
    if (state.reasonAuthority === "model_required") {
      const t = a.reason.trim();
      if (t.length < MODEL_REASON_MIN_CHARS) fatal("boundary_reason_required_missing");
      else if (GENERIC_REASON_PHRASES.includes(normalizeReason(t) as (typeof GENERIC_REASON_PHRASES)[number])) fatal("boundary_reason_generic");
    }

    /** Verify one evidence reference against the server's segment registry. */
    const checkRef = (r: EvidenceReference, allowed: SegmentKind[], isRequired: boolean): { ok: boolean; kind: SegmentKind | null } => {
      if (!r.segmentRef && !r.excerpt.trim()) {
        if (isRequired) push("boundary_evidence_missing");
        return { ok: false, kind: null };
      }
      const seg = segByRef.get(r.segmentRef);
      if (!seg) {
        push("boundary_evidence_unknown_segment");
        return { ok: false, kind: null };
      }
      // A segment is visible to a surface only when it belongs to it or is scenario-wide.
      if (seg.sourceSurfaceRef !== "" && seg.sourceSurfaceRef !== a.surfaceRef) {
        push("boundary_evidence_segment_not_visible");
        return { ok: false, kind: seg.segmentKind };
      }
      if (!allowed.includes(seg.segmentKind)) {
        push("boundary_evidence_wrong_segment_kind");
        return { ok: false, kind: seg.segmentKind };
      }
      const e = normalizeForGrounding(r.excerpt);
      if (!e) {
        push("boundary_evidence_missing");
        return { ok: false, kind: seg.segmentKind };
      }
      if (GENERIC_EVIDENCE_PHRASES.some((p) => e === p || e.includes(p))) {
        push("boundary_evidence_generic");
        return { ok: false, kind: seg.segmentKind };
      }
      if (e.length < MIN_EVIDENCE_CHARS) {
        push("boundary_evidence_too_short");
        return { ok: false, kind: seg.segmentKind };
      }
      // The R2.29 shape: the rule quoted back as if it were conduct.
      if (normalizeForGrounding(boundaryStatement).includes(e)) {
        push("boundary_evidence_restates_boundary");
        return { ok: false, kind: seg.segmentKind };
      }
      if (!normalizeForGrounding(seg.text).includes(e)) {
        // More informative than a bare not-in-segment when the text belongs to a DIFFERENT surface.
        const elsewhere = ctx.surfaces.some((o) => o.coordinate !== a.surfaceRef && normalizeForGrounding(o.text).includes(e));
        push(elsewhere ? "boundary_evidence_from_other_surface" : "boundary_evidence_excerpt_not_in_segment");
        return { ok: false, kind: seg.segmentKind };
      }
      return { ok: true, kind: seg.segmentKind };
    };

    // (7A) OWN GOVERNED ACTION. What a surface does can only be proved by its own text — the rule
    // that stops inherited context from making an administrative action applicable.
    if (a.applicability === "applies" || a.applicability === "not_applicable") {
      if (claiming && !a.actionEvidence.excerpt.trim()) push("boundary_violation_governed_action_missing");
      else checkRef(a.actionEvidence, OWN_ONLY, true);
    }
    if (a.applicability === "applies" && a.governedActionStatus === "absent") {
      push("boundary_governed_action_absent_for_applies");
    }

    // (7C) INHERITED PREREQUISITE STATE — permitted, but only behind an own governed action.
    const prereqProvided = Boolean(a.prerequisiteEvidence.segmentRef || a.prerequisiteEvidence.excerpt.trim());
    const prereqCheck = prereqProvided
      ? checkRef(a.prerequisiteEvidence, PREREQUISITE_SOURCES, false)
      : { ok: false, kind: null as SegmentKind | null };
    if (prereqCheck.kind === "parent_generated_state" && a.governedActionStatus !== "present") {
      push("boundary_inherited_state_without_own_action");
    }

    // (9A) A SATISFIED PREREQUISITE CANNOT VIOLATE. The exact R2.34 safe-branch shape.
    if (a.prerequisiteStatus === "satisfied") {
      if (!prereqProvided) push("boundary_violation_prerequisite_evidence_missing");
      if (a.compliance === "violates") push("boundary_prerequisite_contradiction");
      if (a.temporalRelation === "action_before_prerequisite") push("boundary_prerequisite_contradiction");
    }

    if (claiming) {
      // (8.4) `not_established` alone is never a violation
      if (!(a.prerequisiteStatus === "explicitly_missing" || a.prerequisiteStatus === "contradicted")) {
        push("boundary_prerequisite_contradiction");
      }
      // (8.5) the failure must be DIRECTED AT THE PREREQUISITE, not at any negative consequence
      if (!prereqProvided) push("boundary_violation_prerequisite_evidence_missing");
      else if (prereqCheck.ok && !excerptConcernsPrerequisite(a.prerequisiteEvidence.excerpt, frame)) {
        push("boundary_prerequisite_failure_ungrounded");
      }
      // (8.6) the ordering must place the governed action before a satisfied prerequisite
      if (!(a.temporalRelation === "action_before_prerequisite" || a.temporalRelation === "simultaneous_or_unclear")) {
        push("boundary_temporal_relation_unresolved");
      }
      if (a.violationMechanism === "none") push("boundary_violation_mechanism_missing");

      if (rowCodes.length > 0) {
        refutations.push({
          boundaryId: a.boundaryId,
          surfaceRef: a.surfaceRef,
          codes: [...new Set(rowCodes)],
          claimedMechanism: a.violationMechanism,
          claimedPrerequisiteEvidence: a.prerequisiteEvidence.excerpt,
          claimedPrerequisiteSegmentRef: a.prerequisiteEvidence.segmentRef,
        });
        // DEMOTED, not deleted. The surface is left unsettled, so the review can never PASS on it.
        a.compliance = "uncertain";
        a.violationMechanism = "none";
      }
    }
  }

  if (codes.length > 0) return { ok: false, codes: [...new Set(codes)], findings, value };
  return { ok: true, value, refutations };
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
  governedActionSegmentRef: string;
  prerequisiteFailureEvidence: string;
  prerequisiteSegmentRef: string;
  prerequisiteSegmentKind: string;
  prerequisiteStatus: PrerequisiteStatus;
  temporalRelation: TemporalRelation;
  violationMechanism: ViolationMechanism;
  reason: string;
  lineage: string[];
  downstreamOfPriorViolation: boolean;
  earliestCausal: boolean;
};

export type BoundaryUncertainty = {
  boundaryId: string;
  surfaceRef: string;
  reason: string;
  level: "applicability" | "compliance" | "prerequisite" | "temporal";
};

export type DerivedBoundaryVerdict =
  | {
      outcome: "boundary_review_pass";
      assessedPairs: number;
      notApplicableCount: number;
      explanations: ServerExplanation[];
      refutedClaims: RefutedViolationClaim[];
    }
  | {
      outcome: "boundary_review_reject";
      violations: BoundaryViolation[];
      causalViolations: BoundaryViolation[];
      downstreamViolations: BoundaryViolation[];
      assessedPairs: number;
      explanations: ServerExplanation[];
      /** Claims the server refused. Reported alongside the surviving ones, never merged with them. */
      refutedClaims: RefutedViolationClaim[];
    }
  | {
      outcome: "boundary_review_inconclusive";
      uncertainties: BoundaryUncertainty[];
      assessedPairs: number;
      explanations: ServerExplanation[];
      refutedClaims: RefutedViolationClaim[];
    }
  | { outcome: "boundary_review_malformed"; codes: NarrowBoundaryCode[]; findings: GroundingFinding[]; failureClass: NarrowFailureClass };

export function deriveBoundaryVerdict(raw: unknown, ctx: NarrowReviewContext): DerivedBoundaryVerdict {
  const v = validateNarrowBoundaryReview(raw, ctx);
  if (!v.ok) return { outcome: "boundary_review_malformed", codes: v.codes, findings: v.findings, failureClass: classifyFailure(v.codes) };

  const statements = new Map(ctx.boundaries.map((b) => [b.id, b.statement]));
  const lineageOf = new Map(ctx.surfaces.map((s) => [s.coordinate, s.lineage]));
  const selectableOf = new Map(ctx.surfaces.map((s) => [s.coordinate, s.independentlySelectable]));
  const order = new Map(ctx.surfaces.map((s, i) => [s.coordinate, i]));
  const segByRef = segmentIndex(ctx.segments);
  const assessedPairs = v.value.assessments.length;

  const explanations = explainAll(
    v.value.assessments.map((a) => ({
      boundaryId: a.boundaryId,
      boundaryStatement: statements.get(a.boundaryId) ?? "",
      surfaceRef: a.surfaceRef,
      applicability: a.applicability,
      compliance: a.compliance,
      violationMechanism: a.violationMechanism,
      governedActionEvidence: a.actionEvidence.excerpt,
      prerequisiteFailureEvidence: a.prerequisiteEvidence.excerpt,
      modelReason: a.reason,
    })),
  );

  const violating = v.value.assessments.filter((a) => a.applicability === "applies" && a.compliance === "violates");

  if (violating.length > 0) {
    const byRef = new Map(violating.map((a) => [a.boundaryId + " " + a.surfaceRef, a]));
    const violations: BoundaryViolation[] = violating
      .map((a) => {
        const lineage = lineageOf.get(a.surfaceRef) ?? [];
        const ancestors = lineage.map((anc) => byRef.get(a.boundaryId + " " + anc)).filter((x): x is NarrowBoundaryAssessment => !!x);
        const sameMechanism = ancestors.some((anc) => anc.violationMechanism === a.violationMechanism);
        const newlyAuthorizes = selectableOf.get(a.surfaceRef) === true;
        return {
          boundaryId: a.boundaryId,
          boundaryStatement: statements.get(a.boundaryId) ?? "",
          surfaceRef: a.surfaceRef,
          governedActionEvidence: a.actionEvidence.excerpt,
          governedActionSegmentRef: a.actionEvidence.segmentRef,
          prerequisiteFailureEvidence: a.prerequisiteEvidence.excerpt,
          prerequisiteSegmentRef: a.prerequisiteEvidence.segmentRef,
          prerequisiteSegmentKind: segByRef.get(a.prerequisiteEvidence.segmentRef)?.segmentKind ?? "unknown",
          prerequisiteStatus: a.prerequisiteStatus,
          temporalRelation: a.temporalRelation,
          violationMechanism: a.violationMechanism,
          reason: a.reason,
          lineage,
          downstreamOfPriorViolation: sameMechanism && !newlyAuthorizes,
          earliestCausal: ancestors.length === 0,
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
      refutedClaims: v.refutations,
    };
  }

  // Any unresolved truth is INCONCLUSIVE, never a quiet pass.
  const uncertainties: BoundaryUncertainty[] = [];
  for (const a of v.value.assessments) {
    const add = (level: BoundaryUncertainty["level"]) =>
      uncertainties.push({ boundaryId: a.boundaryId, surfaceRef: a.surfaceRef, reason: a.reason, level });
    if (a.applicability === "uncertain") add("applicability");
    else if (a.applicability === "applies") {
      if (a.compliance === "uncertain") add("compliance");
      else if (a.governedActionStatus === "uncertain" || a.prerequisiteStatus === "uncertain") add("prerequisite");
      else if (a.temporalRelation === "simultaneous_or_unclear" && a.prerequisiteStatus !== "satisfied") add("temporal");
    }
  }
  if (uncertainties.length > 0) {
    return { outcome: "boundary_review_inconclusive", uncertainties, assessedPairs, explanations, refutedClaims: v.refutations };
  }

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
    // Always empty on a pass: a refuted claim demotes its surface to `uncertain`, which cannot pass.
    refutedClaims: v.refutations,
  };
}

export const BOUNDARY_OUTCOMES_ALLOWING_BROAD_REVIEW: readonly BoundaryReviewOutcome[] = [
  "boundary_review_pass",
  "boundary_review_not_applicable",
];
export const allowsBroadReview = (outcome: BoundaryReviewOutcome): boolean => BOUNDARY_OUTCOMES_ALLOWING_BROAD_REVIEW.includes(outcome);
export const producesCorrectionPacket = (
  v: DerivedBoundaryVerdict,
): v is Extract<DerivedBoundaryVerdict, { outcome: "boundary_review_reject" }> => v.outcome === "boundary_review_reject";

// ---------------------------------------------------------------------------
// Rerun authority (unchanged from R2.32)
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
        return {
          action: "rerun_boundary_review",
          because: code + " — the boundary review was unusable; the scenario is unjudged and is NOT regenerated",
        };
      }
      return {
        action: "boundary_reviewer_terminal_failure",
        because: code + " on boundary review attempt " + attempt + " of " + MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT + " over an identical frozen subject",
      };
    }
  }
}

export const boundaryReviewCountsAsGenerationRetry = (d: BoundaryReviewDecision): boolean => d.action === "correction_path";
