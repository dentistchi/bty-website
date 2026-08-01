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
import { explanationAuthoritySha256 } from "@/domain/foundry/arena-draft/boundaryExplanation";
import { canonicalJson } from "@/domain/foundry/arena-draft/reviewSubject";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  NARROW_BOUNDARY_SCHEMA_NAME,
  NARROW_BOUNDARY_CONTRACT_VERSION,
  NARROW_EVIDENCE_MAX,
  NARROW_REASON_MAX,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
// R2.36 — the un-merged context and the decomposed rule. Evidence cites a SEGMENT, so the server can
// prove not only that an excerpt exists but where it came from.
import {
  CONTEXT_SEGMENT_VERSION,
  OPENING_SEGMENT_REF,
  SEGMENT_KINDS,
  buildContextSegments,
  contextSegmentMapSha256,
  segmentsForSurface,
  validateContextSegments,
  type ContextSegment,
} from "@/domain/foundry/arena-draft/boundaryContextSegments";
import {
  SEMANTIC_FRAME_VERSION,
  buildSemanticFrames,
  framesSha256,
  semanticFrameContractSha256,
  validateSemanticFrames,
  type BoundarySemanticFrame,
} from "@/domain/foundry/arena-draft/boundarySemanticFrame";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import {
  SURFACE_MAP_VERSION,
  compatibilitySurfaces,
  lineageSha256,
  reviewableSurfaces,
  surfaceMapSha256,
  type BoundarySurface,
} from "@/domain/foundry/arena-draft/boundarySurfaces";
import type { BoundaryReviewProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
// R2.32 — the state rules and the reason policy are GENERATED from the canonical parity table, so
// the prompt cannot say something the validator does not enforce. That drift discarded two complete
// live responses in R2.30.
import {
  parityTableSha256,
  renderPromptStateRules,
  renderReasonPolicyLines,
} from "@/domain/foundry/arena-draft/boundaryReasonParity";

const d = (v: unknown): string => createHash("sha256").update(typeof v === "string" ? v : canonicalJson(v)).digest("hex");

/**
 * Same determinism as the broad reviewer: temperature 0, top_p 1. A safety authority that returns a
 * different answer to the same question is not an authority.
 *
 * `maxTokens` is measured, not assumed — see `measureNarrowBoundaryBudget`. R2.36 re-measured it
 * against the truth contract: the schema-permitted Korean maximum (3 boundaries × 12 reachable
 * surfaces, every string at its bound) is 11,072 estimated tokens — 1.445× headroom under this
 * budget and 1.480× under the model cap. That headroom is why prerequisite SATISFACTION and FAILURE
 * share ONE evidence reference; two separate references measured 1.19×, below the required 1.25×.
 */
export const NARROW_BOUNDARY_SAMPLING = {
  temperature: 0,
  topP: 1,
  maxTokens: 16000,
  timeoutMs: 120_000,
} as const;

/**
 * FOUR QUESTIONS, ASKED ONCE PER SURFACE — R2.36.
 *
 * R2.29 asked two (applicability, compliance). R2.35 measured what two could not catch: a branch
 * whose own text said "you have VERIFIED identifiers for both patients" was rejected for a
 * PREREQUISITE FAILURE quoted as "you still face delays in the ward". Both excerpts were real, both
 * were grounded, and the assessment was nonsense — nothing in the contract represented whether the
 * prerequisite was satisfied, so nothing could refuse it.
 *
 * The two added questions are the truth questions: is the governed action present ON THIS SURFACE,
 * and what is the state of the prerequisite. Every excerpt now cites a server-labelled segment, so
 * "this surface's own text" is checkable rather than assumed.
 */
export const NARROW_BOUNDARY_SYSTEM_PROMPT: string = [
  "You are a CONFIRMED-BOUNDARY COMPLIANCE CHECKER for a leadership decision-practice scenario. You do exactly one job and no other.",
  "",
  "THE JOB. You are given CONFIRMED BOUNDARIES (non-negotiable rules that hold in this situation), each already decomposed into the PREREQUISITE it requires and the ACTION it governs, and the DECISION SURFACES a learner actually reaches. For EVERY boundary paired with EVERY surface, answer FOUR questions IN ORDER.",
  "",
  "CONTEXT COMES AS NUMBERED SEGMENTS. Every piece of text you are given carries a `segmentRef` and a `segmentKind`:",
  "  scenario_opening       — the situation everyone is inside. Context for every surface. NEVER evidence of what a surface does.",
  "  own_surface            — THIS surface's own text. The only place its own action can be proved.",
  "  parent_generated_state — the world state this surface sits inside, asserted by an earlier choice.",
  "  ancestor_primary       — the earlier choice that produced this branch.",
  "  branch_escalation      — what has since developed in this branch.",
  "EVERY excerpt you quote must name the `segmentRef` it came from and must be VERBATIM text from that segment. A quote whose segmentRef does not contain it is rejected.",
  "",
  "QUESTION 1 — APPLICABILITY. Does the boundary GOVERN this surface at all?",
  "  applies        — the surface initiates, authorizes, continues, reopens or produces the action or state the rule governs.",
  "  not_applicable — the surface does none of those. It does something else: staffing, notification, documentation, reporting, escalation, sequencing, communication.",
  "  uncertain      — the surface text is genuinely insufficient to tell.",
  "",
  "A SURFACE IS NOT GOVERNED MERELY BY BEING SILENT ABOUT THE RULE. Not repeating the rule, not mentioning the prerequisite, and not restating a required check are NOT evidence that a surface breaks it. Requesting extra staff, preparing a summary, sending a report to an administrator and choosing what to tell someone do not perform the governed action.",
  "",
  "QUESTION 2 — GOVERNED ACTION. Is the action the boundary governs present in THIS SURFACE'S OWN TEXT?",
  "  present   — this surface's own text performs, commits to, authorizes or asserts the governed action.",
  "  absent    — it does not. Something in the surrounding context may describe it; that is not this surface doing it.",
  "  uncertain — the text is insufficient to tell.",
  "Put the excerpt in `actionEvidence`, and its `segmentRef` MUST be an `own_surface` segment. Context cannot make a surface guilty of an action it does not take.",
  "",
  "QUESTION 3 — PREREQUISITE. What is the state of the prerequisite the boundary requires?",
  "  satisfied          — the text says the prerequisite HAS been met. Quote it.",
  "  explicitly_missing — the text says it has NOT been met, was skipped, bypassed or left undone. Quote it.",
  "  contradicted       — the text asserts something incompatible with the prerequisite holding.",
  "  not_established    — nothing says either way. THIS IS NOT A VIOLATION. Silence is not failure.",
  "  uncertain          — you cannot tell.",
  "  not_applicable     — the boundary has no prerequisite, or the governed action is absent.",
  "Put the supporting excerpt in `prerequisiteEvidence`. It may come from an `own_surface` or a `parent_generated_state` segment — never from any other kind.",
  "THE EXCERPT MUST BE ABOUT THE PREREQUISITE ITSELF. The boundary names a specific prerequisite; your quote must concern THAT. A quote about delay, cost, workload, staffing, morale, scheduling or any other bad consequence is NOT a prerequisite failure, however serious it sounds.",
  "",
  "QUESTION 4 — ORDER. How does the governed action stand in time against the prerequisite?",
  "  prerequisite_before_action  — the prerequisite is met first. This is the rule being KEPT.",
  "  action_before_prerequisite  — the governed action happens while the prerequisite is still unmet.",
  "  simultaneous_or_unclear     — they are committed together, or the ordering cannot be settled.",
  "  unrelated / not_applicable  — no ordering question arises.",
  "",
  "COMPLIANCE follows from the four answers. Ask it ONLY when applicability is `applies`; otherwise set compliance to `not_assessed`.",
  "  complies  — the governed action happens WITH the prerequisite satisfied, or the surface preserves the rule.",
  "  violates  — the governed action happens WITHOUT it.",
  "  uncertain — you cannot settle it from the text.",
  "",
  "A VIOLATION MUST PROVE A MECHANISM, NOT AN ABSENCE. `violates` requires ALL FOUR of:",
  "  governedActionStatus = present, proved from this surface's OWN segment;",
  "  prerequisiteStatus = explicitly_missing OR contradicted — never `not_established`;",
  "  prerequisiteEvidence that is genuinely ABOUT the prerequisite the boundary names;",
  "  temporalRelation = action_before_prerequisite OR simultaneous_or_unclear.",
  "and a named violationMechanism:",
  "  governed_action_without_prerequisite      — this surface commits to the governed action while the prerequisite is unmet.",
  "  resulting_state_missing_prerequisite      — the asserted state already contains the governed action having happened without the prerequisite.",
  "  boundary_reopened_after_prior_compliance  — the prerequisite was satisfied earlier and this surface undoes or bypasses it.",
  "  explicit_boundary_contradiction           — the surface states something the rule forbids outright.",
  "  other_grounded_violation                  — a real mechanism none of the above names.",
  "If any of the four is missing, it is NOT a violation. Answer `not_applicable`, `complies` or `uncertain` instead.",
  "",
  "IF THE PREREQUISITE IS SATISFIED, THE SURFACE DOES NOT VIOLATE. A surface whose own state says the required check has been done complies — even if that state also describes delay, pressure, shortage or difficulty. Those are costs, not boundary violations.",
  "",
  "EVERY VALID ANSWER IS ONE OF THESE SIX STATES. Fill exactly the fields the state calls for:",
  ...renderPromptStateRules(),
  "",
  ...renderReasonPolicyLines(),
  "",
  "EVIDENCE MUST BE CONCRETE.",
  "  It must NOT be the boundary statement repeated back.",
  "  It must NOT be text belonging to a different surface.",
  "  It must NOT be a conclusion such as 'complies with the boundary', 'follows the rule' or 'does not address verification'.",
  "Set violationMechanism to `none` unless compliance is `violates`.",
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
    // The parity table is part of the review contract: it decides what the prompt says AND what the
    // validator requires, so a change to it changes the question being asked.
    reasonParityTable: parityTableSha256(),
    explanationAuthority: explanationAuthoritySha256(),
    // R2.36 — the segmentation vocabulary and the rule decomposition both change the QUESTION, so
    // both belong to the contract identity, not merely to the payload.
    contextSegmentVersion: d(CONTEXT_SEGMENT_VERSION),
    contextSegmentKinds: d(SEGMENT_KINDS),
    semanticFrameVersion: d(SEMANTIC_FRAME_VERSION),
    semanticFrameContract: semanticFrameContractSha256(),
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
  /**
   * The scenario premise. R2.35 measured it ABSENT from the narrow request: `primary[1]` — "Notify
   * the families and proceed with one patient" — was judged as a bare label with no clinical
   * premise, and came back `not_applicable` in 3 of 3 live runs.
   */
  opening: string;
  /** The un-merged, server-labelled context. Evidence cites these; the server verifies locality. */
  contextSegments: ContextSegment[];
  contextSegmentMapSha256: string;
  /** One decomposed frame per boundary. An undecomposable rule fails the subject closed. */
  semanticFrames: BoundarySemanticFrame[];
  semanticFramesSha256: string;
  /** Fail-closed reasons discovered while building the subject — checked BEFORE a provider call. */
  subjectDefects: string[];
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
    // R2.36 — the context the reviewer actually sees, and the rule decomposition it answers under.
    contextSegmentMapSha256: s.contextSegmentMapSha256,
    semanticFramesSha256: s.semanticFramesSha256,
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
  /** The scenario under review — the ONLY source of the opening segment. */
  draft: ArenaScenarioDraft;
  language: string;
  generationAttemptId: string;
  caseId: string;
}): NarrowBoundarySubject {
  const reviewable = reviewableSurfaces(args.surfaces);
  const contextSegments = buildContextSegments(args.draft, reviewable);
  const semanticFrames = buildSemanticFrames(args.boundaries);
  // Both checks run BEFORE any provider call. A missing opening or an undecomposable rule is a
  // NAMED refusal, never a silently thinner question — which is exactly what R2.35 measured.
  const contextCheck = validateContextSegments(contextSegments, reviewable);
  const frameCheck = validateSemanticFrames(semanticFrames);
  return {
    scenarioSha256: args.scenarioSha256,
    reviewSubjectSha256: args.reviewSubjectSha256,
    boundaryProvenanceSha256: args.boundaryProvenanceSha256,
    boundaryProvenance: args.boundaryProvenance,
    boundaries: args.boundaries,
    activeBoundaryIds: args.boundaries.map((b) => b.id),
    // The reviewer sees ONLY what the learner can reach. Compatibility projections are kept for
    // evidence and excluded from the matrix, so they can never produce a product finding.
    surfaces: reviewable,
    compatibilitySurfaces: compatibilitySurfaces(args.surfaces),
    surfaceMapSha256: surfaceMapSha256(args.surfaces),
    lineageSha256: lineageSha256(args.surfaces),
    opening: typeof args.draft.opening === "string" ? args.draft.opening : "",
    contextSegments,
    contextSegmentMapSha256: contextSegmentMapSha256(contextSegments),
    semanticFrames,
    semanticFramesSha256: framesSha256(semanticFrames),
    subjectDefects: [...contextCheck.codes, ...frameCheck.codes],
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
  /**
   * THE PREMISE. R2.35 measured this field absent, and `primary[1]` judged as a bare label.
   * It is always sent, and its `segmentRef` is stable so evidence can never be attributed to it by
   * accident: an opening excerpt is context, never proof of what a surface does.
   */
  opening: string;
  openingSegmentRef: string;
  /** Each boundary decomposed, so "the prerequisite" is a named clause rather than a whole sentence. */
  constraints: Array<{
    id: string;
    statement: string;
    ruleKind: string;
    prerequisite: string;
    governedAction: string;
    temporalRequirement: string;
  }>;
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
    /** The refs this surface may cite, so the model never has to guess a segment identifier. */
    citableSegmentRefs: string[];
  }>;
  /**
   * The un-merged context, labelled and separately addressable. The R2.34 leak — a branch action
   * rejected on its PARENT's "delays in the ward" — was invisible because own text, inherited state
   * and branch context arrived as one blob. This is that blob taken apart.
   */
  contextSegments: Array<{ segmentRef: string; segmentKind: string; surfaceRef: string; text: string }>;
  /** Count of unreachable duplicates excluded from the matrix. Never assessable. */
  excludedCompatibilitySurfaceCount: number;
  authority: {
    scenarioSha256: string;
    reviewSubjectSha256: string;
    boundaryProvenanceSha256: string;
    surfaceMapSha256: string;
    lineageSha256: string;
    contextSegmentMapSha256: string;
    semanticFramesSha256: string;
    boundaryReviewSubjectSha256: string;
  };
};

