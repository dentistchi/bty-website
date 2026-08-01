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
  "THE JOB. You are given a list of CONFIRMED BOUNDARIES (non-negotiable rules that hold in this situation) and a list of DECISION SURFACES (every place in the scenario where a boundary can be honoured or broken). For EVERY boundary paired with EVERY surface, answer one question:",
  "  Does this surface comply with this boundary?",
  "",
  "COVERAGE. Return exactly one assessment for every (boundary, surface) pair — `activeBoundaryCount` × `decisionSurfaceCount` assessments. Never fewer, never more, never a duplicate pair.",
  "Copy `surfaceRef` VERBATIM from the `surfaces` list. Never invent, abbreviate, renumber or omit a coordinate. Copy `boundaryId` verbatim from `constraints`.",
  "",
  "SURFACES ARE OF TWO KINDS.",
  "  kind=choice — an option the learner can pick. Judge what choosing it commits the learner to.",
  "  kind=resulting_world_state — a state the scenario ASSERTS has already happened after a primary choice. Judge the state itself. A boundary can be broken by a state as surely as by an action: if the state says a required check was skipped, or that something the rule forbids has occurred, that surface VIOLATES the boundary even though the learner picks nothing there.",
  "",
  "RESULTS.",
  "  complies  — this surface honours the boundary. Your evidence must show the required prerequisite or action actually being satisfied in the surface's own text.",
  "  violates  — this surface breaks, skips, bypasses, reverses or proceeds without the boundary. Your evidence must identify the conflicting action or the conflicting state.",
  "  uncertain — the surface text genuinely does not settle the question. Your reason must name the EXACT ambiguity. Do not use `uncertain` to avoid a judgment you can make.",
  "",
  "EVIDENCE IS MANDATORY AND MUST BE CONCRETE.",
  "`evidenceExcerpt` must be a short VERBATIM excerpt of THAT SURFACE'S OWN text — the words shown to you for that exact coordinate.",
  "  It must NOT be the boundary statement repeated back.",
  "  It must NOT be text belonging to a different surface.",
  "  It must NOT be a conclusion such as 'complies with the boundary', 'follows the rule', 'safe and appropriate' or 'ensuring compliance'.",
  "A compliance claim you cannot support with the surface's own words is not a compliance claim. If the surface text does not let you quote support, answer `uncertain` and say why.",
  `Keep evidenceExcerpt within ${NARROW_EVIDENCE_MAX} characters and reason within ${NARROW_REASON_MAX} characters. Excerpt faithfully; do not paraphrase.`,
  "",
  "SILENCE IS NOT COMPLIANCE. A surface that simply does not mention the rule has not thereby obeyed it — ask whether what it commits to, or what it asserts, is possible while the rule holds.",
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
  /** The server's canonical decision-surface map. */
  surfaces: BoundarySurface[];
  surfaceMapSha256: string;
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
    surfaces: args.surfaces,
    surfaceMapSha256: surfaceMapSha256(args.surfaces),
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
    `Every one of the ${surfaceCount} listed decision surfaces — including every resulting world state — ` +
    `must comply with EVERY boundary listed in \`constraints\`. ` +
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
    isActionCommitment: boolean;
    acceptedCost: string;
  }>;
  authority: {
    scenarioSha256: string;
    reviewSubjectSha256: string;
    boundaryProvenanceSha256: string;
    surfaceMapSha256: string;
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
      isActionCommitment: s.isActionCommitment,
      acceptedCost: s.acceptedCost,
    })),
    authority: {
      scenarioSha256: subject.scenarioSha256,
      reviewSubjectSha256: subject.reviewSubjectSha256,
      boundaryProvenanceSha256: subject.boundaryProvenanceSha256,
      surfaceMapSha256: subject.surfaceMapSha256,
      boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
    },
  };
}
