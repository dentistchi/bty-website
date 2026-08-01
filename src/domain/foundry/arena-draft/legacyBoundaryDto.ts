/**
 * THE PRE-R2.36 ASSESSMENT SHAPE (Slice 3.2I-R5B1A.1-R2.36 Part 11).
 *
 * The R2.30 and R2.34 live captures were produced under the R2.29/R2.32 contract, which had no
 * governed-action status, no prerequisite status, no temporal relation and no segment references.
 *
 * They are HISTORICAL EVIDENCE and must stay byte-identical to what the provider actually returned.
 * Retyping them into the new shape would silently invent the very truth fields R2.35 proved were
 * absent — and would destroy the only record of what a reviewer says when nobody asks it for them.
 * So the captures keep this legacy type, and the upgrade to the truth contract is an EXPLICIT,
 * reviewable step (see `r234LiveDtoFixture`) rather than an edit to the capture.
 *
 * Pure domain: no I/O.
 */

/**
 * The legacy vocabularies, declared HERE rather than imported.
 *
 * R2.38 removed `applicability`, `compliance` and `violationMechanism` from the model's output
 * entirely — the server derives all three. Importing them back from the live contract would make a
 * historical capture depend on a contract it predates, and would break again at the next change.
 */
export const LEGACY_APPLICABILITY = ["applies", "not_applicable", "uncertain"] as const;
export type LegacyApplicability = (typeof LEGACY_APPLICABILITY)[number];

export const LEGACY_COMPLIANCE = ["complies", "violates", "uncertain", "not_assessed"] as const;
export type LegacyCompliance = (typeof LEGACY_COMPLIANCE)[number];

export const LEGACY_VIOLATION_MECHANISMS = [
  "none",
  "governed_action_without_prerequisite",
  "resulting_state_missing_prerequisite",
  "boundary_reopened_after_prior_compliance",
  "explicit_boundary_contradiction",
  "other_grounded_violation",
] as const;
export type LegacyViolationMechanism = (typeof LEGACY_VIOLATION_MECHANISMS)[number];

export type LegacyBoundaryAssessment = {
  boundaryId: string;
  surfaceRef: string;
  applicability: LegacyApplicability;
  compliance: LegacyCompliance;
  /** An unqualified string. Nothing recorded WHICH text it came from — the R2.35 root cause. */
  governedActionEvidence: string;
  /** Likewise unqualified, and never checked for being about the prerequisite at all. */
  prerequisiteFailureEvidence: string;
  violationMechanism: LegacyViolationMechanism;
  reason: string;
};

/** The fields the legacy contract had no way to express. Kept as a named, testable list. */
export const LEGACY_MISSING_TRUTH_FIELDS = [
  "governedActionStatus",
  "prerequisiteStatus",
  "temporalRelation",
  "actionEvidence.segmentRef",
  "prerequisiteEvidence.segmentRef",
] as const;

/** The R2.36 shape: truth axes plus `{segmentRef, excerpt}` evidence, before candidate authority. */
export type R236BoundaryAssessment = {
  boundaryId: string;
  surfaceRef: string;
  applicability: LegacyApplicability;
  governedActionStatus: "present" | "absent" | "uncertain";
  prerequisiteStatus: "satisfied" | "explicitly_missing" | "contradicted" | "not_established" | "uncertain" | "not_applicable";
  temporalRelation: "prerequisite_before_action" | "action_before_prerequisite" | "simultaneous_or_unclear" | "unrelated" | "not_applicable";
  compliance: LegacyCompliance;
  violationMechanism: LegacyViolationMechanism;
  actionEvidence: { segmentRef: string; excerpt: string };
  prerequisiteEvidence: { segmentRef: string; excerpt: string };
  reason: string;
};
