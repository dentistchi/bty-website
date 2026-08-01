/**
 * THE SEMANTIC FACTS THE REVIEWER AUTHORS (Slice 3.2I-R5B1A.1-R2.38 Part 2).
 *
 * Three enums, and nothing else. Everything a previous contract asked the model to conclude —
 * applicability, compliance, the violation mechanism, the verdict — is derived by the server from
 * these three answers plus the canonical truth-state table.
 *
 * They live in their own module so the state table, the output contract and the candidate authority
 * can all share them without an import cycle.
 *
 * Pure domain: no I/O.
 */

/** Is the action the boundary governs present in THIS surface's own text? */
export const GOVERNED_ACTION_STATUSES = ["present", "absent", "uncertain"] as const;
export type GovernedActionStatus = (typeof GOVERNED_ACTION_STATUSES)[number];

/** What is the state of the prerequisite the boundary requires? */
export const PREREQUISITE_STATUSES = [
  "satisfied",
  "explicitly_missing",
  "contradicted",
  /** Nothing establishes it either way. Never a violation on its own. */
  "not_established",
  "uncertain",
  "not_applicable",
] as const;
export type PrerequisiteStatus = (typeof PREREQUISITE_STATUSES)[number];

/** How does the governed action stand in time against the prerequisite? */
export const TEMPORAL_RELATIONS = [
  "prerequisite_before_action",
  "action_before_prerequisite",
  "simultaneous_or_unclear",
  "unrelated",
  "not_applicable",
] as const;
export type TemporalRelation = (typeof TEMPORAL_RELATIONS)[number];

/**
 * The canonical "no evidence" value.
 *
 * R2.38 uses an explicit sentinel rather than an empty string: `""` is indistinguishable from a
 * field the model forgot to fill, and the R2.36 contract could not tell the two apart.
 */
export const NO_CANDIDATE = "none";

/** The three semantic roles a piece of evidence can play. */
export const EVIDENCE_ROLES = ["governed_action", "prerequisite_satisfaction", "prerequisite_failure"] as const;
export type EvidenceRole = (typeof EVIDENCE_ROLES)[number];

/** Compact per-role id prefixes, so a candidate id stays short in the response. */
export const ROLE_CODE: Record<EvidenceRole, string> = {
  governed_action: "a",
  prerequisite_satisfaction: "s",
  prerequisite_failure: "f",
};
