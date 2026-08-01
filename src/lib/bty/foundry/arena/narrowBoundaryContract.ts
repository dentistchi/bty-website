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
  NARROW_REASON_MAX,
  REMOVED_MODEL_AUTHORED_FIELDS,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
// R2.38 — the reviewer selects SERVER-ISSUED candidate ids. It authors no excerpt, no segment ref
// and no segment kind, so the R2.37 duplicate-alias failure is not merely refused: it is not
// offered. And ONE canonical table decides what every fact combination means.
import {
  EVIDENCE_CANDIDATE_VERSION,
  buildAllEvidenceCandidates,
  candidateContractSha256,
  evidenceCandidateMapSha256,
  poolFor,
  type BoundaryEvidenceCandidate,
} from "@/domain/foundry/arena-draft/boundaryEvidenceCandidates";
import { candidateRoleContractSha256, type RoleDecisionLog, type RoleDecisionMetrics } from "@/domain/foundry/arena-draft/boundaryCandidateRole";
import {
  TRUTH_STATE_TABLE_VERSION,
  renderTruthStateRules,
  truthStateTableSha256,
} from "@/domain/foundry/arena-draft/boundaryTruthStates";
import { NO_CANDIDATE } from "@/domain/foundry/arena-draft/boundaryTruthContractTypes";
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
import { parityTableSha256 } from "@/domain/foundry/arena-draft/boundaryReasonParity";

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
 * THREE FACTS AND THREE CHOICES — R2.38.
 *
 * R2.36 asked four questions and then asked the model to draw conclusions from its own answers.
 * R2.37 measured what that cost: all 24 live rows said `applies`, twelve of them alongside
 * `governedActionStatus: absent`, and both complete responses were discarded — including one that
 * was semantically correct.
 *
 * This prompt asks for facts and offers a menu. Every conclusion — applicability, compliance, the
 * mechanism, the verdict — is the server's, and every excerpt is the server's. The reviewer cannot
 * disagree with a conclusion it is not asked to draw, and cannot cite text it is not offered.
 *
 * The state rules below are GENERATED from the canonical truth-state table, so the prompt cannot
 * describe a state the validator does not accept. That drift discarded a complete live response in
 * R2.36, where the prompt still named two evidence fields the schema had already removed.
 */
