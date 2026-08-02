/**
 * CANONICAL DEPENDENCY-GROUP SHAPE AUTHORITY (Slice 3.2I-R5B1A.1-R2.54).
 *
 * WHAT R2.53 MEASURED
 *
 * The R2.52 live patch sent thirteen operations. Every scalar was in its field's
 * `allowedValues`, the dependency group was complete, nothing was duplicated or
 * untargeted — and the merged matrix was still refused, on one row, with
 * `boundary_reason_required_missing`.
 *
 * The tuple it chose was CANONICALLY VALID:
 *
 *     present / not_established / not_applicable / none / none
 *       -> governed_action_prerequisite_not_established
 *
 * but that state's `reasonAuthority` is `model_required`, and `reason` was
 * frozen at `""` from attempt 1 — correctly so there, where the state was
 * `governed_action_prerequisite_missing` and the authority was `server_derived`.
 * The patch moved the row into a state that demands prose, through a plan that
 * could never have asked for it: `reason` was not a repairable field at all.
 *
 * A second defect was measured but did not fire. The group's per-field domains
 * are a Cartesian product of 6 x 5 x 5 x 1 = 150 combinations, of which only a
 * small canonical subset forms a valid state. The model happened to pick one of
 * the valid ones; nothing in the contract required it to.
 *
 * WHAT THIS MODULE DOES
 *
 * It replaces "each scalar is in its own list" with "the whole group matches one
 * CANONICAL ALTERNATIVE". An alternative is a complete row shape derived from
 * the truth-state table, carrying its own temporal domain, candidate
 * requirements, surface-local candidate domains and reason authority.
 *
 * DERIVED, NEVER ENUMERATED. Every alternative is round-tripped through
 * `classifyTruthState` before it is offered, so the generator and the validator
 * cannot drift into two authorities — the drift R2.48 measured when a
 * hand-written copy of the same requirements had already gone stale.
 *
 * GROUNDABILITY. A state is offered only if the surface's own pools can support
 * it: a state requiring failure evidence is not offered where the failure pool
 * is empty, and a `model_required` state is not offered unless `reason` is in
 * the group. Offering a shape the model cannot legally complete is exactly the
 * trap that produced the R2.53 failure.
 *
 * THE SERVER MAY VALIDATE, NEVER CHOOSE. Nothing here selects an alternative,
 * normalizes a near-miss to the closest one, or writes prose into `reason`.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto"
import { TRUTH_STATES, classifyTruthState, type TruthStateRule } from "./boundaryTruthStates"
import { GENERIC_REASON_PHRASES, MODEL_REASON_MIN_CHARS, normalizeReason } from "./boundaryReasonParity"
import { NO_CANDIDATE } from "./boundaryTruthContractTypes"
import type { BoundaryEvidenceCandidate } from "./boundaryEvidenceCandidates"

export const GROUP_ALTERNATIVES_VERSION = "practice-boundary-group-alternatives/1"

/** How `reason` is governed for one alternative. Authority, never a value list. */
export const REASON_CONSTRAINTS = ["must_be_empty", "model_required"] as const
export type ReasonConstraint = (typeof REASON_CONSTRAINTS)[number]

export const GROUP_SHAPE_CODES = [
  "field_repair_group_shape_not_allowed",
  "field_repair_group_reason_required_missing",
  "field_repair_group_reason_forbidden_present",
  "field_repair_group_reason_invalid",
] as const
export type GroupShapeCode = (typeof GROUP_SHAPE_CODES)[number]

/** A complete, legal shape for one dependency group on one surface. */
export interface CanonicalGroupAlternative {
  alternativeId: string
  stateId: string
  /** The one prerequisite status this alternative fixes. */
  prerequisiteStatus: string
  /** Every temporal relation the state permits. A domain, not a single value. */
  temporalDomain: string[]
  satisfactionCandidateRequirement: TruthStateRule["satisfactionCandidate"]
  /** Surface-local ids, plus the sentinel when the role is not required. */
  satisfactionCandidateDomain: string[]
  failureCandidateRequirement: TruthStateRule["failureCandidate"]
  failureCandidateDomain: string[]
  reasonAuthority: TruthStateRule["reasonAuthority"]
  reasonConstraint: ReasonConstraint
}

export interface GroupAlternativeInput {
  boundaryId: string
  surfaceRef: string
  /** FROZEN. The governed-action axis is outside the prerequisite closure. */
  governedActionStatus: string
  groupFields: string[]
  ruleKind: string
  candidates: readonly BoundaryEvidenceCandidate[]
}

