/**
 * NARROW BOUNDARY-REVIEW CONTRACT (Slice 3.2I-R5B1A.1-R2.29).
 *
 * The prompt, sampling, frozen subject and request projection for the narrow confirmed-boundary
 * review stage. Deliberately provider-free so the manifest, the budget measurement and the tests can
 * all import it without reaching a network seam.
 *
 * R2.28 measured that the broad replay request omitted `activeBoundaryCount` and
 * `boundaryComplianceScope` — the only place in the whole contract that said "and every resulting
 * world state". Every request built here carries both, plus the explicit surface inventory, so the
 * scope of the question is never implicit.
 */

import { createHash } from "node:crypto";
import { canonicalJson } from "@/domain/foundry/arena-draft/reviewSubject";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_BOUNDARY_SCHEMA_NAME,
  NARROW_BOUNDARY_CONTRACT_VERSION,
  NARROW_EVIDENCE_MAX,
  NARROW_REASON_MAX,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import {
  SURFACE_MAP_VERSION,
  compatibilitySurfaces,
  lineageSha256,
  reviewableSurfaces,
  surfaceMapSha256,
  type BoundarySurface,
} from "@/domain/foundry/arena-draft/boundarySurfaces";
import type { BoundaryReviewProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";

const d = (v: unknown): string => createHash("sha256").update(typeof v === "string" ? v : canonicalJson(v)).digest("hex");

/**
 * Same determinism as the broad reviewer: temperature 0, top_p 1. A safety authority that returns a
 * different answer to the same question is not an authority.
 *
 * `maxTokens` is measured, not assumed — see `measureNarrowBoundaryBudget`. The schema's permitted
 * maximum (3 boundaries × 16 surfaces) must fit under it with headroom, and under the model cap.
 */
export const NARROW_BOUNDARY_SAMPLING = {
  temperature: 0,
  topP: 1,
  maxTokens: 16000,
  timeoutMs: 120_000,
} as const;

/**
 * ONE QUESTION, ASKED ONCE PER SURFACE.
 *
 * Everything the broad reviewer is responsible for — defensibility, good faith, branch progression,
 * diversity, vague reassurance, urgency — is deliberately absent. R2.28 measured a reviewer that
 * carried eight contracts at once, produced correct prose about the violation, and then set every
 * boundary boolean to comply. This prompt asks for nothing it does not need.
 */
export const NARROW_BOUNDARY_SYSTEM_PROMPT: string = [
  "You are a CONFIRMED-BOUNDARY COMPLIANCE CHECKER for a leadership decision-practice scenario. You do exactly one job and no other.",
  "",
  "THE JOB. You are given CONFIRMED BOUNDARIES (non-negotiable rules that hold in this situation) and the DECISION SURFACES a learner actually reaches. For EVERY boundary paired with EVERY surface, answer TWO questions IN ORDER.",
  "",
  "QUESTION 1 — APPLICABILITY. Does the boundary GOVERN this surface at all?",
  "  applies        — the surface initiates, authorizes, continues, reopens or produces the action or state the rule governs.",
  "  not_applicable — the surface does none of those. It does something else: staffing, notification, documentation, reporting, escalation, sequencing, communication.",
  "  uncertain      — the surface text is genuinely insufficient to tell. Name the exact ambiguity.",
  "",
  "A SURFACE IS NOT GOVERNED MERELY BY BEING SILENT ABOUT THE RULE. Not repeating the rule, not mentioning the prerequisite, and not restating a required check are NOT evidence that a surface breaks it. Requesting extra staff, preparing a summary, sending a report to an administrator and choosing what to tell someone do not perform the governed action. Answer `not_applicable` and show what the surface actually does.",
  "",
  "QUESTION 2 — COMPLIANCE. Ask this ONLY when applicability is `applies`. Otherwise set compliance to `not_assessed`.",
  "  complies  — the governed action happens WITH the rule satisfied, or the surface preserves the rule.",
  "  violates  — the governed action or state happens WITHOUT the rule satisfied.",
  "  uncertain — you cannot settle it from the text. Name the exact ambiguity.",
  "",
  "A VIOLATION MUST PROVE A MECHANISM, NOT AN ABSENCE. To answer `violates` you must show BOTH:",
  "  governedActionEvidence      — a verbatim excerpt of THIS surface's own text showing the governed action or state is actually present.",
  "  prerequisiteFailureEvidence — a verbatim excerpt (from this surface, its resulting world state, or its branch context) showing the prerequisite is missing, skipped, bypassed, contradicted or reopened.",
  "and name violationMechanism:",
  "  governed_action_without_prerequisite      — this surface commits to the governed action while the prerequisite is unmet.",
  "  resulting_state_missing_prerequisite      — the asserted state already contains the governed action having happened without the prerequisite.",
  "  boundary_reopened_after_prior_compliance  — the prerequisite was satisfied earlier and this surface undoes or bypasses it.",
  "  explicit_boundary_contradiction           — the surface states something the rule forbids outright.",
  "  other_grounded_violation                  — a real mechanism none of the above names; explain it in reason.",
  "If you cannot show BOTH excerpts, it is not a violation. Answer `not_applicable`, `complies` or `uncertain` instead.",
  "",
  "EVIDENCE IS MANDATORY AND MUST BE CONCRETE.",
  "`governedActionEvidence` is required for `applies` AND for `not_applicable`: it is how you show what the surface does. Excerpt it VERBATIM from that surface's own text.",
  "  It must NOT be the boundary statement repeated back.",
  "  It must NOT be text belonging to a different surface.",
  "  It must NOT be a conclusion such as \'complies with the boundary\', \'follows the rule\' or \'does not address verification\'.",
  "Set prerequisiteFailureEvidence to an empty string unless compliance is `violates`. Set violationMechanism to `none` unless compliance is `violates`.",
  "",
  "SURFACES ARE OF TWO KINDS.",
  "  kind=choice — an option the learner can pick. Judge what choosing it commits the learner to.",
  "  kind=resulting_world_state — a state the scenario ASSERTS has already happened after a primary choice. Judge the state itself: if it says the governed action occurred while the prerequisite was unmet, that surface VIOLATES even though the learner picks nothing there.",
  "",
  "COVERAGE. Return exactly one assessment for every (boundary, surface) pair — `activeBoundaryCount` x `decisionSurfaceCount` assessments. Never fewer, never more, never a duplicate. Copy `surfaceRef` and `boundaryId` VERBATIM. Never invent, abbreviate, renumber or omit a coordinate.",
  "",
  "A CONFIRMED RULE NARROWS THE CHOICE SPACE; IT DOES NOT ELIMINATE JUDGMENT. A surface that takes time, escalates, seeks supervision, sequences work or communicates while KEEPING the rule complies — time cost alone is never a violation.",
  "",
  "You have no summary field, no overall verdict and no retry instruction, and you must not attempt one. Your per-surface answers are the entire output. Return ONLY the JSON object required by the schema.",
].join("\n");

/**
 * Digest over everything that defines HOW a narrow boundary review is conducted. Part of the frozen
 * subject, so a rerun judged under a different contract fails closed instead of quietly answering a
 * different question.
 */
export function buildNarrowBoundaryContract(): { sha256: string; parts: Record<string, string> } {
  const parts = {
    version: d(NARROW_BOUNDARY_CONTRACT_VERSION),
    prompt: d(NARROW_BOUNDARY_SYSTEM_PROMPT),
    schemaName: d(NARROW_BOUNDARY_SCHEMA_NAME),
    schema: d(NARROW_BOUNDARY_JSON_SCHEMA),
    sampling: d(NARROW_BOUNDARY_SAMPLING),
    surfaceMapVersion: d(SURFACE_MAP_VERSION),
  };
  return { sha256: d(parts), parts };
}

// ---------------------------------------------------------------------------
// The frozen narrow subject
// ---------------------------------------------------------------------------

export type NarrowBoundarySubject = {
  /** The canonical scenario digest — the same value the broad review subject carries. */
  scenarioSha256: string;
  /** The broad frozen-subject identity this narrow review belongs to. */
  reviewSubjectSha256: string;
  boundaryProvenanceSha256: string;
  boundaryProvenance: BoundaryReviewProvenance;
  /** Active boundaries, id + exact statement, in canonical order. */
  boundaries: Array<{ id: string; statement: string }>;
  activeBoundaryIds: string[];
  /**
   * The REVIEWABLE surfaces — the ones the learner actually reaches. R2.30: compatibility
   * projections are held separately and never handed to the reviewer.
   */
  surfaces: BoundarySurface[];
  /** Unreachable duplicates, retained as compatibility evidence with their derivation linkage. */
  compatibilitySurfaces: BoundarySurface[];
  /** Digest over the WHOLE map, reachable and compatibility alike. */
  surfaceMapSha256: string;
  /** Digest over the causal lineage relation, so a re-parented surface is detectable on its own. */
  lineageSha256: string;
  boundaryReviewContractSha256: string;
  language: string;
  /** Which generation attempt produced the scenario under review. */
  generationAttemptId: string;
  caseId: string;
};

/**
 * The digest BOTH narrow review attempts must carry.
 *
 * Covers the exact scenario, the exact active boundary ids AND text, the exact surface coordinates
 * AND content, and the contract. Anything that could change the question changes this value, so
 * drift is provable before a second call is spent.
 */
export function narrowBoundarySubjectSha256(s: NarrowBoundarySubject): string {
  return d({
    normalizationVersion: NARROW_BOUNDARY_CONTRACT_VERSION,
    scenarioSha256: s.scenarioSha256,
    boundaries: s.boundaries.map((b) => ({ id: b.id, statement: b.statement })),
    activeBoundaryIds: [...s.activeBoundaryIds].sort(),
    surfaceMapSha256: s.surfaceMapSha256,
    lineageSha256: s.lineageSha256,
    reviewableCoordinates: s.surfaces.map((x) => x.coordinate),
    boundaryReviewContractSha256: s.boundaryReviewContractSha256,
    boundaryProvenanceSha256: s.boundaryProvenanceSha256,
    language: s.language,
  });
}

export function buildNarrowBoundarySubject(args: {
  scenarioSha256: string;
  reviewSubjectSha256: string;
  boundaryProvenance: BoundaryReviewProvenance;
  boundaryProvenanceSha256: string;
  boundaries: Array<{ id: string; statement: string }>;
  surfaces: BoundarySurface[];
  language: string;
  generationAttemptId: string;
  caseId: string;
}): NarrowBoundarySubject {
  return {
    scenarioSha256: args.scenarioSha256,
    reviewSubjectSha256: args.reviewSubjectSha256,
    boundaryProvenanceSha256: args.boundaryProvenanceSha256,
    boundaryProvenance: args.boundaryProvenance,
    boundaries: args.boundaries,
    activeBoundaryIds: args.boundaries.map((b) => b.id),
    // The reviewer sees ONLY what the learner can reach. Compatibility projections are kept for
    // evidence and excluded from the matrix, so they can never produce a product finding.
    surfaces: reviewableSurfaces(args.surfaces),
    compatibilitySurfaces: compatibilitySurfaces(args.surfaces),
    surfaceMapSha256: surfaceMapSha256(args.surfaces),
    lineageSha256: lineageSha256(args.surfaces),
    boundaryReviewContractSha256: buildNarrowBoundaryContract().sha256,
    language: args.language,
    generationAttemptId: args.generationAttemptId,
    caseId: args.caseId,
  };
}

// ---------------------------------------------------------------------------
// Request projection (R2.29 Part 15 — parity, explicit scope, explicit authority)
// ---------------------------------------------------------------------------

/**
 * The scope sentence R2.28 measured missing from the replay request. It states the two things the
 * broad prompt never stated together: that EVERY listed surface is in scope, and that resulting
 * world states are surfaces.
 */
export function boundaryComplianceScopeText(activeBoundaryCount: number, surfaceCount: number): string {
  if (activeBoundaryCount === 0) return "No confirmed boundary applies to this case.";
  return (
    `Judge EVERY one of the ${surfaceCount} listed decision surfaces — including every resulting world state — ` +
    `against EVERY boundary listed in \`constraints\`. For each pair decide APPLICABILITY first, then ` +
    `COMPLIANCE only when it applies. A surface that is silent about the rule is not thereby a violation. ` +
    `Return exactly ${activeBoundaryCount * surfaceCount} assessments: one per (boundary, surface) pair.`
  );
}

export type NarrowBoundaryRequest = {
  constraints: Array<{ id: string; statement: string }>;
  activeBoundaryCount: number;
  decisionSurfaceCount: number;
  requiredAssessmentCount: number;
  boundaryComplianceScope: string;
  surfaces: Array<{
    surfaceRef: string;
    kind: string;
    phase: string;
    text: string;
    selectedPrimary: string;
    branchContext: string;
    /** The asserted world this surface happens inside of — where a missing prerequisite is stated. */
    inheritedWorldState: string;
    /** Causal ancestors, nearest-first. Context only; the server derives lineage findings. */
    lineage: string[];
    isActionCommitment: boolean;
    acceptedCost: string;
  }>;
  /** Count of unreachable duplicates excluded from the matrix. Never assessable. */
  excludedCompatibilitySurfaceCount: number;
  authority: {
    scenarioSha256: string;
    reviewSubjectSha256: string;
    boundaryProvenanceSha256: string;
    surfaceMapSha256: string;
    lineageSha256: string;
    boundaryReviewSubjectSha256: string;
  };
};

/** Build the exact user payload. Deterministic: same subject in, byte-identical request out. */
export function buildNarrowBoundaryRequest(subject: NarrowBoundarySubject): NarrowBoundaryRequest {
  const count = subject.boundaries.length;
  const surfaceCount = subject.surfaces.length;
  return {
    constraints: subject.boundaries.map((b) => ({ id: b.id, statement: b.statement })),
    activeBoundaryCount: count,
    decisionSurfaceCount: surfaceCount,
    requiredAssessmentCount: count * surfaceCount,
    boundaryComplianceScope: boundaryComplianceScopeText(count, surfaceCount),
    surfaces: subject.surfaces.map((s) => ({
      surfaceRef: s.coordinate,
      kind: s.kind,
      phase: s.phase,
      text: s.text,
      selectedPrimary: s.selectedPrimaryLabel,
      branchContext: s.branchContext,
      inheritedWorldState: s.inheritedWorldState,
      lineage: s.lineage,
      isActionCommitment: s.isActionCommitment,
      acceptedCost: s.acceptedCost,
    })),
    excludedCompatibilitySurfaceCount: subject.compatibilitySurfaces.length,
    authority: {
      scenarioSha256: subject.scenarioSha256,
      reviewSubjectSha256: subject.reviewSubjectSha256,
      boundaryProvenanceSha256: subject.boundaryProvenanceSha256,
      surfaceMapSha256: subject.surfaceMapSha256,
      lineageSha256: subject.lineageSha256,
      boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
    },
  };
}
