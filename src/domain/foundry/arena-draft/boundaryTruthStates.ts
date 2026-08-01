/**
 * THE CANONICAL TRUTH-STATE TABLE (Slice 3.2I-R5B1A.1-R2.38 Parts 3, 9).
 *
 * WHAT R2.37 MEASURED
 *
 * The R2.36 live reviewer returned 24 assessments across two attempts. Every single one said
 * `applicability: "applies"` — the value `not_applicable` was used zero times. Twelve of the 24 then
 * said `governedActionStatus: absent` + `compliance: not_assessed`, which is a coherent English
 * sentence ("the rule governs this scenario, but this surface doesn't do the governed thing") and a
 * state the parity table does not contain. Both responses were discarded.
 *
 * The cause was not the model. R2.36 added `governedActionStatus` — "is the governed action present
 * in this surface's own text?" — alongside `applicability` — "does the boundary govern this surface
 * at all?". For an administrative surface those are the same question, so the reviewer answered the
 * precise one and left the vague one at its permissive default.
 *
 * WHAT THIS MODULE DOES
 *
 * It makes that whole class of disagreement impossible by deleting the duplicated axis from the
 * model's output. The reviewer now authors only SEMANTIC FACTS:
 *
 *     governedActionStatus · prerequisiteStatus · temporalRelation
 *
 * and the server DERIVES applicability, compliance, the violation mechanism and the verdict from
 * this table. There is exactly one place where "what does this combination mean" is written down,
 * and the prompt rules, the validator, the derivation and the tests are all generated from it.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";
import type { GovernedActionStatus, PrerequisiteStatus, TemporalRelation } from "./boundaryTruthContractTypes";

export const TRUTH_STATE_TABLE_VERSION = "practice-boundary-truth-states/1";

/** Every canonical state. A combination outside this table has no meaning and is refused. */
export const TRUTH_STATE_IDS = [
  "non_governing",
  "governed_action_uncertain",
  "governed_action_prerequisite_satisfied",
  "governed_action_prerequisite_missing",
  "governed_action_prerequisite_contradicted",
  "governed_action_prerequisite_not_established",
  "temporal_relation_uncertain",
  "prerequisite_truth_uncertain",
  /** A prohibition rule ("never X") has no prerequisite; performing the action is itself the breach. */
  "prohibited_action_present",
] as const;
export type TruthStateId = (typeof TRUTH_STATE_IDS)[number];

/** What the SERVER concludes. The model never authors any of these. */
export const DERIVED_APPLICABILITY = ["applies", "not_applicable", "uncertain"] as const;
export type DerivedApplicability = (typeof DERIVED_APPLICABILITY)[number];

export const DERIVED_COMPLIANCE = ["complies", "violates", "uncertain", "not_assessed"] as const;
export type DerivedCompliance = (typeof DERIVED_COMPLIANCE)[number];

/** Which family of registered defect code a derived violation belongs to. */
export const MECHANISM_FAMILIES = ["none", "prerequisite_unmet", "explicit_contradiction"] as const;
export type MechanismFamily = (typeof MECHANISM_FAMILIES)[number];

/** What this state contributes to the case verdict. */
export const VERDICT_EFFECTS = ["settled", "violation", "inconclusive"] as const;
export type VerdictEffect = (typeof VERDICT_EFFECTS)[number];

/** Whether a candidate id is required, forbidden, or permitted for a role in a given state. */
export const CANDIDATE_REQUIREMENTS = ["required", "forbidden", "optional"] as const;
export type CandidateRequirement = (typeof CANDIDATE_REQUIREMENTS)[number];

