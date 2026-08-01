/**
 * MULTI-DEFECT CORRECTION PACKET (Slice 3.2I-R5B1A.1-R2.23).
 *
 * THE MEASURED PROBLEM
 *
 * A failed attempt usually contains several defects at once. The retry saw one: whichever gate
 * returned first. c01's accepted-then-rejected runs carried a false-reassurance option AND a
 * construction that asserted competence over it; only one code ever reached the model.
 *
 * THE CONTRACT
 *
 * One sanitized, ORDERED packet per failed attempt: safety and boundary corrections before ordinary
 * quality ones, every defect at its exact coordinate, repeated defects stated once as a pattern with
 * all affected coordinates, and everything that must not change pinned verbatim.
 *
 * The packet carries no reviewer chain-of-thought, no credential, no provider metadata, no rejected
 * scenario text and no example answer — an example would become the answer key the corpus work
 * spent a whole slice removing.
 *
 * `canonicalPacketJson` is key-sorted and stable, so a digest of it identifies the exact correction
 * an attempt received. Hashing happens in the service layer; domain stays pure.
 */

import { classifyCode, type GateLevel, type ResolvedFinding } from "./gatePrecedence";

export type CorrectionCoordinate = {
  phase?: string;
  branchIndex?: number;
  choiceIndex?: number;
  boundaryId?: string;
};

export type CorrectionItem = {
  code: string;
  level: GateLevel;
  /** Every place this defect occurs. A repeated decoy is ONE item with several coordinates. */
  coordinates: CorrectionCoordinate[];
  /** The concise required correction. Product language, never reviewer reasoning. */
  requiredCorrection: string;
};

export type ImmutableContext = {
  facts: string[];
  role: string;
  locale: string;
  boundaries: Array<{ id: string; statement: string }>;
};

export type CorrectionPacket = {
  attempt: number;
  primaryCode: string;
  primaryLevel: GateLevel;
  /** Deduplicated retryable codes, ordered by precedence. */
  defectCodes: string[];
  items: CorrectionItem[];
  immutable: ImmutableContext;
  mustRemainUnchanged: string[];
};

// ---------------------------------------------------------------------------
// Required corrections — one per code family, product language only
// ---------------------------------------------------------------------------

