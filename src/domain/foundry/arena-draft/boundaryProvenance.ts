/**
 * CONFIRMED-BOUNDARY REVIEW PROVENANCE (Slice 3.2I-R5B1A.1-R2.27).
 *
 * THE MEASURED DEFECT
 *
 * R2.26 proved that the historical c18 reviewer replay was handed `confirmedBoundaries: []` and
 * `activeBoundaryIds: []`. The reviewer's own `boundaryIdsConsidered: []` and `boundaryAssessments:
 * []` confirm it. With an empty constraint set every boundary derivation in `semanticReview` is
 * inert BY DESIGN — the count check passes 0===0, the coverage loop never runs, and
 * `boundary_violation` is guarded by `constraintIds.length > 0`. So the reviewer accepted a scenario
 * that violates a confirmed two-identifier rule, and that accept proves nothing about the reviewer:
 * the question was never put to it.
 *
 * The root cause is not the replay harness. It is that an empty array meant TWO different things:
 *
 *     "no boundaries apply here"        (c01 — legitimate)
 *     "boundary data was lost"          (c18 replay — a defect)
 *
 * Nothing downstream could tell them apart, so the second silently borrowed the safety of the first.
 *
 * THIS MODULE
 *
 * One canonical record that travels from canonical input to review, evidence, artifact, fixture and
 * replay. `boundaryMode` states which of the two situations holds; `sourceKind` and `sourceSha256`
 * say where the answer came from; absence of the record is `null`, which is neither and fails
 * closed.
 *
 * Pure: no I/O, no clock.
 */

import { createHash } from "node:crypto";

export const BOUNDARY_NORMALIZATION_VERSION = "practice-boundary-provenance/1";

/**
 * `none` — the canonical input PROVES no confirmed rule applies. Review may proceed.
 * `bearing` — at least one confirmed rule applies. Review may proceed only with the full set.
 *
 * There is deliberately no third value for "unknown": an unknown state is represented by the
 * absence of the whole record, so it cannot be mistaken for a decision.
 */
export type BoundaryMode = "none" | "bearing";

export type BoundarySourceKind =
  /** The corpus / Host setup input that defines the case. */
  | "canonical_case_input"
  /** The Host's active-boundary selection for this situation. */
  | "host_confirmed_scope"
  /** Rebuilt from stored evidence AFTER the fact. Never evidence of what a past reviewer received. */
  | "historical_reconstruction";

export type ProvenanceBoundary = {
  id: string;
  /** Normalized exactly once, at capture. Never re-normalized downstream. */
  statement: string;
  provenance: string;
  /** Position in the canonical confirmed set. Ordering is part of the identity. */
  order: number;
  active: boolean;
};

export type ReconstructionSource = {
  path: string;
  sha256: string;
  /** Where inside that file the boundary was found — e.g. "attempts[1].correctionPacket". */
  evidenceLocation: string;
  /** Digest over the normalized {id, statement} this source yielded. */
  normalizedBoundaryDigest: string;
};

export type BoundaryReviewProvenance = {
  normalizationVersion: string;
  boundaryMode: BoundaryMode;
  sourceKind: BoundarySourceKind;
  /** Human-traceable pointer: corpus case id, scope key, or artifact path. */
  sourceReference: string;
  sourceSha256: string;
  /** Every confirmed rule available when the scope was decided, in original order. */
  availableBoundaries: ProvenanceBoundary[];
  /** The Manager-confirmed set. `available ⊇ confirmed ⊇ active` holds by construction. */
  confirmedBoundaries: ProvenanceBoundary[];
  activeBoundaryIds: string[];
  boundaryScopeConfirmed: boolean;
  /** True only for `historical_reconstruction`, and then it must be true. */
  reconstructed: boolean;
  reconstructionSources: ReconstructionSource[];
};

/** Collapse internal whitespace and trim. Versioned, so a change to this is a contract change. */
export const normalizeBoundaryText = (s: string): string => s.replace(/\s+/g, " ").trim();

const canonical = (v: unknown): string => {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") {
      return Object.fromEntries(
        Object.entries(x as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, walk(v)]),
      );
    }
    return x;
  };
  return JSON.stringify(walk(v));
};

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/**
 * The digest that binds boundary identity to a review.
 *
 * Covers only what can change which rules the reviewer is judging against — ordering included,
 * because a reordered set is a different presentation of the same question and must be provable.
 * `reconstructionSources` are excluded: they explain where the answer came from, not what it is.
 */