const digest = (v: unknown): string =>
  createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex")

const poolFor = (
  candidates: readonly BoundaryEvidenceCandidate[],
  boundaryId: string,
  surfaceRef: string,
  role: string,
): string[] =>
  candidates
    .filter((c) => c.boundaryId === boundaryId && c.assessedSurfaceRef === surfaceRef && c.semanticRole === role)
    .map((c) => c.candidateId)

/**
 * The domain a candidate field may draw from under one requirement.
 *
 * `required` offers only real ids — the sentinel is not an answer. `forbidden`
 * offers only the sentinel. `optional` offers both, which is the one case where
 * a model genuinely has a choice to make.
 */
function domainFor(requirement: TruthStateRule["satisfactionCandidate"], pool: string[]): string[] {
  if (requirement === "required") return [...pool]
  if (requirement === "forbidden") return [NO_CANDIDATE]
  return [NO_CANDIDATE, ...pool]
}

/**
 * Generate every alternative this surface can actually support.
 *
 * A state is offered only when ALL of these hold:
 *   - it shares the frozen governed-action status;
 *   - the (status, temporal) pair round-trips through `classifyTruthState`
 *     under this boundary's rule kind, so a prohibition-only state is never
 *     offered for a prerequisite rule;
 *   - every candidate role it REQUIRES has a non-empty surface-local pool;
 *   - if it is `model_required`, `reason` is in the group.
 */
export function deriveGroupAlternatives(input: GroupAlternativeInput): CanonicalGroupAlternative[] {
  const { boundaryId, surfaceRef, governedActionStatus, groupFields, ruleKind, candidates } = input
  const reasonInGroup = groupFields.includes("reason")
  const satPool = poolFor(candidates, boundaryId, surfaceRef, "prerequisite_satisfaction")
  const failPool = poolFor(candidates, boundaryId, surfaceRef, "prerequisite_failure")

  const out: CanonicalGroupAlternative[] = []

  for (const state of TRUTH_STATES) {
    if (state.governedActionStatus !== governedActionStatus) continue

    // A state that REQUIRES evidence the server never offered cannot be
    // answered here. This is R2.48's empty-pool authority, applied before the
    // model is asked rather than after it answers.
    if (state.satisfactionCandidate === "required" && satPool.length === 0) continue
    if (state.failureCandidate === "required" && failPool.length === 0) continue

    // A state whose reason the MODEL must write is unavailable unless `reason`
    // is part of this group. Offering it otherwise is offering a shape that
    // cannot be legally completed — the exact R2.53 trap.
    if (state.reasonAuthority === "model_required" && !reasonInGroup) continue

    for (const prerequisiteStatus of state.prerequisiteStatus) {
      // DERIVED, NOT ASSERTED: keep only the temporal values that actually
      // classify back to THIS state under THIS rule kind.
      const temporalDomain = state.temporalRelation.filter((temporalRelation) => {
        const resolved = classifyTruthState(
          { governedActionStatus, prerequisiteStatus, temporalRelation } as never,
          ruleKind,
        )
        return resolved !== null && resolved.id === state.id
      })
      if (temporalDomain.length === 0) continue

      out.push({
        alternativeId: digest([GROUP_ALTERNATIVES_VERSION, surfaceRef, state.id, prerequisiteStatus]).slice(0, 16),
        stateId: state.id,
        prerequisiteStatus,
        temporalDomain,
        satisfactionCandidateRequirement: state.satisfactionCandidate,
        satisfactionCandidateDomain: domainFor(state.satisfactionCandidate, satPool),
        failureCandidateRequirement: state.failureCandidate,
        failureCandidateDomain: domainFor(state.failureCandidate, failPool),
        reasonAuthority: state.reasonAuthority,
        reasonConstraint: state.reasonAuthority === "model_required" ? "model_required" : "must_be_empty",
      })
    }
  }
  return out
}

export const groupAlternativesSha256 = (alternatives: readonly CanonicalGroupAlternative[]): string =>
  digest({ version: GROUP_ALTERNATIVES_VERSION, alternatives })

/** What the model supplied for one complete group. */
export interface GroupSelection {
  prerequisiteStatus: string
  temporalRelation: string
  prerequisiteSatisfactionCandidateId: string
  prerequisiteFailureCandidateId: string
  /** Present when `reason` is in the group. */
  reason?: string
}

/**
 * Which authority governs `reason` for the alternative(s) a selection reached.
 *
 * `unknown` is reserved for a selection that matched no alternative's SHAPE at all, or reached
 * several that disagree: there is then no single authority to name, and naming one anyway would put
 * a guess into an artifact an auditor reads as measurement.
 */
