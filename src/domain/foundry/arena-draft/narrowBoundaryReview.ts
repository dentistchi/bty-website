/**
 * THE MINIMAL TRUTH CONTRACT (Slice 3.2I-R5B1A.1-R2.38).
 *
 * WHAT THE MEASUREMENTS SAID
 *
 * R2.36's live replay produced two complete provider responses. Both satisfied the strict schema.
 * Both were discarded by local validation, and R2.37 proved why — four contract defects, three of
 * them introduced by R2.36 itself:
 *
 *   1. A DUPLICATED AXIS. `applicability` and `governedActionStatus` asked the same question. All 24
 *      live rows said `applies`; twelve then said `governedActionStatus: absent` + `not_assessed`,
 *      a coherent reading that the parity table did not contain.
 *   2. DUPLICATE SEGMENT REFS. 41 refs carried 15 distinct texts. `branch[1].action[1]` cited
 *      `8:own` instead of the byte-identical `12:par`, and a correct answer was thrown away.
 *   3. HOMELESS SATISFACTION. Satisfaction and failure shared one field with FAILURE's sources, so a
 *      prerequisite satisfied by an earlier choice had nowhere legal to point.
 *   4. STALE PROMPT FIELDS. The prompt still named `governedActionEvidence` and
 *      `prerequisiteFailureEvidence`, which the schema no longer had.
 *
 * WHAT THIS CONTRACT ASKS FOR
 *
 * Semantic facts, and nothing else:
 *
 *     governedActionStatus · prerequisiteStatus · temporalRelation
 *     governedActionCandidateId · prerequisiteSatisfactionCandidateId · prerequisiteFailureCandidateId
 *     reason
 *
 * `applicability`, `compliance`, `violationMechanism` and every excerpt are now SERVER-DERIVED. The
 * model cannot disagree with the server about a conclusion it is no longer asked to draw, and it
 * cannot cite text it is not offered.
 *
 * Pure domain: no I/O, no provider, no DB, no clock.
 */

import { MAX_ACTIVE_BOUNDARIES } from "./boundaryScope";
import { BRANCH_AWARE_REACHABLE_SURFACE_COUNT, type BoundarySurface } from "./boundarySurfaces";
import { explainAll, type ServerExplanation } from "./boundaryExplanation";
import { GENERIC_REASON_PHRASES, MODEL_REASON_MIN_CHARS, normalizeReason } from "./boundaryReasonParity";
import {
  GOVERNED_ACTION_STATUSES,
  PREREQUISITE_STATUSES,
  TEMPORAL_RELATIONS,
  NO_CANDIDATE,
  type GovernedActionStatus,
  type PrerequisiteStatus,
  type TemporalRelation,
} from "./boundaryTruthContractTypes";
import {
  CANDIDATE_ID_MAX,
  indexCandidates,
  poolFor,
  resolveCandidate,
  type BoundaryEvidenceCandidate,
} from "./boundaryEvidenceCandidates";
import {
  classifyTruthState,
  deriveMechanism,
  type DerivedApplicability,
  type DerivedCompliance,
  type TruthStateRule,
} from "./boundaryTruthStates";
import type { BoundarySemanticFrame } from "./boundarySemanticFrame";

export { normalizeForGrounding, clauseStems } from "./boundaryClauseTerms";
export { GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS, NO_CANDIDATE } from "./boundaryTruthContractTypes";
export type { GovernedActionStatus, PrerequisiteStatus, TemporalRelation } from "./boundaryTruthContractTypes";

export const NARROW_BOUNDARY_SCHEMA_NAME = "bty_practice_boundary_truth_review_v4";
export const NARROW_BOUNDARY_CONTRACT_VERSION = "practice-narrow-boundary-review/4";

export const NARROW_REASON_MAX = 120;
export const NARROW_BOUNDARY_ID_MAX = 32;
export const NARROW_SURFACE_REF_MAX = 32;
export const MAX_NARROW_ASSESSMENTS = MAX_ACTIVE_BOUNDARIES * BRANCH_AWARE_REACHABLE_SURFACE_COUNT;

