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

import type { ApplicabilityResult, ComplianceResult, ViolationMechanism } from "./narrowBoundaryReview";

export type LegacyBoundaryAssessment = {
  boundaryId: string;
  surfaceRef: string;
  applicability: ApplicabilityResult;
  compliance: ComplianceResult;
  /** An unqualified string. Nothing recorded WHICH text it came from — the R2.35 root cause. */
  governedActionEvidence: string;
  /** Likewise unqualified, and never checked for being about the prerequisite at all. */
  prerequisiteFailureEvidence: string;
  violationMechanism: ViolationMechanism;
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
