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

  // Level 7 — reviewer integrity, correctable by regenerating cleaner content.
  review_contradictory: "The independent review of the previous attempt was internally inconsistent. Produce a scenario whose quality is unambiguous.",
};

const FALLBACK_CORRECTION = "Correct this defect while preserving the case facts, the confirmed boundaries and the scenario purpose.";

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
      requiredCorrection: CORRECTIONS[f.code] ?? FALLBACK_CORRECTION,
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