export const NARROW_BOUNDARY_SYSTEM_PROMPT: string = [
  "You are a CONFIRMED-BOUNDARY TRUTH REPORTER for a leadership decision-practice scenario. You report facts. You do not draw conclusions.",
  "",
  "THE JOB. You are given CONFIRMED BOUNDARIES — non-negotiable rules, each already decomposed into the PREREQUISITE it requires and the ACTION it governs — and the DECISION SURFACES a learner actually reaches. For EVERY boundary paired with EVERY surface, report three facts and select your evidence from the candidates provided.",
  "",
  "YOU DO NOT DECIDE WHETHER A SURFACE COMPLIES. There is no applicability field, no compliance field, no violation-mechanism field and no overall verdict. Those are computed from your three facts. Report what is true and stop.",
  "",
  "FACT 1 — governedActionStatus. Is the action the boundary governs present in THIS SURFACE'S OWN TEXT?",
  "  present   — this surface's own text performs, commits to, authorizes or asserts the governed action.",
  "  absent    — it does not. It does something else: staffing, notification, documentation, reporting, escalation, sequencing, communication. Surrounding context may describe the governed action; that is not this surface doing it.",
  "  uncertain — the text is genuinely insufficient to tell.",
  "",
  "FACT 2 — prerequisiteStatus. What is the state of the prerequisite the boundary requires?",
  "  satisfied          — the text says the prerequisite HAS been met.",
  "  explicitly_missing — the text says it has NOT been met, was skipped, bypassed or left undone.",
  "  contradicted       — the text asserts something incompatible with the prerequisite holding.",
  "  not_established    — nothing says either way. THIS IS NOT A VIOLATION. Silence is not failure.",
  "  uncertain          — you cannot tell.",
  "  not_applicable     — the boundary has no prerequisite, or the governed action is absent.",
  "",
  "FACT 3 — temporalRelation. How does the governed action stand in time against the prerequisite?",
  "  prerequisite_before_action  — the prerequisite is met first. This is the rule being KEPT.",
  "  action_before_prerequisite  — the governed action happens while the prerequisite is still unmet.",
  "  simultaneous_or_unclear     — committed together, or the ordering cannot be settled.",
  "  unrelated / not_applicable  — no ordering question arises.",
  "",
  "EVIDENCE IS A MENU, NOT A QUOTE. Each surface comes with candidate lists, one per role:",
  "  governedActionCandidates            — spans of THIS surface's own text.",
  "  prerequisiteSatisfactionCandidates  — spans that could show the prerequisite HAS been met.",
  "  prerequisiteFailureCandidates       — spans that could show it has NOT been met.",
  "Select a candidateId. NEVER write an excerpt, a segment reference or a source name — there are no fields for them.",
  "",
  "CANDIDATE RULES.",
  "  A candidate list belongs to ONE surface. Never use an id from another surface's list, even if its text looks identical — identical text at a different place in the path means something different, and the id you need is already in your own list.",
  `  Use the exact value \`${NO_CANDIDATE}\` when a role needs no evidence. Never use an empty string.`,
  "  If no candidate in a list fits, that is itself a fact: it usually means the prerequisite is `not_established` and there is nothing to select.",
  "  A candidate list may be EMPTY. That is normal and it is informative: when the governedActionCandidates list is empty, this surface performs nothing the rule governs. Answer governedActionStatus=absent and use the sentinel. Use `uncertain` only when the text is genuinely ambiguous — never to avoid an empty list.",
  "",
  "EVERY VALID ANSWER IS ONE OF THESE STATES. Fill exactly the fields the state calls for:",
  ...renderTruthStateRules(),
  "",
  "REASON. Leave `reason` as an EMPTY STRING for every state above that does not ask for it — those are fully described by the facts and the server writes the human-readable explanation. Where a state DOES ask for it, name the exact ambiguity in your own words; do not restate the rule and do not write a generic phrase.",
  "",
  "SURFACES ARE OF TWO KINDS.",
  "  kind=choice — an option the learner can pick. Report what choosing it commits the learner to.",
  "  kind=resulting_world_state — a state the scenario ASSERTS has already happened after a primary choice. Report the state itself: if it says the governed action occurred while the prerequisite was unmet, that is `present` + `explicitly_missing` even though the learner picks nothing there.",
  "",
  "COVERAGE. Return exactly one assessment for every (boundary, surface) pair — `activeBoundaryCount` x `decisionSurfaceCount` assessments. Never fewer, never more, never a duplicate. Copy `surfaceRef` and `boundaryId` VERBATIM.",
  "",
  "A CONFIRMED RULE NARROWS THE CHOICE SPACE; IT DOES NOT ELIMINATE JUDGMENT. A surface that takes time, escalates, seeks supervision, sequences work or communicates while KEEPING the rule is not breaking it — time cost alone is never a prerequisite failure.",
  "",
  "Return ONLY the JSON object required by the schema.",
].join("\n");

/**
 * Every field-like token the prompt mentions. The source gate in `promptFieldParity` proves each one
 * exists in the active schema or in the explicitly allowed explanatory vocabulary — the check that
 * would have caught R2.36 shipping a prompt naming two deleted fields.
 */
