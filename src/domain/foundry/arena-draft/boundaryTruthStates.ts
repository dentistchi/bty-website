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
import { RULE_KINDS, type RuleKind } from "./boundarySemanticFrame";
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

/**
 * R2.56 — THE RULE KINDS A STATE MAY BE SELECTED UNDER.
 *
 * WHAT R2.55 MEASURED
 *
 * `prohibited_action_present` was scoped to prohibition rules in TWO source comments and in NO row
 * data. The classifier filtered on the three fact fields alone, so the row applied to every rule
 * kind, and `present / not_applicable / not_applicable` under the c18 PREREQUISITE boundary — a rule
 * that forbids nothing — derived `applies` + `violates` + `explicit_boundary_contradiction`. The
 * whole path accepted it: validator, generator, and the R2.54 repair merge, into a
 * `boundary_review_reject` carrying a fabricated violation.
 *
 * The guard that was supposed to prevent this existed. `classifyTruthState` took a `ruleKind`
 * argument and disambiguated on it AFTER a single-match early return — and across the complete
 * measured space of 90 fact combinations, NO combination ever matched more than one row, in any
 * commit of this table's history. The tiebreak was unreachable from the moment it was written.
 *
 * Scope is therefore DATA, and it is a FILTER DIMENSION rather than a tiebreak. A row that means
 * something only under one kind of rule says so in a field the classifier reads.
 */
export type BoundaryRuleKind = RuleKind;

/**
 * Every rule kind a boundary can actually be judged under, and the scope of the two states that
 * hold whatever the rule forbids or requires.
 *
 * `uncertain` is deliberately absent: a frame that could not be decomposed already fails closed
 * before classification (`boundary_semantic_frame_uncertain`), and a state offered for a rule
 * nobody parsed is a shape that cannot be legally completed — the R2.53 trap.
 *
 * Only two states carry this scope, and both ask about the GOVERNED ACTION rather than about the
 * rule's structure: "this surface does something else entirely" and "the text does not settle
 * whether this surface performs the governed action" are answerable under a prohibition exactly as
 * under a prerequisite. Every other state names a prerequisite or a prohibition, and is scoped to
 * the one that owns it.
 */
export const GOVERNING_RULE_KINDS: readonly BoundaryRuleKind[] = RULE_KINDS.filter((k) => k !== "uncertain");

/** The six states that only mean something when a PREREQUISITE gates a governed action. */
export const PREREQUISITE_RULE_KINDS: readonly BoundaryRuleKind[] = ["prerequisite_before_action"];

/** The one state that only means something when the rule forbids the action outright. */
export const PROHIBITION_RULE_KINDS: readonly BoundaryRuleKind[] = ["prohibition"];

export type TruthStateRule = {
  id: TruthStateId;
  /**
   * R2.56 — the rule kinds this state may be selected under. A FILTER DIMENSION, never a comment.
   * Every row declares it explicitly; there is no wildcard and no implicit "all".
   */
  appliesToRuleKinds: readonly BoundaryRuleKind[];
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
    appliesToRuleKinds: GOVERNING_RULE_KINDS,
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
      "governedActionStatus=absent, prerequisiteStatus=not_applicable, temporalRelation=not_applicable — this surface does something else (staffing, notification, documentation, reporting, escalation, sequencing, communication). Leave reason empty.",
  },
  {
    // (Part 3 E)
    id: "governed_action_uncertain",
    appliesToRuleKinds: GOVERNING_RULE_KINDS,
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
      "governedActionStatus=uncertain — the text does not settle whether this surface performs the governed action. State the EXACT ambiguity in reason.",
  },
  {
    // (Part 3 B)
    id: "governed_action_prerequisite_satisfied",
    appliesToRuleKinds: PREREQUISITE_RULE_KINDS,
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
      "governedActionStatus=present, prerequisiteStatus=satisfied, temporalRelation=prerequisite_before_action — the governed action happens with the prerequisite already met. Leave reason empty.",
  },
  {
    // (Part 3 C)
    id: "governed_action_prerequisite_missing",
    appliesToRuleKinds: PREREQUISITE_RULE_KINDS,
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
      "governedActionStatus=present, prerequisiteStatus=explicitly_missing, temporalRelation=action_before_prerequisite — the governed action happens while the text says the prerequisite is NOT met. Leave reason empty.",
  },
  {
    // (Part 3 C)
    id: "governed_action_prerequisite_contradicted",
    appliesToRuleKinds: PREREQUISITE_RULE_KINDS,
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
      "governedActionStatus=present, prerequisiteStatus=contradicted, temporalRelation=action_before_prerequisite — the text asserts something incompatible with the prerequisite holding. Leave reason empty.",
  },
  {
    // (Part 3 D) SILENCE IS NOT A VIOLATION. The rule R2.30 established and R2.38 keeps structural.
    id: "governed_action_prerequisite_not_established",
    appliesToRuleKinds: PREREQUISITE_RULE_KINDS,
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
      "governedActionStatus=present, prerequisiteStatus=not_established — the governed action is here but NOTHING says whether the prerequisite was met. This is NOT a violation. Say in reason what is missing.",
  },
  {
    // (Part 3 D)
    id: "temporal_relation_uncertain",
    appliesToRuleKinds: PREREQUISITE_RULE_KINDS,
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
      "temporalRelation=simultaneous_or_unclear — the prerequisite's state is readable but the ORDER against the governed action is not. Say in reason what makes the order unclear.",
  },
  {
    // (Part 3 D)
    id: "prerequisite_truth_uncertain",
    appliesToRuleKinds: PREREQUISITE_RULE_KINDS,
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
      "prerequisiteStatus=uncertain — the governed action is here and the text about the prerequisite cannot be settled either way. Name the EXACT ambiguity in reason.",
  },
  {
    // A prohibition boundary ("never X"). Its semantic frame carries no prerequisite, so performing
    // the action IS the breach. Without this row a prohibition would be structurally unjudgeable —
    // a regression against R2.36, which accepted such frames.
    id: "prohibited_action_present",
    appliesToRuleKinds: PROHIBITION_RULE_KINDS,
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
      "governedActionStatus=present with a PROHIBITION rule (the rule forbids the action outright, it has no prerequisite) — set prerequisiteStatus=not_applicable and temporalRelation=not_applicable. Leave reason empty.",
  },
];