/** What the model returns for ONE (boundary, surface) pair. Seven fields, three of them ids. */
export type BoundaryTruthAssessment = {
  boundaryId: string;
  surfaceRef: string;
  governedActionStatus: GovernedActionStatus;
  prerequisiteStatus: PrerequisiteStatus;
  temporalRelation: TemporalRelation;
  governedActionCandidateId: string;
  prerequisiteSatisfactionCandidateId: string;
  prerequisiteFailureCandidateId: string;
  reason: string;
};

export type NarrowBoundaryReview = { assessments: BoundaryTruthAssessment[] };

const candidateField = { type: "string", maxLength: CANDIDATE_ID_MAX } as const;

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
          governedActionStatus: { type: "string", enum: [...GOVERNED_ACTION_STATUSES] },
          prerequisiteStatus: { type: "string", enum: [...PREREQUISITE_STATUSES] },
          temporalRelation: { type: "string", enum: [...TEMPORAL_RELATIONS] },
          governedActionCandidateId: candidateField,
          prerequisiteSatisfactionCandidateId: candidateField,
          prerequisiteFailureCandidateId: candidateField,
          reason: { type: "string", maxLength: NARROW_REASON_MAX },
        },
        required: [
          "boundaryId",
          "surfaceRef",
          "governedActionStatus",
          "prerequisiteStatus",
          "temporalRelation",
          "governedActionCandidateId",
          "prerequisiteSatisfactionCandidateId",
          "prerequisiteFailureCandidateId",
          "reason",
        ],
      },
    },
  },
  required: ["assessments"],
} as const;

/** Fields the model must NEVER author again. Asserted by a source gate, not just by convention. */
export const REMOVED_MODEL_AUTHORED_FIELDS = [
  "applicability",
  "compliance",
  "violationMechanism",
  "actionEvidence",
  "prerequisiteEvidence",
  "governedActionEvidence",
  "prerequisiteFailureEvidence",
  "segmentRef",
  "segmentKind",
  "sourceSurfaceRef",
  "excerpt",
] as const;

// ---------------------------------------------------------------------------
// Defect codes — R2.29-R2.36 names preserved wherever the check is unchanged
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
  "boundary_reason_required_missing",
  "boundary_reason_generic",
  "boundary_assessment_state_invalid",
  "boundary_semantic_frame_uncertain",
  // R2.38 — candidate authority. An id the server did not issue for THIS surface and role fails
  // closed; there is no path by which a model-authored string becomes evidence.
  "boundary_candidate_unknown",
  "boundary_candidate_wrong_surface",
  "boundary_candidate_wrong_role",
  "boundary_candidate_wrong_boundary",
  "boundary_candidate_required_missing",
  "boundary_candidate_forbidden_present",
  "boundary_prerequisite_contradiction",
  // R2.40 — pool-aware requirements. Separate authority from the codes above: these fire about the
  // POOL the server offered, not about the id the model chose.
  "boundary_governed_action_candidate_unavailable",
  "boundary_candidate_role_uncertain",
] as const;

export const NARROW_BOUNDARY_CODES = [...NARROW_COVERAGE_CODES, ...NARROW_GROUNDING_CODES] as const;
export type NarrowBoundaryCode = (typeof NARROW_BOUNDARY_CODES)[number];

export const OUTPUT_CONTRACT_CODES = [
  "boundary_reason_required_missing",
  "boundary_reason_generic",
  "boundary_assessment_state_invalid",
  "boundary_candidate_unknown",
  "boundary_candidate_wrong_surface",
  "boundary_candidate_wrong_role",
  "boundary_candidate_wrong_boundary",
  "boundary_candidate_required_missing",
  "boundary_candidate_forbidden_present",
  "boundary_prerequisite_contradiction",
  // R2.40 — pool-aware requirements. Separate authority from the codes above: these fire about the
  // POOL the server offered, not about the id the model chose.
  "boundary_governed_action_candidate_unavailable",
  "boundary_candidate_role_uncertain",
] as const;

export const COVERAGE_FAILURE_CODES = [...NARROW_COVERAGE_CODES] as readonly string[];

export type NarrowFailureClass = "coverage" | "grounding" | "output_contract" | "transport";

export function classifyFailure(codes: readonly string[]): NarrowFailureClass {
  if (codes.includes("boundary_review_transport_failed")) return "transport";
  if (codes.some((c) => COVERAGE_FAILURE_CODES.includes(c))) return "coverage";
  if (codes.some((c) => (OUTPUT_CONTRACT_CODES as readonly string[]).includes(c))) return "output_contract";
  return "grounding";
}