export function boundaryProvenanceSha256(p: BoundaryReviewProvenance): string {
  return sha256(
    canonical({
      normalizationVersion: p.normalizationVersion,
      boundaryMode: p.boundaryMode,
      sourceKind: p.sourceKind,
      sourceSha256: p.sourceSha256,
      confirmedBoundaries: p.confirmedBoundaries.map((b) => ({ id: b.id, statement: b.statement, order: b.order, active: b.active })),
      activeBoundaryIds: [...p.activeBoundaryIds].sort(),
      boundaryScopeConfirmed: p.boundaryScopeConfirmed,
      reconstructed: p.reconstructed,
    }),
  );
}

// ---------------------------------------------------------------------------
// Fail-closed authority
// ---------------------------------------------------------------------------

export const BOUNDARY_AUTHORITY_CODES = [
  "review_boundary_provenance_missing",
  "review_boundary_data_missing",
  "review_active_boundary_missing",
  "review_unknown_active_boundary",
  "review_boundary_scope_unconfirmed",
  "review_boundary_provenance_mismatch",
  "review_boundary_subject_drift",
  "review_boundary_reconstruction_unlabelled",
  "review_boundary_normalization_drift",
] as const;

export type BoundaryAuthorityCode = (typeof BOUNDARY_AUTHORITY_CODES)[number];

export type BoundaryAuthorityResult = { ok: true } | { ok: false; codes: BoundaryAuthorityCode[] };

/**
 * May this subject be sent to the semantic reviewer?
 *
 * Total and fail-closed. Every refusal happens BEFORE the reviewer request is constructed, so a
 * boundary failure can never be mistaken for a model failure and never spends a provider call.
 *
 * `expectedProvenanceSha256`, when supplied, is the digest recorded at capture time — passing it
 * proves the record has not been edited between capture and review.
 */
export function assertReviewBoundaryAuthority(
  p: BoundaryReviewProvenance | null | undefined,
  expectedProvenanceSha256?: string,
): BoundaryAuthorityResult {
  // Absence is NOT "no boundaries". It is "we do not know", and we never review on that.
  if (!p) return { ok: false, codes: ["review_boundary_provenance_missing"] };

  const codes: BoundaryAuthorityCode[] = [];
  if (p.normalizationVersion !== BOUNDARY_NORMALIZATION_VERSION) codes.push("review_boundary_normalization_drift");
  if (!p.sourceSha256 || !/^[0-9a-f]{64}$/.test(p.sourceSha256)) codes.push("review_boundary_provenance_missing");
  if (p.sourceKind === "historical_reconstruction" && (!p.reconstructed || p.reconstructionSources.length < 2)) {
    // A rebuilt subject must say so, and must name at least two agreeing sources.
    codes.push("review_boundary_reconstruction_unlabelled");
  }
  if (p.sourceKind !== "historical_reconstruction" && p.reconstructed) codes.push("review_boundary_reconstruction_unlabelled");

  if (p.boundaryMode === "bearing") {
    if (p.confirmedBoundaries.length === 0) codes.push("review_boundary_data_missing");
    if (p.activeBoundaryIds.length === 0) codes.push("review_active_boundary_missing");
    const confirmedIds = new Set(p.confirmedBoundaries.map((b) => b.id));
    for (const id of p.activeBoundaryIds) if (!confirmedIds.has(id)) codes.push("review_unknown_active_boundary");
    // Every active rule must carry text the reviewer can actually judge against.
    for (const b of p.confirmedBoundaries) {
      if (b.active && normalizeBoundaryText(b.statement).length === 0) codes.push("review_boundary_data_missing");
    }
    // The `active` flags and the id list are two representations of one fact; they must agree.
    const flagged = p.confirmedBoundaries.filter((b) => b.active).map((b) => b.id).sort();
    if (canonical(flagged) !== canonical([...p.activeBoundaryIds].sort())) codes.push("review_boundary_subject_drift");
    // A NARROWED set — fewer active than confirmed — is a Host decision. Without confirmation it is
    // an unexplained omission, which is exactly how a rule could vanish without anyone deciding it.
    if (p.activeBoundaryIds.length < p.confirmedBoundaries.length && !p.boundaryScopeConfirmed) {
      codes.push("review_boundary_scope_unconfirmed");
    }
  } else {
    // `none` must be an assertion about the canonical input, never a leftover of a lost lookup.
    if (p.confirmedBoundaries.length > 0 || p.activeBoundaryIds.length > 0) codes.push("review_boundary_subject_drift");
    if (p.sourceKind === "host_confirmed_scope") codes.push("review_boundary_provenance_mismatch");
  }

  if (expectedProvenanceSha256 && boundaryProvenanceSha256(p) !== expectedProvenanceSha256) {
    codes.push("review_boundary_provenance_mismatch");
  }

  return codes.length ? { ok: false, codes: [...new Set(codes)] } : { ok: true };
}