const CORRECTIONS: Record<string, string> = {
  // Level 3 — boundary and safety come first, always.
  confirmed_boundary_absent:
    "Establish the confirmed rule in the opening or immediate context in natural language, then regenerate the decisions so the rule actively constrains what can be chosen. Do not state it as a policy quotation.",
  boundary_not_operationalized:
    "Make the confirmed rule change the decisions. If deleting it would leave the scenario identical, it is decorative — rewrite so it rules out a tempting option and shapes what each remaining option costs.",
  vacuous_boundary_compliance:
    "The confirmed rule is present but constrains nothing. Make it bite at a decision stage, not only in the opening.",
  choice_bypasses_boundary:
    "Replace the choice that crosses the confirmed rule. Keep the decision tension INSIDE the rule; obeying it is never one of the options.",
  branch_drops_boundary: "Keep the confirmed rule in force after the primary consequence. Every branch must preserve it.",
  action_reopens_boundary: "The action decision may not reopen or waive the confirmed rule.",
  boundary_treated_as_optional: "The confirmed rule is non-negotiable. Show the prohibited alternative excluded, not weighed.",
  unsafe_delay:
    "Replace the option that delays urgent action without a safety or verification basis. A short pause REQUIRED by a safety rule is acceptable; an unexplained delay is not.",
  avoidable_foreseeable_harm: "Remove the foreseeable deterioration this option creates. Protect safety and a real operational value together.",
  convenience_over_safety: "This option protects convenience at the expense of safety. Replace it with a defensible leadership response.",
  missing_required_escalation:
    "Give this option a defensible escalation, staffing, supervision or referral response, using only resources the training input supports.",
  unsafe_option: "Replace the knowingly unsafe option with one a competent leader could responsibly choose.",
  unsupported_boundary_compliance: "Reference only the confirmed boundary ids you were given, and account for every one of them.",

  // Level 4 — construction integrity.
  construction_missing: "Every choice, at every phase, must carry its construction record.",
  competent_intent_bad_faith:
    "This option is justified by concealment, deflection or stalling. Replace it with a strategy a competent, well-intentioned person would choose.",
  construction_contradicts_label:
    "The construction claims a competent intent for a label the situation contradicts. Replace the label, or drop the option entirely.",
  no_legitimate_value: "Name the concrete value this option protects, or replace it. An option that protects nothing is not a choice.",
  no_real_cost: "State the real cost this option accepts. Without one it dominates its alternatives.",
  dominated_choice: "This option gives up nothing its sibling keeps. Give it a genuine sacrifice.",
  duplicate_value_cost_profile: "Two siblings share one value/cost profile. Give them genuinely different trade-offs, not different wording.",
  construction_metadata_generic: "Placeholder justification. State the actual value, cost and intent for this specific option.",
  unsupported_delay_basis: "State why the delay this option introduces is safe, or remove the delay.",

  // Level 5 — content quality.
  false_reassurance: "This option asserts something the situation contradicts. Remove the false claim; a defensible option never misrepresents the state of the work.",
  vague_reassurance:
    "Replace this reassurance with an owned, actionable response: who acts, what they do, and the trigger, checkpoint or threshold that follows. Invent no dates, people or resources.",
  non_commitment_decoy: "This option exists only to be rejected. Give it a protected value and a real cost, or replace it.",
  passive_delay: "Waiting is only a choice when it names what it protects and what it costs.",
  deflection_without_value: "Deflection is never a defensible strategy. Replace it.",
  repeated_decoy_across_branches: "The same reassurance-shaped option recurs across branches. Replace EVERY occurrence; each branch needs its own concrete response.",
  bad_faith_option: "Replace this option with one that protects a named legitimate value and accepts a real stated cost.",
  moral_decoy: "This frames the dilemma as good behaviour versus bad. Make both options defensible strategies with competing legitimate values.",
  obvious_correct_answer: "This option reads as the intended answer. Rebalance so neither option is signposted.",
  vague_evasion: "Name a concrete action and its cost.",
  no_value_tension: "Put two legitimate values in genuine tension, and make what each option protects and gives up explicit.",

  // Level 6 — progression and diversity.
  tradeoff_repeats_primary: "The primary choice is already made. Show the world it produced, then pose a genuinely new tradeoff.",
  action_repeats_tradeoff: "The tradeoff is already decided. The action phase must commit on a further new dimension.",
  action_reopens_primary: "No later phase may reverse the primary decision without a new causal event.",
  repeated_choice_meaning_within_branch: "Two choices in this branch mean the same thing. Rewording is not a new decision — pose a different one.",
  branch_decision_loop: "This branch loops instead of progressing: primary made → resulting world → new tradeoff → action commitment.",
  no_new_decision_dimension: "The tradeoff and action phases name one dimension. Give the action phase its own.",
  cross_branch_axis_collapse: "Every branch poses the same next decision, so the primary choice changed nothing. Give each branch its own decision dimension.",
  interchangeable_branch_consequence: "Branch content could be swapped between primary choices and still cohere. Make each consequence follow from its own choice.",
  generic_communication_collapse: "Every branch reduces to what to tell people and when. Not every branch may be a communication problem.",
  sibling_world_state_overlap: "Two branches land in the same world. Each must produce a distinct resulting state.",
  repeated_action_meaning: "The same action is offered in every branch. Give each branch actions that follow from its own consequence.",
  primary_choice_has_no_causal_effect: "State how each branch follows from its own primary choice — the effect, the new pressure, the next decision.",
  branch_semantic_collapse: "Two branches mean the same thing. Synonyms are not causal difference.",
  branch_repeats_primary: "This branch re-asks the question the primary choice already answered.",

  // --- remaining Level 3 boundary/grounding codes (the grounding record IS generator-authored) ---
  boundary_violation: "A choice crossed a confirmed non-negotiable rule. Every path must obey every active rule; put the difficulty in HOW to comply.",
  constraint_violation: "Learner-facing text describes skipping, delaying past or bypassing a confirmed rule. Remove it; the rule holds on every path.",
  unknown_boundary_reference: "A grounding record names a rule that was not confirmed for this situation. Reference only the active boundary ids you were given.",
  missing_boundary_reference: "An active confirmed rule has no grounding record. Produce exactly one record for every active rule.",
  grounding_missing: "The grounding records are absent. Produce one per active confirmed rule, each stating where the rule is operative and what it excludes.",
  grounding_malformed: "A grounding record is malformed. Each needs the boundary id, the confirmed statement, where it is operative, what it forces, the stages it constrains, the excluded alternative and the remaining judgment.",
  grounding_duplicate_boundary: "One rule is grounded twice. Produce exactly one record per active rule.",
  grounding_statement_altered: "A grounding record restates the confirmed rule in weaker terms. Restate it faithfully; a non-negotiable rule may not be softened.",
  grounding_missing_remaining_judgment: "A grounding record names no judgment surviving inside the rule. If nothing genuinely remains, this is not a practice situation — say so instead of generating one.",

  // --- remaining Level 5/6 content codes -------------------------------------
  duplicate_tradeoff: "Two options carry the same trade-off. Give each a genuinely different value and cost.",
  moral_label_language: "Learner-facing text signals a right or wrong answer. Remove praise, blame and every hint of a preferred option.",
  choice_no_concrete_action: "An option names no concrete action. State what the person actually does.",
  placeholder_leak: "Learner-facing text contains scaffolding or placeholder wording. Write the real scene.",
  branch_paraphrase: "A branch only rewords another. Give it its own causal state and its own next decision.",
  branch_incoherent_escalation: "The shared escalation presupposes one particular primary choice. Raise the stakes in a way that is true whichever option was taken.",
  branch_incoherent_reference: "A later phase refers to an artifact a path may never have produced. Refer back only in branch-neutral terms.",
  generic_branch_reaction: "A branch consequence is generic. Name the concrete new fact or pressure this path created.",
  generic_escalation: "The escalation is generic. Introduce a specific new stakeholder, deadline or fact.",
  boilerplate_repetition: "The same phrasing repeats across the scenario. Vary it; each moment is its own.",

  /**
   * Level 7 — reviewer-contract integrity. These are NOT generator defects, so no template asks the
   * model to repair a review it never saw. The only thing a regeneration can do is remove the
   * ambiguity that made the review contradictory, which is what this says.
   */
  review_contradictory: "The independent review of the previous attempt was internally inconsistent. Produce a scenario whose quality is unambiguous.",
};