/**
 * An output-contract failure is REPAIRABLE per surface: the response reached the semantic layer and
 * most rows may be intact. A coverage or transport failure is not — the whole response is suspect.
 */
export const isLocallyRepairable = (cls: NarrowFailureClass): boolean => cls === "output_contract";

export const surfacePairKey = (boundaryId: string, surfaceRef: string): string => boundaryId + " " + surfaceRef;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type NarrowReviewContext = {
  boundaries: Array<{ id: string; statement: string }>;
  surfaces: BoundarySurface[];
  frames: BoundarySemanticFrame[];
  candidates: BoundaryEvidenceCandidate[];
};

export type GroundingFinding = { boundaryId: string; surfaceRef: string; code: NarrowBoundaryCode };

/** One fully server-derived row. Every conclusion here was computed, not read from the model. */
export type DerivedAssessment = {
  boundaryId: string;
  surfaceRef: string;
  facts: { governedActionStatus: GovernedActionStatus; prerequisiteStatus: PrerequisiteStatus; temporalRelation: TemporalRelation };
  stateId: string;
  applicability: DerivedApplicability;
  compliance: DerivedCompliance;
  governedAction: BoundaryEvidenceCandidate | null;
  satisfaction: BoundaryEvidenceCandidate | null;
  failure: BoundaryEvidenceCandidate | null;
  reason: string;
};

export type NarrowValidationResult =
  | { ok: true; value: NarrowBoundaryReview; derived: DerivedAssessment[] }
  | {
      ok: false;
      codes: NarrowBoundaryCode[];
      findings: GroundingFinding[];
      value: NarrowBoundaryReview | null;
      /** Rows that passed every check. Preserved as evidence for a failed-subset repair. */
      validSurfaceRefs: string[];
      failedSurfaceRefs: string[];
      derived: DerivedAssessment[];
    };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const oneOf = <T extends readonly string[]>(set: T, v: unknown, fallback: T[number]): T[number] =>
  (set as readonly string[]).includes(str(v)) ? (str(v) as T[number]) : fallback;
const cid = (v: unknown): string => {
  const s = str(v).trim();
  return s === "" ? NO_CANDIDATE : s;
};