export type TruthFacts = {
  governedActionStatus: GovernedActionStatus;
  prerequisiteStatus: PrerequisiteStatus;
  temporalRelation: TemporalRelation;
};

/**
 * The single classification seam. `null` means the combination is outside the table FOR THIS RULE —
 * the server refuses it rather than inventing a meaning.
 *
 * FOUR FILTER DIMENSIONS, not three (R2.56). `ruleKind` sits alongside the three facts because a
 * state can be canonical under one kind of rule and meaningless under another. R2.55 measured the
 * cost of leaving it out: `present / not_applicable / not_applicable` resolved to
 * `prohibited_action_present` under the c18 PREREQUISITE boundary and derived an
 * `explicit_boundary_contradiction` against a rule that forbids nothing.
 *
 * THE PREVIOUS GUARD WAS UNREACHABLE. It disambiguated on `ruleKind` only when two rows matched, and
 * no fact combination has ever matched two rows — 0 of 90, in every commit of this table. It is
 * deleted rather than kept beside the real filter: two mechanisms for one job is how the first one
 * went unnoticed.
 *
 * An UNKNOWN rule kind matches no row and returns `null`. Failing closed on a rule nobody parsed is
 * the same policy `validateSemanticFrames` already applies one layer up.
 */
export function classifyTruthState(facts: TruthFacts, ruleKind: string): TruthStateRule | null {
  const matches = TRUTH_STATES.filter(
    (s) =>
      (s.appliesToRuleKinds as readonly string[]).includes(ruleKind) &&
      s.governedActionStatus === facts.governedActionStatus &&
      s.prerequisiteStatus.includes(facts.prerequisiteStatus) &&
      s.temporalRelation.includes(facts.temporalRelation),
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  /**
   * Ambiguity is a TABLE defect, not an input the classifier may resolve. Picking `matches[0]` here
   * is exactly the silent-ordering behaviour that let the old tiebreak look like it was working;
   * `truthStateAmbiguities()` asserts this set is empty, and a caller reaching this line has a
   * canonical table that no longer defines a function.
   */
  throw new Error(
    `canonical truth-state table is ambiguous for ruleKind=${ruleKind} ` +
      `${facts.governedActionStatus}/${facts.prerequisiteStatus}/${facts.temporalRelation}: ` +
      `${matches.map((s) => s.id).join(", ")}`,
  );
}

/**
 * Every (ruleKind × facts) cell the table resolves ambiguously. MUST be empty.
 *
 * Exposed rather than kept inside a test so the invariant travels with the table it constrains, and
 * so the manifest and the canary can bind the count.
 */
export function truthStateAmbiguities(
  ruleKinds: readonly string[],
  governed: readonly string[],
  prerequisite: readonly string[],
  temporal: readonly string[],
): Array<{ ruleKind: string; facts: TruthFacts; stateIds: TruthStateId[] }> {
  const out: Array<{ ruleKind: string; facts: TruthFacts; stateIds: TruthStateId[] }> = [];
  for (const ruleKind of ruleKinds) {
    for (const g of governed) {
      for (const p of prerequisite) {
        for (const t of temporal) {
          const matches = TRUTH_STATES.filter(
            (s) =>
              (s.appliesToRuleKinds as readonly string[]).includes(ruleKind) &&
              s.governedActionStatus === g &&
              (s.prerequisiteStatus as readonly string[]).includes(p) &&
              (s.temporalRelation as readonly string[]).includes(t),
          );
          if (matches.length > 1) {
            out.push({
              ruleKind,
              facts: { governedActionStatus: g, prerequisiteStatus: p, temporalRelation: t } as TruthFacts,
              stateIds: matches.map((s) => s.id),
            });
          }
        }
      }
    }
  }
  return out;
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
/**
 * R2.48 — ROLE-SPECIFIC EMPTY-POOL AUTHORITY.
 *
 * A state that REQUIRES prerequisite evidence cannot be answered on a surface where the server
 * offered none. R2.44's polarity gate emptied five failure pools; until R2.48 the validator accepted
 * the sentinel there, so `explicitly_missing` could derive a violation with no evidence behind it at
 * all — reopening the class R2.44 closed, through a different door.
 *
 * The codes are per ROLE. A single generic code would hide which evidence was unavailable, which is
 * the one thing an auditor reading a refusal needs to know.
 */
export const PREREQUISITE_UNAVAILABLE_CODES = [
  "boundary_prerequisite_satisfaction_candidate_unavailable",
  "boundary_prerequisite_failure_candidate_unavailable",
] as const;
export type PrerequisiteUnavailableCode = (typeof PREREQUISITE_UNAVAILABLE_CODES)[number];

export const prerequisiteUnavailableCode = (role: "prerequisite_satisfaction" | "prerequisite_failure"): PrerequisiteUnavailableCode =>
  role === "prerequisite_satisfaction" ? "boundary_prerequisite_satisfaction_candidate_unavailable" : "boundary_prerequisite_failure_candidate_unavailable";

/**
 * The prompt sentence for one state's THREE candidate requirements, GENERATED from the requirement
 * fields themselves.
 *
 * R2.47 measured why this cannot stay hand-written: the `promptRule` strings carried their own copy
 * of the requirements and had already drifted — `governed_action_prerequisite_contradicted` forbids
 * a satisfaction candidate and never said so. Generating the clause makes prompt and validator one
 * authority by construction.
 */
export function renderCandidateRequirements(s: TruthStateRule): string {
  const out: string[] = [];
  if (s.governedActionCandidate === "required") {
    out.push("Select a governedActionCandidates member — the sentinel `none` only if that list is empty.");
  } else if (s.governedActionCandidate === "optional") {
    out.push("The governed-action candidate is optional here.");
  }
  const roles: Array<[CandidateRequirement, string, string]> = [
    [s.satisfactionCandidate, "prerequisiteSatisfactionCandidateId", "prerequisiteSatisfactionCandidates"],
    [s.failureCandidate, "prerequisiteFailureCandidateId", "prerequisiteFailureCandidates"],
  ];
  const forbidden = roles.filter(([r]) => r === "forbidden");
  if (forbidden.length === 2) {
    out.push("Both prerequisite candidate IDs must be `none` — even when those lists are non-empty.");
  } else {
    for (const [req, field, list] of roles) {
      if (req === "forbidden") out.push(`${field} must be \`none\` — even when ${list} is non-empty.`);
      else if (req === "required") out.push(`Cite one ${list} member; if that list is empty this state is UNSUPPORTED for this surface — do not select it.`);
      else out.push(`${field} is optional; use \`none\` when ${list} is empty.`);
    }
  }
  return out.join(" ");
}

export const renderTruthStateRules = (): string[] => TRUTH_STATES.map((s) => `  ${s.id} — ${s.promptRule} ${renderCandidateRequirements(s)}`);

export const truthStatesRequiringReason = (): TruthStateId[] =>
  TRUTH_STATES.filter((s) => s.reasonAuthority === "model_required").map((s) => s.id);

/**
 * The digest that binds prompt, validator, derivation and artifact to ONE table.
 *
 * R2.56 — `appliesToRuleKinds` is a member of every row, so it is inside this digest by
 * construction. The scope cannot move without the digest moving, which is what makes the canary
 * refuse a stale binding rather than replay against a table it was not written for.
 */
export const truthStateTableSha256 = (): string =>
  createHash("sha256").update(JSON.stringify({ version: TRUTH_STATE_TABLE_VERSION, states: TRUTH_STATES })).digest("hex");

/**
 * How many of the schema's permitted combinations the table actually accepts.
 * Reported in the manifest so a silent widening of the accepted space is visible.
 *
 * R2.56 — the space is now (ruleKind × facts). The previous signature measured coverage under a
 * HARD-CODED `"prerequisite_before_action"`, which reported one rule kind's coverage as if it were
 * the whole table's — and would have reported no change at all when the prohibition row was scoped.
 * `perRuleKind` makes a widening visible where it happens.
 */
export function truthStateCoverage(
  governed: readonly string[],
  prerequisite: readonly string[],
  temporal: readonly string[],
  ruleKinds: readonly string[] = GOVERNING_RULE_KINDS,
): { permitted: number; accepted: number; perRuleKind: Record<string, number> } {
  const facts = governed.length * prerequisite.length * temporal.length;
  const perRuleKind: Record<string, number> = {};
  let accepted = 0;
  for (const ruleKind of ruleKinds) {
    let n = 0;
    for (const g of governed) {
      for (const p of prerequisite) {
        for (const t of temporal) {
          if (classifyTruthState({ governedActionStatus: g, prerequisiteStatus: p, temporalRelation: t } as TruthFacts, ruleKind)) n++;
        }
      }
    }
    perRuleKind[ruleKind] = n;
    accepted += n;
  }
  return { permitted: facts * ruleKinds.length, accepted, perRuleKind };
}
