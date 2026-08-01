/**
 * BOUNDARY-RELATIVE CANDIDATE ROLE AUTHORITY (Slice 3.2I-R5B1A.1-R2.40 Parts 3-5).
 *
 * WHAT R2.39 MEASURED
 *
 * The R2.38 live review derived a causal violation on `primary[0]` — "Verify identifiers for both
 * patients now" — which is the one primary choice that KEEPS the boundary. The correction packet
 * then told a Manager to rewrite the safe option while saying nothing about the unsafe one. A
 * generation retry acting on it could delete the safe choice and preserve the unsafe root.
 *
 * The reviewer did not invent that. The SERVER offered the span as candidate `1-a1`, semantic role
 * `governed_action`, because governed-action eligibility was:
 *
 *     if (role === "governed_action") return true;      // boundaryEvidenceCandidates.ts
 *
 * — no test at all. Meanwhile the semantic frame already derived everything needed to refuse it:
 *
 *     prerequisiteClause  "Two identifiers must be verified"  -> ["identifier", "verif"]
 *     governedActionClause "treatment"                        -> ["treatment"]
 *
 * The second set was never read. Across the twelve surfaces, 3 spans were offered as BOTH a governed
 * action and a prerequisite role, and 15 as both satisfaction and failure — 12/12 surfaces had at
 * least one role collision. The role label was a pool name, not a proven property.
 *
 * WHAT THIS MODULE DOES
 *
 * It makes the role a decision the server can defend. A span is eligible for `governed_action` only
 * when it does not merely perform the PREREQUISITE, judged against the boundary's own two clauses.
 *
 * NO DOMAIN VOCABULARY. Every term comes from the canonical semantic frame, so a boundary about
 * signatures, sign-off or dual authorization moves the test with it. `boundaryCandidateRole.test`
 * proves that with a synthetic second boundary sharing no words with c18.
 *
 * SCOPE. This slice enforces exactly ONE collision class: a prerequisite-performing span offered as
 * a governed action. Satisfaction/failure polarity is measured and reported here but deliberately
 * NOT enforced — R2.39 showed a first-cut polarity rule strips the safe branch of its only
 * satisfaction evidence, so it needs its own measured slice.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";
import { clauseStems, normalizeForGrounding } from "./boundaryClauseTerms";
import type { EvidenceRole } from "./boundaryTruthContractTypes";
import type { BoundarySemanticFrame } from "./boundarySemanticFrame";

export const CANDIDATE_ROLE_VERSION = "practice-boundary-candidate-role/1";

/** What the classifier concluded about one span, relative to one boundary. */
export const ROLE_ELIGIBILITY = [
  "eligible",
  /** Performs the prerequisite and not the governed action — the measured `primary[0]` shape. */
  "prerequisite_operation_only",
  /** Expresses the governed action and nothing prerequisite-like. */
  "governed_action_only",
  /** Expresses both; legitimate for a state that treats after verifying. */
  "role_collision",
  /** Matches neither clause. Still eligible as a governed action: absence of prerequisite terms is
   *  not evidence of anything, and refusing it would silently hide ordinary choices. */
  "unrelated",
  /** The frame cannot decide. Fails closed. */
  "uncertain",
] as const;
export type RoleEligibility = (typeof ROLE_ELIGIBILITY)[number];

export const ROLE_REFUSAL_CODES = [
  "boundary_candidate_role_prerequisite_operation",
  "boundary_candidate_role_uncertain",
] as const;
export type RoleRefusalCode = (typeof ROLE_REFUSAL_CODES)[number];

export type BoundaryCandidateRoleAssessment = {
  boundaryId: string;
  candidateSpanSha256: string;
  requestedRole: EvidenceRole;
  prerequisiteClauseMatch: boolean;
  governedActionClauseMatch: boolean;
  roleEligibility: RoleEligibility;
  /** Set only when the span is refused for the requested role. */
  refusalCode: RoleRefusalCode | null;
  /** Which frame terms matched. Evidence for an auditor, never product-facing prose. */
  evidence: { prerequisiteTerms: string[]; governedActionTerms: string[]; matchedPrerequisite: string[]; matchedGovernedAction: string[] };
};

const spanDigest = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

/**
 * NOMINALIZATION ROOTS.
 *
 * A boundary names its governed action as a NOUN — "treatment", "authorization", "disbursement" —
 * while a surface performs it as a VERB — "treated", "treat", "authorized". `clauseStems` strips
 * verbal suffixes but not nominal ones, so `treatment` never matched `treated`, and the role gate
 * refused genuine governed actions such as "One patient was treated while the second remains
 * unverified". That would have destroyed a measured branch true positive.
 *
 * This strips the nominal suffix so the two forms meet at a shared root. It is a morphological rule
 * applied to whatever the canonical frame contains — never a list of domain words — and it is
 * applied to BOTH clause sets so the comparison stays symmetric.
 */
const NOMINAL_SUFFIX = /(ments?|ances?|ences?|ures?|ions?)$/u;
const roots = (clause: string): string[] =>
  clauseStems(clause)
    .map((t) => {
      const r = t.replace(NOMINAL_SUFFIX, "");
      return r.length >= 4 ? r : t;
    })
    .filter((t, i, all) => all.indexOf(t) === i);