export type TruthStateRule = {
  id: TruthStateId;
  governedActionStatus: GovernedActionStatus;
  /** The prerequisite values this state accepts. */
  prerequisiteStatus: readonly PrerequisiteStatus[];
  /** The temporal values this state accepts. */
  temporalRelation: readonly TemporalRelation[];
  governedActionCandidate: CandidateRequirement;
  satisfactionCandidate: CandidateRequirement;
  failureCandidate: CandidateRequirement;
  /** `model_required` only where the model's own words are the ONLY possible source (R2.32). */
  reasonAuthority: "model_required" | "server_derived";
  derivedApplicability: DerivedApplicability;
  derivedCompliance: DerivedCompliance;
  mechanismFamily: MechanismFamily;
  verdictEffect: VerdictEffect;
  /** The single sentence the prompt renders for this state. Generated, never hand-copied. */
  promptRule: string;
};

const ALL_TEMPORAL: readonly TemporalRelation[] = [
  "prerequisite_before_action",
  "action_before_prerequisite",
  "simultaneous_or_unclear",
  "unrelated",
  "not_applicable",
];

/**
 * THE TABLE.
 *
 * Read the first three columns as the question the model answers and the rest as what the server
 * concludes. Nothing else in the codebase may restate these rules.
 */
export const TRUTH_STATES: readonly TruthStateRule[] = [
  {
    // (Part 3 A / F) The administrative, staffing, reporting and notification surfaces. The single
    // largest measured class — 12 of 24 live rows — and the one the removed axis made unsayable.
    id: "non_governing",
    governedActionStatus: "absent",
    prerequisiteStatus: ["not_applicable"],
    temporalRelation: ["unrelated", "not_applicable"],
    governedActionCandidate: "required",
    satisfactionCandidate: "forbidden",
    failureCandidate: "forbidden",
    reasonAuthority: "server_derived",
    derivedApplicability: "not_applicable",
    derivedCompliance: "not_assessed",
    mechanismFamily: "none",
    verdictEffect: "settled",
    promptRule:
      "governedActionStatus=absent, prerequisiteStatus=not_applicable, temporalRelation=not_applicable — this surface does something else (staffing, notification, documentation, reporting, escalation, sequencing, communication). Select the governed-action candidate that shows what it DOES, per the list table above — the sentinel applies only when that list is empty. Both prerequisite candidates must be none. Leave reason empty.",
  },
  {
    // (Part 3 E)
    id: "governed_action_uncertain",
    governedActionStatus: "uncertain",
    prerequisiteStatus: ["uncertain", "not_applicable", "not_established"],
    temporalRelation: ALL_TEMPORAL,
    governedActionCandidate: "optional",
    satisfactionCandidate: "forbidden",
    failureCandidate: "forbidden",
    reasonAuthority: "model_required",
    derivedApplicability: "uncertain",
    derivedCompliance: "not_assessed",
    mechanismFamily: "none",
    verdictEffect: "inconclusive",
    promptRule:
      "governedActionStatus=uncertain — the text does not settle whether this surface performs the governed action. Both prerequisite candidates must be none. State the EXACT ambiguity in reason.",
  },
  {
    // (Part 3 B)
    id: "governed_action_prerequisite_satisfied",
    governedActionStatus: "present",
    prerequisiteStatus: ["satisfied"],
    temporalRelation: ["prerequisite_before_action"],
    governedActionCandidate: "required",
    satisfactionCandidate: "required",
    failureCandidate: "forbidden",
    reasonAuthority: "server_derived",
    derivedApplicability: "applies",
    derivedCompliance: "complies",
    mechanismFamily: "none",
    verdictEffect: "settled",
    promptRule:
      "governedActionStatus=present, prerequisiteStatus=satisfied, temporalRelation=prerequisite_before_action — the governed action happens with the prerequisite already met. Select the governed-action candidate AND the satisfaction candidate. The failure candidate must be none. Leave reason empty.",
  },
  {
    // (Part 3 C)
    id: "governed_action_prerequisite_missing",
    governedActionStatus: "present",
    prerequisiteStatus: ["explicitly_missing"],
    temporalRelation: ["action_before_prerequisite"],
    governedActionCandidate: "required",
    satisfactionCandidate: "forbidden",
    failureCandidate: "required",
    reasonAuthority: "server_derived",
    derivedApplicability: "applies",
    derivedCompliance: "violates",
    mechanismFamily: "prerequisite_unmet",
    verdictEffect: "violation",
    promptRule:
      "governedActionStatus=present, prerequisiteStatus=explicitly_missing, temporalRelation=action_before_prerequisite — the governed action happens while the text says the prerequisite is NOT met. Select the governed-action candidate AND the failure candidate. The satisfaction candidate must be none. Leave reason empty.",
  },
  {
    // (Part 3 C)
    id: "governed_action_prerequisite_contradicted",
    governedActionStatus: "present",
    prerequisiteStatus: ["contradicted"],
    temporalRelation: ["action_before_prerequisite"],
    governedActionCandidate: "required",
    satisfactionCandidate: "forbidden",
    failureCandidate: "required",
    reasonAuthority: "server_derived",
    derivedApplicability: "applies",
    derivedCompliance: "violates",
    mechanismFamily: "explicit_contradiction",
    verdictEffect: "violation",
    promptRule:
      "governedActionStatus=present, prerequisiteStatus=contradicted, temporalRelation=action_before_prerequisite — the text asserts something incompatible with the prerequisite holding. Select the governed-action candidate AND the failure candidate. Leave reason empty.",
  },
  {
    // (Part 3 D) SILENCE IS NOT A VIOLATION. The rule R2.30 established and R2.38 keeps structural.
    id: "governed_action_prerequisite_not_established",
    governedActionStatus: "present",
    prerequisiteStatus: ["not_established"],
    temporalRelation: ALL_TEMPORAL,
    governedActionCandidate: "required",
    satisfactionCandidate: "forbidden",
    failureCandidate: "forbidden",
    reasonAuthority: "model_required",
    derivedApplicability: "applies",
    derivedCompliance: "uncertain",
    mechanismFamily: "none",
    verdictEffect: "inconclusive",
    promptRule:
      "governedActionStatus=present, prerequisiteStatus=not_established — the governed action is here but NOTHING says whether the prerequisite was met. This is NOT a violation. Both prerequisite candidates must be none. Say in reason what is missing.",
  },
  {
    // (Part 3 D)
    id: "temporal_relation_uncertain",
    governedActionStatus: "present",
    prerequisiteStatus: ["satisfied", "explicitly_missing", "contradicted"],
    temporalRelation: ["simultaneous_or_unclear"],
    governedActionCandidate: "required",
    satisfactionCandidate: "optional",
    failureCandidate: "optional",
    reasonAuthority: "model_required",
    derivedApplicability: "applies",
    derivedCompliance: "uncertain",
    mechanismFamily: "none",
    verdictEffect: "inconclusive",
    promptRule:
      "temporalRelation=simultaneous_or_unclear — the prerequisite's state is readable but the ORDER against the governed action is not. Select the candidate matching the prerequisite status you chose. Say in reason what makes the order unclear.",
  },
  {
    // (Part 3 D)
    id: "prerequisite_truth_uncertain",
    governedActionStatus: "present",
    prerequisiteStatus: ["uncertain"],
    temporalRelation: ALL_TEMPORAL,
    governedActionCandidate: "required",
    satisfactionCandidate: "forbidden",
    failureCandidate: "forbidden",
    reasonAuthority: "model_required",
    derivedApplicability: "applies",
    derivedCompliance: "uncertain",
    mechanismFamily: "none",
    verdictEffect: "inconclusive",
    promptRule:
      "prerequisiteStatus=uncertain — the governed action is here and the text about the prerequisite cannot be settled either way. Both prerequisite candidates must be none. Name the EXACT ambiguity in reason.",
  },
  {
    // A prohibition boundary ("never X"). Its semantic frame carries no prerequisite, so performing
    // the action IS the breach. Without this row a prohibition would be structurally unjudgeable —
    // a regression against R2.36, which accepted such frames.
    id: "prohibited_action_present",
    governedActionStatus: "present",
    prerequisiteStatus: ["not_applicable"],
    temporalRelation: ["unrelated", "not_applicable"],
    governedActionCandidate: "required",
    satisfactionCandidate: "forbidden",
    failureCandidate: "forbidden",
    reasonAuthority: "server_derived",
    derivedApplicability: "applies",
    derivedCompliance: "violates",
    mechanismFamily: "explicit_contradiction",
    verdictEffect: "violation",
    promptRule:
      "governedActionStatus=present with a PROHIBITION rule (the rule forbids the action outright, it has no prerequisite) — set prerequisiteStatus=not_applicable and temporalRelation=not_applicable. Select the governed-action candidate only. Leave reason empty.",
  },
];