/**
 * Codes the generation path can no longer emit.
 *
 * R2.23C removed the provider's per-choice `constraintAssessments`, so every `assessment_*` code is
 * now unreachable from generation. They stay registered because legacy content and the canonical
 * validator still use them; they are listed here so an absent correction template is a recorded
 * fact rather than an oversight.
 */
export const UNREACHABLE_FROM_GENERATION: readonly string[] = [
  "assessment_missing",
  "assessment_missing_for_choice",
  "assessment_malformed",
  "assessment_not_satisfied",
  "assessment_unknown_constraint",
  "assessment_constraint_uncovered",
  "assessment_rationale_empty",
];

/**
 * Reviewer-contract failures. A regeneration cannot repair a broken review, so these share one
 * honest instruction rather than pretending a per-code repair exists.
 */
export const REVIEWER_INTEGRITY_PREFIX = "review_";

const FALLBACK_CORRECTION = "Correct this defect while preserving the case facts, the confirmed boundaries and the scenario purpose.";
/** One shared instruction for reviewer-contract failures — see REVIEWER_INTEGRITY_PREFIX. */
const REVIEWER_INTEGRITY_CORRECTION =
  "The independent review of the previous attempt could not be trusted. Produce a scenario whose quality is unambiguous at every phase, so the review has nothing to be inconsistent about.";

export const MUST_REMAIN_UNCHANGED = [
  "the training facts",
  "the confirmed boundary ids and statements",
  "the output language",
  "the target role",
  "the scenario purpose",
  "the required JSON shape",
];

/**
 * Build the ordered correction packet for one failed attempt.
 *
 * Only RETRYABLE findings enter it — a terminal defect cannot be corrected by regenerating, and
 * listing it would invite the model to try. Items are ordered by gate level, so a boundary or
 * safety correction is always read before an ordinary quality one.
 */