export function validateNarrowBoundaryReview(raw: unknown, ctx: NarrowReviewContext): NarrowValidationResult {
  const codes: NarrowBoundaryCode[] = [];
  const findings: GroundingFinding[] = [];
  const fail = (extra: Partial<NarrowValidationResult & { ok: false }> = {}) => ({
    ok: false as const,
    codes: [...new Set(codes)],
    findings,
    value: null,
    validSurfaceRefs: [],
    failedSurfaceRefs: [],
    derived: [],
    ...extra,
  });

  if (!isObj(raw)) {
    codes.push("boundary_review_not_an_object");
    return fail();
  }
  const rawList = Array.isArray(raw.assessments) ? raw.assessments : null;
  if (!rawList) {
    codes.push("boundary_review_assessments_missing");
    return fail();
  }

  const assessments: BoundaryTruthAssessment[] = rawList.map((a) => {
    const o = isObj(a) ? a : {};
    return {
      boundaryId: str(o.boundaryId).trim(),
      surfaceRef: str(o.surfaceRef).trim(),
      governedActionStatus: oneOf(GOVERNED_ACTION_STATUSES, o.governedActionStatus, "uncertain"),
      prerequisiteStatus: oneOf(PREREQUISITE_STATUSES, o.prerequisiteStatus, "uncertain"),
      temporalRelation: oneOf(TEMPORAL_RELATIONS, o.temporalRelation, "not_applicable"),
      governedActionCandidateId: cid(o.governedActionCandidateId),
      prerequisiteSatisfactionCandidateId: cid(o.prerequisiteSatisfactionCandidateId),
      prerequisiteFailureCandidateId: cid(o.prerequisiteFailureCandidateId),
      reason: str(o.reason),
    };
  });
  const value: NarrowBoundaryReview = { assessments };

  for (const a of rawList) {
    const o = isObj(a) ? a : {};
    if (
      !(GOVERNED_ACTION_STATUSES as readonly string[]).includes(str(o.governedActionStatus)) ||
      !(PREREQUISITE_STATUSES as readonly string[]).includes(str(o.prerequisiteStatus)) ||
      !(TEMPORAL_RELATIONS as readonly string[]).includes(str(o.temporalRelation))
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
  if (codes.length > 0) return fail({ value });

  // --- state classification and candidate resolution -------------------------
  const frameById = new Map(ctx.frames.map((f) => [f.boundaryId, f]));
  const index = indexCandidates(ctx.candidates);
  const derived: DerivedAssessment[] = [];
  const validSurfaceRefs: string[] = [];
  const failedSurfaceRefs: string[] = [];

  for (const a of assessments) {
    const rowCodes: NarrowBoundaryCode[] = [];
    const push = (code: NarrowBoundaryCode) => {
      rowCodes.push(code);
      codes.push(code);
      findings.push({ boundaryId: a.boundaryId, surfaceRef: a.surfaceRef, code });
    };

    const frame = frameById.get(a.boundaryId);
    if (!frame || frame.ruleKind === "uncertain") {
      push("boundary_semantic_frame_uncertain");
      failedSurfaceRefs.push(a.surfaceRef);
      continue;
    }

    // ONE classification seam. A combination outside the canonical table has no meaning.
    const state: TruthStateRule | null = classifyTruthState(a, frame.ruleKind);
    if (!state) {
      push("boundary_assessment_state_invalid");
      failedSurfaceRefs.push(a.surfaceRef);
      continue;
    }

    if (state.reasonAuthority === "model_required") {
      const t = a.reason.trim();
      if (t.length < MODEL_REASON_MIN_CHARS) push("boundary_reason_required_missing");
      else if (GENERIC_REASON_PHRASES.includes(normalizeReason(t) as (typeof GENERIC_REASON_PHRASES)[number])) push("boundary_reason_generic");
    }

    /**
     * Resolve one selected id against the requirement the state places on that role — and against
     * the POOL the server actually offered.
     *
     * R2.39 measured why the second half matters. Once the role gate refuses a
     * prerequisite-performing span, `primary[0]` has no governed-action candidate at all. Under an
     * unconditional `required` rule the only honest answer — "this surface does not perform the
     * governed action, and there is nothing to point at" — was itself refused, turning a false
     * positive into an output-contract failure. A required candidate is required only where one was
     * offered.
     */
    const take = (
      id: string,
      role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure",
      requirement: TruthStateRule["governedActionCandidate"],
    ): BoundaryEvidenceCandidate | null => {
      const poolEmpty = poolFor(ctx.candidates, a.boundaryId, a.surfaceRef, role).length === 0;
      if (id === NO_CANDIDATE) {
        if (requirement === "required" && !poolEmpty) push("boundary_candidate_required_missing");
        return null;
      }
      if (requirement === "forbidden") {
        push("boundary_candidate_forbidden_present");
        return null;
      }
      const r = resolveCandidate(index, id, { boundaryId: a.boundaryId, surfaceRef: a.surfaceRef, role });
      if (!r.ok) {
        push(r.code);
        return null;
      }
      return r.candidate;
    };

    // (Part 6 A) A surface cannot PERFORM the governed action when the server found no span
    // expressing it. This is a distinct authority from "the model forgot to choose".
    if (a.governedActionStatus === "present" && poolFor(ctx.candidates, a.boundaryId, a.surfaceRef, "governed_action").length === 0) {
      push("boundary_governed_action_candidate_unavailable");
    }
    const governedAction = take(a.governedActionCandidateId, "governed_action", state.governedActionCandidate);
    const satisfaction = take(a.prerequisiteSatisfactionCandidateId, "prerequisite_satisfaction", state.satisfactionCandidate);
    const failure = take(a.prerequisiteFailureCandidateId, "prerequisite_failure", state.failureCandidate);

    // (Part 8) A row cannot claim the prerequisite was met AND that it failed.
    if (satisfaction && failure) push("boundary_prerequisite_contradiction");

    if (rowCodes.length > 0) {
      failedSurfaceRefs.push(a.surfaceRef);
      continue;
    }
    validSurfaceRefs.push(a.surfaceRef);
    derived.push({
      boundaryId: a.boundaryId,
      surfaceRef: a.surfaceRef,
      facts: { governedActionStatus: a.governedActionStatus, prerequisiteStatus: a.prerequisiteStatus, temporalRelation: a.temporalRelation },
      stateId: state.id,
      applicability: state.derivedApplicability,
      compliance: state.derivedCompliance,
      governedAction,
      satisfaction,
      failure,
      reason: a.reason,
    });
  }

  if (codes.length > 0) return fail({ value, validSurfaceRefs, failedSurfaceRefs, derived });
  return { ok: true, value, derived };
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
  stateId: string;
  applicability: DerivedApplicability;
  compliance: DerivedCompliance;
  governedActionStatus: GovernedActionStatus;
  prerequisiteStatus: PrerequisiteStatus;
  temporalRelation: TemporalRelation;
  governedActionCandidateId: string;
  prerequisiteFailureCandidateId: string;
  /** Server-RESOLVED, never model-authored. */
  governedActionEvidence: string;
  prerequisiteFailureEvidence: string;
  governedActionSegmentRef: string;
  prerequisiteSegmentRef: string;
  prerequisiteSegmentKind: string;
  violationMechanism: string;
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
  | { outcome: "boundary_review_pass"; assessedPairs: number; notApplicableCount: number; explanations: ServerExplanation[]; derived: DerivedAssessment[] }
  | {
      outcome: "boundary_review_reject";
      violations: BoundaryViolation[];
      causalViolations: BoundaryViolation[];
      downstreamViolations: BoundaryViolation[];
      assessedPairs: number;
      explanations: ServerExplanation[];
      derived: DerivedAssessment[];
    }
  | { outcome: "boundary_review_inconclusive"; uncertainties: BoundaryUncertainty[]; assessedPairs: number; explanations: ServerExplanation[]; derived: DerivedAssessment[] }
  | {
      outcome: "boundary_review_malformed";
      codes: NarrowBoundaryCode[];
      findings: GroundingFinding[];
      failureClass: NarrowFailureClass;
      /** Rows that survived. Held as evidence for a failed-subset repair, never as a verdict. */
      validSurfaceRefs: string[];
      failedSurfaceRefs: string[];
      derived: DerivedAssessment[];
    };

export function deriveBoundaryVerdict(raw: unknown, ctx: NarrowReviewContext): DerivedBoundaryVerdict {
  const v = validateNarrowBoundaryReview(raw, ctx);
  if (!v.ok) {
    return {
      outcome: "boundary_review_malformed",
      codes: v.codes,
      findings: v.findings,
      failureClass: classifyFailure(v.codes),
      validSurfaceRefs: v.validSurfaceRefs,
      failedSurfaceRefs: v.failedSurfaceRefs,
      derived: v.derived,
    };
  }
  return verdictFromDerived(v.derived, ctx);
}

/** Shared by the ordinary path and the failed-subset merge, so both derive identically. */
export function verdictFromDerived(derived: DerivedAssessment[], ctx: NarrowReviewContext): DerivedBoundaryVerdict {
  const statements = new Map(ctx.boundaries.map((b) => [b.id, b.statement]));
  const surfaceByRef = new Map(ctx.surfaces.map((s) => [s.coordinate, s]));
  const order = new Map(ctx.surfaces.map((s, i) => [s.coordinate, i]));
  const assessedPairs = derived.length;

  const explanations = explainAll(
    derived.map((d) => ({
      boundaryId: d.boundaryId,
      boundaryStatement: statements.get(d.boundaryId) ?? "",
      surfaceRef: d.surfaceRef,
      applicability: d.applicability,
      compliance: d.compliance,
      violationMechanism: d.compliance === "violates" ? deriveMechanism(
        { verdictEffect: "violation", mechanismFamily: "prerequisite_unmet" } as TruthStateRule,
        surfaceByRef.get(d.surfaceRef)?.kind ?? "",
        false,
      ) : "none",
      governedActionEvidence: d.governedAction?.excerpt ?? "",
      prerequisiteFailureEvidence: d.failure?.excerpt ?? "",
      modelReason: d.reason,
    })),
  );

  const violatingRows = derived.filter((d) => d.compliance === "violates");
  if (violatingRows.length > 0) {
    const byRef = new Map(violatingRows.map((d) => [d.boundaryId + " " + d.surfaceRef, d]));
    const violations: BoundaryViolation[] = violatingRows
      .map((d) => {
        const surface = surfaceByRef.get(d.surfaceRef);
        const lineage = surface?.lineage ?? [];
        const ancestors = lineage.map((anc) => byRef.get(d.boundaryId + " " + anc)).filter(Boolean);
        const state = classifyTruthState(d.facts, "prerequisite_before_action");
        const mechanism = state ? deriveMechanism(state, surface?.kind ?? "", ancestors.length > 0) : "governed_action_without_prerequisite";
        const newlyAuthorizes = surface?.independentlySelectable === true;
        const sameMechanism = ancestors.some((anc) => {
          const s2 = anc ? classifyTruthState(anc.facts, "prerequisite_before_action") : null;
          return s2 ? deriveMechanism(s2, surfaceByRef.get(anc!.surfaceRef)?.kind ?? "", false) === mechanism : false;
        });
        return {
          boundaryId: d.boundaryId,
          boundaryStatement: statements.get(d.boundaryId) ?? "",
          surfaceRef: d.surfaceRef,
          stateId: d.stateId,
          applicability: d.applicability,
          compliance: d.compliance,
          governedActionStatus: d.facts.governedActionStatus,
          prerequisiteStatus: d.facts.prerequisiteStatus,
          temporalRelation: d.facts.temporalRelation,
          governedActionCandidateId: d.governedAction?.candidateId ?? "",
          prerequisiteFailureCandidateId: d.failure?.candidateId ?? "",
          governedActionEvidence: d.governedAction?.excerpt ?? "",
          prerequisiteFailureEvidence: d.failure?.excerpt ?? "",
          governedActionSegmentRef: d.governedAction?.canonicalSegmentRef ?? "",
          prerequisiteSegmentRef: d.failure?.canonicalSegmentRef ?? "",
          prerequisiteSegmentKind: d.failure?.canonicalSegmentKind ?? "",
          violationMechanism: mechanism,
          reason: d.reason,
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
      derived,
    };
  }

  const uncertainties: BoundaryUncertainty[] = [];
  for (const d of derived) {
    if (d.applicability === "uncertain") uncertainties.push({ boundaryId: d.boundaryId, surfaceRef: d.surfaceRef, reason: d.reason, level: "applicability" });
    else if (d.compliance === "uncertain") {
      const level = d.facts.temporalRelation === "simultaneous_or_unclear" ? "temporal" : d.facts.prerequisiteStatus === "uncertain" ? "prerequisite" : "compliance";
      uncertainties.push({ boundaryId: d.boundaryId, surfaceRef: d.surfaceRef, reason: d.reason, level });
    }
  }
  if (uncertainties.length > 0) return { outcome: "boundary_review_inconclusive", uncertainties, assessedPairs, explanations, derived };

  const requiredPairs = ctx.boundaries.length * ctx.surfaces.length;
  if (assessedPairs !== requiredPairs) {
    return { outcome: "boundary_review_malformed", codes: ["boundary_review_missing_pair"], findings: [], failureClass: "coverage", validSurfaceRefs: [], failedSurfaceRefs: [], derived };
  }
  return {
    outcome: "boundary_review_pass",
    assessedPairs,
    notApplicableCount: derived.filter((d) => d.applicability === "not_applicable").length,
    explanations,
    derived,
  };
}

export const BOUNDARY_OUTCOMES_ALLOWING_BROAD_REVIEW: readonly BoundaryReviewOutcome[] = ["boundary_review_pass", "boundary_review_not_applicable"];
export const allowsBroadReview = (outcome: BoundaryReviewOutcome): boolean => BOUNDARY_OUTCOMES_ALLOWING_BROAD_REVIEW.includes(outcome);
export const producesCorrectionPacket = (v: DerivedBoundaryVerdict): v is Extract<DerivedBoundaryVerdict, { outcome: "boundary_review_reject" }> =>
  v.outcome === "boundary_review_reject";

// ---------------------------------------------------------------------------
// Failed-subset repair (Part 14)
// ---------------------------------------------------------------------------

export const SUBSET_REPAIR_CODES = [
  "subset_repair_not_repairable",
  "subset_repair_coverage_mismatch",
  "subset_repair_preserved_row_mutated",
  "subset_repair_duplicate_row",
] as const;
export type SubsetRepairCode = (typeof SUBSET_REPAIR_CODES)[number];

export type SubsetRepairPlan =
  | { repairable: true; failedSurfaceRefs: string[]; preservedSurfaceRefs: string[]; codes: NarrowBoundaryCode[] }
  | { repairable: false; because: SubsetRepairCode | NarrowFailureClass };

/**
 * Decide whether a failed response can be repaired surface-by-surface.
 *
 * R2.37 measured the cost of the alternative: one full-matrix rerun re-derived ten already-coherent
 * assessments and landed on a different member of the same failure family. Only an OUTPUT-CONTRACT
 * failure is repairable — a coverage, transport or fabrication failure means the whole response is
 * untrustworthy and there is nothing safe to preserve.
 */
export function planSubsetRepair(v: DerivedBoundaryVerdict): SubsetRepairPlan {
  if (v.outcome !== "boundary_review_malformed") return { repairable: false, because: "subset_repair_not_repairable" };
  if (!isLocallyRepairable(v.failureClass)) return { repairable: false, because: v.failureClass };
  if (v.failedSurfaceRefs.length === 0) return { repairable: false, because: "subset_repair_coverage_mismatch" };
  return {
    repairable: true,
    failedSurfaceRefs: [...new Set(v.failedSurfaceRefs)],
    preservedSurfaceRefs: [...new Set(v.validSurfaceRefs)],
    codes: [...new Set(v.codes)],
  };
}

export type SubsetMergeResult =
  | { ok: true; derived: DerivedAssessment[] }
  | { ok: false; code: SubsetRepairCode; detail: string };

/**
 * Merge a repair response into the preserved rows.
 *
 * PRESERVED ROWS ARE IMMUTABLE. A repair that returns a surface the server did not ask about, omits
 * one it did, or duplicates a row is refused outright — the repair path must never become a way to
 * revise an assessment that already passed.
 */
export function mergeSubsetRepair(preserved: DerivedAssessment[], repaired: DerivedAssessment[], failedSurfaceRefs: string[]): SubsetMergeResult {
  const want = new Set(failedSurfaceRefs);
  const got = new Set<string>();
  for (const r of repaired) {
    if (got.has(r.surfaceRef)) return { ok: false, code: "subset_repair_duplicate_row", detail: r.surfaceRef };
    got.add(r.surfaceRef);
    if (!want.has(r.surfaceRef)) return { ok: false, code: "subset_repair_preserved_row_mutated", detail: r.surfaceRef };
  }
  for (const w of want) if (!got.has(w)) return { ok: false, code: "subset_repair_coverage_mismatch", detail: w };
  const preservedRefs = new Set(preserved.map((p) => p.surfaceRef));
  for (const w of want) if (preservedRefs.has(w)) return { ok: false, code: "subset_repair_preserved_row_mutated", detail: w };
  return { ok: true, derived: [...preserved, ...repaired] };
}

// ---------------------------------------------------------------------------
// Rerun authority (caps unchanged from R2.32/R2.34)
// ---------------------------------------------------------------------------

export const MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT = 2;
export const BOUNDARY_REVIEWER_TERMINAL_FAILURE = "boundary_reviewer_terminal_failure" as const;
export const BOUNDARY_REVIEW_AUTHORITY_FAILURE = "boundary_review_authority_failure" as const;

export type BoundaryReviewDecision =
  | { action: "continue" }
  | { action: "correction_path" }
  | { action: "inconclusive" }
  | { action: "repair_failed_subset"; surfaceRefs: string[]; because: string }
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
      if (attempt >= MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT) {
        return {
          action: "boundary_reviewer_terminal_failure",
          because: code + " on boundary review attempt " + attempt + " of " + MAX_BOUNDARY_REVIEW_CALLS_PER_SUBJECT + " over an identical frozen subject",
        };
      }
      const plan = planSubsetRepair(outcome.verdict);
      if (plan.repairable) {
        return {
          action: "repair_failed_subset",
          surfaceRefs: plan.failedSurfaceRefs,
          because:
            code +
            " on " +
            plan.failedSurfaceRefs.length +
            " of " +
            (plan.failedSurfaceRefs.length + plan.preservedSurfaceRefs.length) +
            " surfaces; the rest are preserved unchanged and are NOT re-requested",
        };
      }
      return { action: "rerun_boundary_review", because: code + " — the boundary review was unusable; the scenario is unjudged and is NOT regenerated" };
    }
  }
}

export const boundaryReviewCountsAsGenerationRetry = (d: BoundaryReviewDecision): boolean => d.action === "correction_path";