const matched = (text: string, terms: string[]): string[] => {
  const t = normalizeForGrounding(text);
  return terms.filter((s) => t.includes(s));
};

/**
 * Classify one span against one boundary.
 *
 * A frame that could not be decomposed yields `uncertain`, which fails closed: the server does not
 * guess a role under a rule nobody parsed.
 */
export function assessCandidateRole(
  boundary: { id: string },
  frame: BoundarySemanticFrame,
  requestedRole: EvidenceRole,
  span: string,
): BoundaryCandidateRoleAssessment {
  const prerequisiteTerms = roots(frame.prerequisiteClause);
  const governedActionTerms = roots(frame.governedActionClause);
  const matchedPrerequisite = matched(span, prerequisiteTerms);
  const matchedGovernedAction = matched(span, governedActionTerms);
  const prerequisiteClauseMatch = matchedPrerequisite.length > 0;
  const governedActionClauseMatch = matchedGovernedAction.length > 0;

  const base = {
    boundaryId: boundary.id,
    candidateSpanSha256: spanDigest(span),
    requestedRole,
    prerequisiteClauseMatch,
    governedActionClauseMatch,
    evidence: { prerequisiteTerms, governedActionTerms, matchedPrerequisite, matchedGovernedAction },
  };

  // The frame could not be decomposed, or a prerequisite rule carries no governed-action clause to
  // compare against. Either way the server cannot separate the roles, so it says so.
  if (frame.ruleKind === "uncertain" || (frame.ruleKind === "prerequisite_before_action" && governedActionTerms.length === 0)) {
    return { ...base, roleEligibility: "uncertain", refusalCode: requestedRole === "governed_action" ? "boundary_candidate_role_uncertain" : null };
  }

  // Only a prerequisite rule has a prerequisite to leak. A prohibition or state requirement has no
  // separate governed action to confuse it with, so its spans are left alone.
  if (frame.ruleKind !== "prerequisite_before_action") return { ...base, roleEligibility: "eligible", refusalCode: null };

  if (prerequisiteClauseMatch && governedActionClauseMatch) {
    // "You have verified identifiers … and provided the necessary treatment" — a state that does
    // both. Legitimate as a governed action; the collision is recorded, not refused.
    return { ...base, roleEligibility: "role_collision", refusalCode: null };
  }
  if (prerequisiteClauseMatch && !governedActionClauseMatch) {
    // THE MEASURED DEFECT. "Verify identifiers for both patients now" performs the prerequisite and
    // performs no treatment. It cannot be evidence that this surface does the governed thing.
    return {
      ...base,
      roleEligibility: "prerequisite_operation_only",
      refusalCode: requestedRole === "governed_action" ? "boundary_candidate_role_prerequisite_operation" : null,
    };
  }
  if (governedActionClauseMatch) return { ...base, roleEligibility: "governed_action_only", refusalCode: null };

  // Matches neither clause: "Prepare a detailed report", "Immediately treat the second patient".
  // Note the second one — a governed action the clause term does not literally cover. Refusing
  // `unrelated` spans would have destroyed the measured `branch[1].action[1]` true positive, so
  // absence of prerequisite terms is treated as absence of evidence, not as disqualification.
  return { ...base, roleEligibility: "unrelated", refusalCode: null };
}

/** The one seam candidate construction calls. `true` means the span may occupy the requested role. */
export const isRoleEligible = (boundary: { id: string }, frame: BoundarySemanticFrame, role: EvidenceRole, span: string): boolean =>
  assessCandidateRole(boundary, frame, role, span).refusalCode === null;

export type RoleDecisionLog = BoundaryCandidateRoleAssessment & { surfaceRef: string; candidateId: string; span: string };

/** Counts the stability gate reads. Only the ENFORCED class may fail a run. */
export type RoleDecisionMetrics = {
  governedActionRoleCollisionCount: number;
  governedActionPrerequisiteOperationRefusedCount: number;
  governedActionRoleUncertainCount: number;
  /** Measured and reported. NOT enforced in this slice — see the module header. */
  prerequisitePolarityCollisionObservedCount: number;
};

export function summarizeRoleDecisions(decisions: RoleDecisionLog[], polarityCollisions: number): RoleDecisionMetrics {
  return {
    governedActionRoleCollisionCount: decisions.filter((d) => d.roleEligibility === "role_collision").length,
    governedActionPrerequisiteOperationRefusedCount: decisions.filter((d) => d.refusalCode === "boundary_candidate_role_prerequisite_operation").length,
    governedActionRoleUncertainCount: decisions.filter((d) => d.refusalCode === "boundary_candidate_role_uncertain").length,
    prerequisitePolarityCollisionObservedCount: polarityCollisions,
  };
}

/** The classifier contract digest — moves when the decision procedure or its vocabulary moves. */
export const candidateRoleContractSha256 = (): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        version: CANDIDATE_ROLE_VERSION,
        eligibility: ROLE_ELIGIBILITY,
        refusalCodes: ROLE_REFUSAL_CODES,
        termsFrom: ["semanticFrame.prerequisiteClause", "semanticFrame.governedActionClause"],
        globalDomainKeywordList: false,
        enforcedCollisionClass: "governed_action_vs_prerequisite_operation",
        polarityEnforced: false,
        unrelatedSpansRemainEligible: true,
        prohibitionAndStateRulesUnaffected: true,
      }),
    )
    .digest("hex");