export type TruthFacts = {
  governedActionStatus: GovernedActionStatus;
  prerequisiteStatus: PrerequisiteStatus;
  temporalRelation: TemporalRelation;
};

/**
 * The single classification seam. `null` means the combination is outside the table — the server
 * refuses it rather than inventing a meaning.
 *
 * `ruleKind` disambiguates the one genuine overlap: `present + not_applicable + not_applicable` is a
 * prohibition breach under a prohibition rule and meaningless under a prerequisite rule.
 */
export function classifyTruthState(facts: TruthFacts, ruleKind: string): TruthStateRule | null {
  const matches = TRUTH_STATES.filter(
    (s) =>
      s.governedActionStatus === facts.governedActionStatus &&
      s.prerequisiteStatus.includes(facts.prerequisiteStatus) &&
      s.temporalRelation.includes(facts.temporalRelation),
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  const prohibition = matches.find((s) => s.id === "prohibited_action_present");
  if (prohibition) return ruleKind === "prohibition" ? prohibition : (matches.find((s) => s !== prohibition) ?? null);
  return matches[0]!;
}

/** Derived — never authored. Exposed separately so callers cannot accidentally read a model field. */
export const deriveApplicability = (s: TruthStateRule): DerivedApplicability => s.derivedApplicability;
export const deriveCompliance = (s: TruthStateRule): DerivedCompliance => s.derivedCompliance;

/**
 * The registered violation mechanism for a derived violation.
 *
 * Deterministic in the boundary's rule kind, the surface kind and the state — never model-authored.
 * The returned values are the SAME registered names R2.29 introduced; none is renamed or retired.
 */
export function deriveMechanism(state: TruthStateRule, surfaceKind: string, hasViolatingAncestor: boolean): string {
  if (state.verdictEffect !== "violation") return "none";
  if (state.mechanismFamily === "explicit_contradiction") return "explicit_boundary_contradiction";
  if (surfaceKind === "resulting_world_state") return "resulting_state_missing_prerequisite";
  if (hasViolatingAncestor) return "boundary_reopened_after_prior_compliance";
  return "governed_action_without_prerequisite";
}

/** Prompt rules, generated. A hand-written duplicate of these sentences is a parity defect. */
export const renderTruthStateRules = (): string[] => TRUTH_STATES.map((s) => `  ${s.id} — ${s.promptRule}`);

export const truthStatesRequiringReason = (): TruthStateId[] =>
  TRUTH_STATES.filter((s) => s.reasonAuthority === "model_required").map((s) => s.id);

/** The digest that binds prompt, validator, derivation and artifact to ONE table. */
export const truthStateTableSha256 = (): string =>
  createHash("sha256").update(JSON.stringify({ version: TRUTH_STATE_TABLE_VERSION, states: TRUTH_STATES })).digest("hex");

/**
 * How many of the schema's permitted fact combinations the table actually accepts.
 * Reported in the manifest so a silent widening of the accepted space is visible.
 */
export function truthStateCoverage(
  governed: readonly string[],
  prerequisite: readonly string[],
  temporal: readonly string[],
): { permitted: number; accepted: number } {
  let accepted = 0;
  for (const g of governed) {
    for (const p of prerequisite) {
      for (const t of temporal) {
        if (classifyTruthState({ governedActionStatus: g, prerequisiteStatus: p, temporalRelation: t } as TruthFacts, "prerequisite_before_action")) accepted++;
      }
    }
  }
  return { permitted: governed.length * prerequisite.length * temporal.length, accepted };
}
