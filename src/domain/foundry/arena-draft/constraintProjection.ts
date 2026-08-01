/**
 * REVIEW-DERIVED CONSTRAINT EVIDENCE (Slice 3.2I-R5B1A.1-R2.23C).
 *
 * WHAT CHANGED AND WHY
 *
 * Until now every generated choice carried a `constraintAssessments` array authored by the
 * generator: one entry per confirmed rule, each saying `status: "satisfied"`. Its enum contained
 * exactly one value, so a violation was literally unrepresentable. It was the generator certifying
 * its own compliance — an assertion, not evidence — and it cost visible-choices x boundaries on
 * every request.
 *
 * Two INDEPENDENT layers already prove everything it asserted:
 *
 *   boundary grounding      — the rule is present in the scenario and actually operative: which
 *                             decision stages it constrains, which tempting option it excludes,
 *                             what judgment survives inside it.
 *   semantic review         — per active boundary, across every phase: presence, operationalization,
 *                             primary / tradeoff / action compliance, branch preservation, and the
 *                             exact coordinates of any violation.
 *
 * Neither depends on the generator's word. So the attestation is removed from the provider contract,
 * and the same-shaped evidence is MATERIALIZED HERE — by the server, from canonical choice ids, the
 * active boundary ids, and an ACCEPTED review.
 *
 * The order matters and is enforced by the caller: nothing is projected until the review has
 * accepted. A rejected scenario produces no evidence of compliance, because it has none.
 *
 * Pure domain: no I/O, no provider, no DB.
 */

import type { BoundaryConstraint, ConstraintAssessment } from "./boundary";
import type { ArenaScenarioDraft } from "./types";
import { enumerateChoices } from "./choiceConstruction";

/** Everything the projection is allowed to read from an accepted review. */
export type AcceptedBoundaryEvidence = {
  boundaryId: string;
  presentInScenario: boolean;
  operationalized: boolean;
  allPrimaryChoicesComply: boolean;
  allTradeoffChoicesComply: boolean;
  allActionChoicesComply: boolean;
  allBranchesPreserve: boolean;
  violatedChoiceReferences: string[];
  violatedBranchReferences: string[];
  /** The reviewer's short supporting note. Evidence, never the authority. */
  conciseExplanation: string;
};

export type ProjectionResult =
  | { ok: true; assessmentsByChoiceId: Record<string, ConstraintAssessment[]> }
  | { ok: false; errors: string[] };

/** Deterministic, reviewer-derived rationale. No generator text ever reaches it. */
function rationaleFor(boundary: BoundaryConstraint, evidence: AcceptedBoundaryEvidence): string {
  const note = evidence.conciseExplanation.trim();
  const base = `independent review confirmed compliance with [${boundary.id}] at every phase`;
  return note ? `${base}: ${note}` : base;
}

/**
 * Materialize per-choice constraint evidence from an ACCEPTED review.
 *
 * Refuses when the review does not actually establish compliance — a projection built over a
 * review that reported a violation, an absent rule or an unassessed boundary would manufacture the
 * exact false assurance this slice removed.
 */
export function projectConstraintAssessments(
  draft: ArenaScenarioDraft,
  activeBoundaries: BoundaryConstraint[],
  evidence: AcceptedBoundaryEvidence[],
  accepted: boolean,
): ProjectionResult {
  const errors: string[] = [];
  // Nothing to project, and nothing to prove.
  if (activeBoundaries.length === 0) return { ok: true, assessmentsByChoiceId: {} };

  // 1. ONLY after acceptance. This is the whole ordering guarantee.
  if (!accepted) return { ok: false, errors: ["projection_before_acceptance"] };

  const byId = new Map(evidence.map((e) => [e.boundaryId, e]));
  const seen = new Set<string>();
  for (const e of evidence) {
    if (!activeBoundaries.some((b) => b.id === e.boundaryId)) errors.push("projection_unknown_boundary");
    if (seen.has(e.boundaryId)) errors.push("projection_duplicate_boundary");
    seen.add(e.boundaryId);
  }

  // 2. Every ACTIVE boundary must have been independently assessed, and must have passed.
  for (const b of activeBoundaries) {
    const e = byId.get(b.id);
    if (!e) {
      errors.push("projection_missing_boundary");
      continue;
    }
    if (!e.presentInScenario || !e.operationalized) errors.push("projection_boundary_not_established");
    if (!e.allPrimaryChoicesComply || !e.allTradeoffChoicesComply || !e.allActionChoicesComply || !e.allBranchesPreserve) {
      errors.push("projection_boundary_not_compliant");
    }
    if (e.violatedChoiceReferences.length > 0 || e.violatedBranchReferences.length > 0) errors.push("projection_boundary_violated");
  }

  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  // 3. Complete coverage: every canonical choice x every active boundary, in canonical order.
  const assessmentsByChoiceId: Record<string, ConstraintAssessment[]> = {};
  for (const choice of enumerateChoices(draft)) {
    assessmentsByChoiceId[choice.id] = activeBoundaries.map((b) => ({
      constraintId: b.id,
      status: "satisfied" as const,
      rationale: rationaleFor(b, byId.get(b.id)!),
    }));
  }
  return { ok: true, assessmentsByChoiceId };
}