export function buildCorrectionPacket(
  attempt: number,
  primaryCode: string,
  findings: ResolvedFinding[],
  immutable: ImmutableContext,
): CorrectionPacket {
  const retryable = findings.filter((f) => !classifyCode(f.code).terminal);
  // If the ranked primary is TERMINAL it cannot head a correction — a retry would be told to fix
  // something a retry cannot fix. The packet is headed by the most severe CORRECTABLE defect
  // instead, and the terminal code is simply absent (the caller does not retry on it at all).
  const headCode = classifyCode(primaryCode).terminal ? (retryable[0]?.code ?? primaryCode) : primaryCode;

  // One item per code; every occurrence becomes a coordinate on that item.
  const byCode = new Map<string, CorrectionItem>();
  for (const f of retryable) {
    const cls = classifyCode(f.code);
    const item = byCode.get(f.code) ?? {
      code: f.code,
      level: cls.level,
      coordinates: [],
      requiredCorrection: CORRECTIONS[f.code] ?? (f.code.startsWith(REVIEWER_INTEGRITY_PREFIX) ? REVIEWER_INTEGRITY_CORRECTION : FALLBACK_CORRECTION),
    };
    const coord: CorrectionCoordinate = {};
    if (f.phase !== undefined) coord.phase = f.phase;
    if (f.branchIndex !== undefined && f.branchIndex >= 0) coord.branchIndex = f.branchIndex;
    if (f.choiceIndex !== undefined && f.choiceIndex >= 0) coord.choiceIndex = f.choiceIndex;
    if (f.boundaryId !== undefined) coord.boundaryId = f.boundaryId;
    if (Object.keys(coord).length > 0 && !item.coordinates.some((c) => JSON.stringify(c) === JSON.stringify(coord))) {
      item.coordinates.push(coord);
    }
    byCode.set(f.code, item);
  }

  const items = [...byCode.values()].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    const ra = classifyCode(a.code).rank;
    const rb = classifyCode(b.code).rank;
    return ra !== rb ? ra - rb : a.code < b.code ? -1 : 1;
  });

  return {
    attempt,
    primaryCode: headCode,
    primaryLevel: classifyCode(headCode).level,
    defectCodes: items.map((i) => i.code),
    items,
    immutable,
    mustRemainUnchanged: MUST_REMAIN_UNCHANGED,
  };
}

// ---------------------------------------------------------------------------
// Canonical serialization + rendering
// ---------------------------------------------------------------------------

/** Deterministic, key-sorted JSON. Two identical packets serialize byte-identically. */
export function canonicalPacketJson(packet: CorrectionPacket): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, sort(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(packet));
}

const where = (c: CorrectionCoordinate): string => {
  if (c.boundaryId) return `boundary [${c.boundaryId}]`;
  const phase = (c.phase ?? "").replace("branch_", "").replace("flat_", "");
  const choice = c.choiceIndex !== undefined ? ` choice ${c.choiceIndex + 1}` : "";
  return c.branchIndex !== undefined ? `branch ${c.branchIndex + 1}, ${phase}${choice}` : `${phase}${choice}`;
};

/** Render the packet as the correction text appended to the SECOND generation request. */
export function renderCorrectionPacket(packet: CorrectionPacket): string {
  const lines = [
    `ATTEMPT ${packet.attempt} CORRECTION — an independent review rejected your previous scenario.`,
    `Primary defect: ${packet.primaryCode}. All defects: ${packet.defectCodes.join(", ")}.`,
    "Correct EVERY item below. Safety and confirmed-boundary items come first and are not negotiable.",
  ];
  for (const item of packet.items) {
    const at = item.coordinates.length ? ` (${item.coordinates.map(where).join("; ")})` : "";
    lines.push(`- [${item.code}]${at} ${item.requiredCorrection}`);
  }
  if (packet.immutable.boundaries.length) {
    lines.push(
      `CONFIRMED BOUNDARIES — unchanged and still binding: ${packet.immutable.boundaries.map((b) => `[${b.id}] "${b.statement}"`).join(" ")}`,
    );
  }
  lines.push(`UNCHANGED: ${packet.mustRemainUnchanged.join(", ")}. Return the complete corrected scenario.`);
  return lines.join("\n");
}