export const REASON_AUTHORITY_MODES = ["server_derived", "model_required", "unknown"] as const
export type ReasonAuthorityMode = (typeof REASON_AUTHORITY_MODES)[number]

export type GroupMatch =
  | { ok: true; alternativeId: string; stateId: string; reasonAuthority: ReasonAuthorityMode }
  | { ok: false; code: GroupShapeCode; reasonAuthority: ReasonAuthorityMode }

/** Whether model prose satisfies the EXISTING reason contract. Unchanged rules. */
function modelReasonProblem(reason: string): GroupShapeCode | null {
  const trimmed = reason.trim()
  if (trimmed.length === 0) return "field_repair_group_reason_required_missing"
  if (trimmed.length < MODEL_REASON_MIN_CHARS) return "field_repair_group_reason_required_missing"
  if (GENERIC_REASON_PHRASES.includes(normalizeReason(trimmed) as (typeof GENERIC_REASON_PHRASES)[number])) {
    return "field_repair_group_reason_invalid"
  }
  return null
}

/**
 * Match a complete selection against the offered alternatives.
 *
 * Never chooses, never normalizes, never writes prose. A selection that matches
 * no alternative is refused with the shape code; a selection that matches a
 * state but breaks its reason authority is refused with the precise reason code,
 * so an auditor sees WHICH rule was broken rather than one opaque rejection.
 */
export function matchGroupAlternative(
  alternatives: readonly CanonicalGroupAlternative[],
  selection: GroupSelection,
): GroupMatch {
  // Candidate and temporal compatibility first: those identify the alternative.
  const shapeMatches = alternatives.filter(
    (alt) =>
      alt.prerequisiteStatus === selection.prerequisiteStatus &&
      alt.temporalDomain.includes(selection.temporalRelation) &&
      alt.satisfactionCandidateDomain.includes(selection.prerequisiteSatisfactionCandidateId) &&
      alt.failureCandidateDomain.includes(selection.prerequisiteFailureCandidateId),
  )
  if (shapeMatches.length === 0) return { ok: false, code: "field_repair_group_shape_not_allowed", reasonAuthority: "unknown" }

  const authority = reasonAuthorityOf(shapeMatches)

  // Among shape matches, the reason authority decides. Reported precisely.
  let lastReasonCode: GroupShapeCode | null = null
  for (const alt of shapeMatches) {
    const reason = selection.reason ?? ""
    if (alt.reasonConstraint === "must_be_empty") {
      if (reason.trim().length > 0) {
        lastReasonCode = "field_repair_group_reason_forbidden_present"
        continue
      }
      return { ok: true, alternativeId: alt.alternativeId, stateId: alt.stateId, reasonAuthority: alt.reasonAuthority }
    }
    const problem = modelReasonProblem(reason)
    if (problem !== null) {
      lastReasonCode = problem
      continue
    }
    return { ok: true, alternativeId: alt.alternativeId, stateId: alt.stateId, reasonAuthority: alt.reasonAuthority }
  }
  return { ok: false, code: lastReasonCode ?? "field_repair_group_shape_not_allowed", reasonAuthority: authority }
}

/** One authority, or `unknown`. Never a majority vote — a disagreement is not a measurement. */
export function reasonAuthorityOf(alternatives: readonly CanonicalGroupAlternative[]): ReasonAuthorityMode {
  const distinct = new Set(alternatives.map((a) => a.reasonAuthority))
  if (distinct.size !== 1) return "unknown"
  return [...distinct][0] === "model_required" ? "model_required" : "server_derived"
}

/** The contract digest — moves when generation, grounding or matching moves. */
export const groupAlternativeContractSha256 = (): string =>
  digest({
    version: GROUP_ALTERNATIVES_VERSION,
    reasonConstraints: REASON_CONSTRAINTS,
    reasonAuthorityModes: REASON_AUTHORITY_MODES,
    shapeCodes: GROUP_SHAPE_CODES,
    derivedFromTruthStateTable: true,
    roundTripValidatedThroughClassifier: true,
    excludesStatesRequiringAnEmptyPool: true,
    excludesModelRequiredStatesWhenReasonNotInGroup: true,
    scalarMembershipInsufficientForMultiFieldGroups: true,
    serverMayValidateNeverChoose: true,
    neverNormalizesToNearestAlternative: true,
    neverAuthorsModelReason: true,
    reasonContractUnchanged: { minChars: MODEL_REASON_MIN_CHARS, genericPhrasesRefused: true },
  })