/** Drift between the record captured at generation and the one presented at rerun. */
export function detectBoundaryProvenanceDrift(frozen: BoundaryReviewProvenance, current: BoundaryReviewProvenance): BoundaryAuthorityCode[] {
  return boundaryProvenanceSha256(frozen) === boundaryProvenanceSha256(current) ? [] : ["review_boundary_subject_drift"];
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * Build the record from a resolved generation authority.
 *
 * `available` is every confirmed rule; `active` is the subset actually in play. When `available` is
 * empty the mode is `none` — and that is an assertion the caller must be entitled to make, which is
 * why `sourceKind` and `sourceSha256` are required arguments rather than defaults.
 */
export function buildBoundaryProvenance(args: {
  available: Array<{ id: string; statement: string; provenance: string }>;
  activeIds: string[];
  scopeConfirmed: boolean;
  sourceKind: BoundarySourceKind;
  sourceReference: string;
  sourceSha256: string;
  reconstructionSources?: ReconstructionSource[];
  /**
   * Force `bearing` even when the set is empty.
   *
   * A `judgment_with_constraints` boundary asserts that confirmed rules DO constrain this practice.
   * If its constraint list is empty the two statements contradict each other, and inferring `none`
   * from the empty array is precisely the substitution that let the c18 replay proceed. The caller
   * declares the mode; the array never gets to decide it.
   */
  declaredBearing?: boolean;
}): BoundaryReviewProvenance {
  const activeSet = new Set(args.activeIds);
  const boundaries: ProvenanceBoundary[] = args.available.map((c, i) => ({
    id: c.id,
    statement: normalizeBoundaryText(c.statement),
    provenance: c.provenance,
    order: i,
    active: activeSet.has(c.id),
  }));
  return {
    normalizationVersion: BOUNDARY_NORMALIZATION_VERSION,
    boundaryMode: args.declaredBearing || boundaries.length > 0 ? "bearing" : "none",
    sourceKind: args.sourceKind,
    sourceReference: args.sourceReference,
    sourceSha256: args.sourceSha256,
    availableBoundaries: boundaries,
    confirmedBoundaries: boundaries,
    activeBoundaryIds: boundaries.filter((b) => b.active).map((b) => b.id),
    boundaryScopeConfirmed: args.scopeConfirmed,
    reconstructed: args.sourceKind === "historical_reconstruction",
    reconstructionSources: args.reconstructionSources ?? [],
  };
}

/** The explicit "no confirmed rule applies" record. c01 is this; a lost lookup is not. */
export const noBoundaryProvenance = (sourceReference: string, sourceSha256: string): BoundaryReviewProvenance =>
  buildBoundaryProvenance({ available: [], activeIds: [], scopeConfirmed: true, sourceKind: "canonical_case_input", sourceReference, sourceSha256 });

// ---------------------------------------------------------------------------
// Reviewer coverage
// ---------------------------------------------------------------------------

export const BOUNDARY_COVERAGE_CODES = [
  "boundary_assessment_omitted",
  "boundary_assessment_unknown",
  "boundary_assessment_duplicated",
  "boundary_ids_considered_mismatch",
] as const;

export type BoundaryCoverageCode = (typeof BOUNDARY_COVERAGE_CODES)[number];

/**
 * Did the reviewer answer about EXACTLY the active set?
 *
 * Checks coverage only. Whether its judgment is correct is a separate question this slice
 * deliberately does not touch — the point here is that the question reached it and was answered.
 */
export function checkBoundaryCoverage(
  activeIds: string[],
  boundaryIdsConsidered: string[],
  assessmentIds: string[],
): { ok: true } | { ok: false; codes: BoundaryCoverageCode[] } {
  const codes: BoundaryCoverageCode[] = [];
  const active = new Set(activeIds);
  const seen = new Set<string>();
  for (const id of assessmentIds) {
    if (!active.has(id)) codes.push("boundary_assessment_unknown");
    if (seen.has(id)) codes.push("boundary_assessment_duplicated");
    seen.add(id);
  }
  for (const id of activeIds) if (!seen.has(id)) codes.push("boundary_assessment_omitted");
  if (canonical([...boundaryIdsConsidered].sort()) !== canonical([...activeIds].sort())) {
    codes.push("boundary_ids_considered_mismatch");
  }
  return codes.length ? { ok: false, codes: [...new Set(codes)] } : { ok: true };
}