export const PROMPT_EXPLANATORY_VOCABULARY = [
  "governedActionCandidates",
  "prerequisiteSatisfactionCandidates",
  "prerequisiteFailureCandidates",
  "activeBoundaryCount",
  "decisionSurfaceCount",
  "candidateId",
] as const;

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
    // R2.38 — the candidate authority and the truth-state table each change the QUESTION, so both
    // belong to the contract identity.
    evidenceCandidateVersion: d(EVIDENCE_CANDIDATE_VERSION),
    evidenceCandidateContract: candidateContractSha256(),
    truthStateTableVersion: d(TRUTH_STATE_TABLE_VERSION),
    truthStateTable: truthStateTableSha256(),
    // R2.40 — governed-action eligibility is boundary-relative. Changing how a role is decided
    // changes which evidence the reviewer is offered, so it changes the QUESTION.
    candidateRoleContract: candidateRoleContractSha256(),
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
  /**
   * Every evidence span the reviewer may select, scoped to one surface and one semantic role.
   * The reviewer receives ids; the server owns the text, the provenance and the digest.
   */
  evidenceCandidates: BoundaryEvidenceCandidate[];
  evidenceCandidateMapSha256: string;
  /** Measured collapse of the R2.37 duplicate exposure. Reported, never assumed. */
  candidateAliasRemovedCount: number;
  candidateProvenanceRetainedCount: number;
  /**
   * R2.40 — every governed-action role decision, kept as EVIDENCE. A refused span is why a pool is
   * empty; it is never a semantic finding and never reaches a product user.
   */
  candidateRoleDecisions: RoleDecisionLog[];
  candidateRoleMetrics: RoleDecisionMetrics;
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
    // R2.38 — the exact menu the reviewer was offered is part of the question it was asked.
    evidenceCandidateMapSha256: s.evidenceCandidateMapSha256,
    truthStateTableSha256: truthStateTableSha256(),
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
  const candidateBuild = buildAllEvidenceCandidates(args.boundaries, semanticFrames, reviewable, contextSegments);
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
    evidenceCandidates: candidateBuild.candidates,
    evidenceCandidateMapSha256: evidenceCandidateMapSha256(candidateBuild.candidates),
    candidateAliasRemovedCount: candidateBuild.aliasRemovedCount,
    candidateProvenanceRetainedCount: candidateBuild.provenanceRetainedCount,
    candidateRoleDecisions: candidateBuild.roleDecisions,
    candidateRoleMetrics: candidateBuild.roleMetrics,
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
  }>;
  /**
   * The ONLY evidence the reviewer may select, per boundary, per surface, per role. R2.37 measured
   * the alternative: 41 global refs carrying 15 distinct texts, and a correct answer discarded for
   * choosing the byte-identical alias that belonged to another surface.
   *
   * Eligibility depends on the BOUNDARY (a failure span must concern that rule's prerequisite), so
   * the menus hang off the constraint rather than off the surface.
   */
  evidenceCandidates: Array<{
    boundaryId: string;
    surfaces: Array<{
      surfaceRef: string;
      governedActionCandidates: Array<{ candidateId: string; excerpt: string }>;
      prerequisiteSatisfactionCandidates: Array<{ candidateId: string; excerpt: string }>;
      prerequisiteFailureCandidates: Array<{ candidateId: string; excerpt: string }>;
    }>;
  }>;
  /** The sentinel that means "no evidence for this role". Never an empty string. */
  noCandidateSentinel: string;
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
    evidenceCandidateMapSha256: string;
    truthStateTableSha256: string;
    boundaryReviewSubjectSha256: string;
  };
};

/** One surface's menu for one role. Ids and text only — provenance stays server-side. */
const menu = (
  subject: NarrowBoundarySubject,
  boundaryId: string,
  surfaceRef: string,
  role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure",
) => poolFor(subject.evidenceCandidates, boundaryId, surfaceRef, role).map((c) => ({ candidateId: c.candidateId, excerpt: c.excerpt }));

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
    })),
    evidenceCandidates: subject.boundaries.map((b) => ({
      boundaryId: b.id,
      surfaces: subject.surfaces.map((s) => ({
        surfaceRef: s.coordinate,
        governedActionCandidates: menu(subject, b.id, s.coordinate, "governed_action"),
        prerequisiteSatisfactionCandidates: menu(subject, b.id, s.coordinate, "prerequisite_satisfaction"),
        prerequisiteFailureCandidates: menu(subject, b.id, s.coordinate, "prerequisite_failure"),
      })),
    })),
    noCandidateSentinel: NO_CANDIDATE,
    excludedCompatibilitySurfaceCount: subject.compatibilitySurfaces.length,
    authority: {
      scenarioSha256: subject.scenarioSha256,
      reviewSubjectSha256: subject.reviewSubjectSha256,
      boundaryProvenanceSha256: subject.boundaryProvenanceSha256,
      surfaceMapSha256: subject.surfaceMapSha256,
      lineageSha256: subject.lineageSha256,
      contextSegmentMapSha256: subject.contextSegmentMapSha256,
      semanticFramesSha256: subject.semanticFramesSha256,
      evidenceCandidateMapSha256: subject.evidenceCandidateMapSha256,
      truthStateTableSha256: truthStateTableSha256(),
      boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
    },
  };
}