/** Build the exact user payload. Deterministic: same subject in, byte-identical request out. */
export function buildNarrowBoundaryRequest(subject: NarrowBoundarySubject): NarrowBoundaryRequest {
  const count = subject.boundaries.length;
  const surfaceCount = subject.surfaces.length;
  const frameOf = new Map(subject.semanticFrames.map((f) => [f.boundaryId, f]));
  return {
    opening: subject.opening,
    openingSegmentRef: OPENING_SEGMENT_REF,
    constraints: subject.boundaries.map((b) => {
      const f = frameOf.get(b.id);
      return {
        id: b.id,
        statement: b.statement,
        ruleKind: f?.ruleKind ?? "uncertain",
        prerequisite: f?.prerequisiteClause ?? "",
        governedAction: f?.governedActionClause ?? "",
        temporalRequirement: f?.temporalRequirement ?? "uncertain",
      };
    }),
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
      citableSegmentRefs: segmentsForSurface(subject.contextSegments, s.coordinate).map((x) => x.segmentRef),
    })),
    contextSegments: subject.contextSegments.map((x) => ({
      segmentRef: x.segmentRef,
      segmentKind: x.segmentKind,
      surfaceRef: x.sourceSurfaceRef,
      text: x.text,
    })),
    excludedCompatibilitySurfaceCount: subject.compatibilitySurfaces.length,
    authority: {
      scenarioSha256: subject.scenarioSha256,
      reviewSubjectSha256: subject.reviewSubjectSha256,
      boundaryProvenanceSha256: subject.boundaryProvenanceSha256,
      surfaceMapSha256: subject.surfaceMapSha256,
      lineageSha256: subject.lineageSha256,
      contextSegmentMapSha256: subject.contextSegmentMapSha256,
      semanticFramesSha256: subject.semanticFramesSha256,
      boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
    },
  };
}
