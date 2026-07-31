/**
 * PROVIDER-ONLY CHOICE CONSTRUCTION (Slice 3.2I-R5B1A.1-R2.22).
 *
 * THE MEASURED DEFECT
 *
 * c01's accepted scenario offered `Assure the client that everything is on schedule, but investigate
 * internally` — while the delivery had already been missed. That is not concealment by omission, it
 * is active misrepresentation, and no competent person could choose it. Its branch then narrated
 * "You have avoided admitting the missed deadline" and offered "Continue to deflect questions".
 * c18's accepted output repeated vague reassurance across every branch.
 *
 * WHY IT PASSED
 *
 * Nothing in the pipeline required a choice to be CONSTRUCTED. The provider authored a `label` and
 * nothing else; the deterministic gates judged shape, scene concreteness and boundary compliance;
 * and the semantic reviewer's per-choice contract covered PRIMARY choices only. Tradeoff and action
 * choices — flat and branched — reached the learner on label plausibility alone.
 *
 * WHAT THIS MODULE ADDS
 *
 * Every user-facing choice, in every phase, now carries a short product-facing construction record:
 * the value it protects, the cost it accepts, why a competent person could choose it, what the
 * person actually does, which confirmed boundaries it obeys, the safety basis for any delay, and
 * what makes it neither dominated by nor interchangeable with its siblings.
 *
 * These are PRODUCT justifications, not private reasoning: short, checkable, provider-only. They are
 * validated then discarded — never persisted in the canonical draft, never rendered to a learner,
 * and never used to fabricate or rewrite missing user-facing content.
 *
 * The deterministic gates here prove only what can be proved structurally. Meaning stays with the
 * semantic reviewer (`choiceReview.ts`); every lexical rule below is tied to a defect that was
 * actually measured, and every one has a negative fixture guarding against over-reach.
 *
 * Pure domain: no I/O, no provider, no DB.
 */

import {
  GEN_ACTION_TEXT_MAX,
  GEN_COST_MAX,
  GEN_INTENT_MAX,
  GEN_SHORT_REASON_MAX,
  GEN_VALUE_MAX,
  type ArenaScenarioDraft,
} from "./types";

// ---------------------------------------------------------------------------
// Phases and choice enumeration
// ---------------------------------------------------------------------------

/** Every phase that shows the learner a choice. `opening` is narrative, so it is not here. */
export const CHOICE_PHASES = ["primary", "flat_tradeoff", "flat_action", "branch_tradeoff", "branch_action"] as const;
export type ChoicePhase = (typeof CHOICE_PHASES)[number];

/** One user-facing choice, with the coordinates every reviewer and retry message refers to. */
export type ChoiceRef = {
  id: string;
  label: string;
  phase: ChoicePhase;
  /** -1 for the flat phases. */
  branchIndex: number;
  /** Position within its own sibling group. */
  index: number;
};

/**
 * Enumerate every user-facing choice in canonical order. This is the single authority on what a
 * reviewer must cover — "reviewed exactly once" is measured against it.
 */
export function enumerateChoices(draft: ArenaScenarioDraft): ChoiceRef[] {
  const out: ChoiceRef[] = [];
  draft.primary.choices.forEach((c, i) => out.push({ id: c.id, label: c.label, phase: "primary", branchIndex: -1, index: i }));
  draft.tradeoff.choices.forEach((c, i) => out.push({ id: c.id, label: c.label, phase: "flat_tradeoff", branchIndex: -1, index: i }));
  draft.actionDecision.choices.forEach((c, i) => out.push({ id: c.id, label: c.label, phase: "flat_action", branchIndex: -1, index: i }));
  // Branch order follows the primary-choice order — that ordering IS the branch relationship.
  draft.primary.choices.forEach((p, b) => {
    const branch = draft.branches?.[p.id];
    if (!branch) return;
    branch.tradeoffChoices.forEach((c, i) => out.push({ id: c.id, label: c.label, phase: "branch_tradeoff", branchIndex: b, index: i }));
    branch.actionDecision.choices.forEach((c, i) => out.push({ id: c.id, label: c.label, phase: "branch_action", branchIndex: b, index: i }));
  });
  return out;
}

/** Sibling group key — choices the learner picks between at one moment. */
export const siblingKey = (c: ChoiceRef): string => `${c.phase}:${c.branchIndex}`;

// ---------------------------------------------------------------------------
// The construction record
// ---------------------------------------------------------------------------

export type ProviderChoiceConstruction = {
  /** The concrete organizational, relational, operational, learning or safety value protected. */
  legitimateValue: string;
  /** The real downside, delay, exposure, resource cost, uncertainty or relational risk accepted. */
  acceptedCost: string;
  /** Why a capable, well-intentioned person could choose this. */
  competentIntent: string;
  /** What the person actually does. */
  concreteAction: string;
  /** Confirmed boundary ids this choice obeys. Required when boundaries apply. */
  boundaryCompliance: string[];
  /** Why any delay this choice introduces is safe. Required when it delays. */
  urgencySafetyBasis: string;
  /** Why this is not simply worse than a sibling. */
  whyNotDominated: string;
  /** The different value/cost profile — not different wording. */
  distinguishesFromSibling: string;
};

const strArray = { type: "array", items: { type: "string" } } as const;

/** Strict schema fragment — composed into every provider choice. */
export const CHOICE_CONSTRUCTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    // R2.23A — every field is BOUNDED so the generation schema has a finite permitted maximum.
    // These are concise-product limits, generous against measured live output; over-limit output
    // fails schema validation and is never truncated after the fact.
    legitimateValue: { type: "string", maxLength: GEN_VALUE_MAX },
    acceptedCost: { type: "string", maxLength: GEN_COST_MAX },
    competentIntent: { type: "string", maxLength: GEN_INTENT_MAX },
    concreteAction: { type: "string", maxLength: GEN_ACTION_TEXT_MAX },
    boundaryCompliance: { type: "array", maxItems: 10, items: { type: "string", maxLength: 120 } },
    urgencySafetyBasis: { type: "string", maxLength: GEN_SHORT_REASON_MAX },
    whyNotDominated: { type: "string", maxLength: GEN_SHORT_REASON_MAX },
    distinguishesFromSibling: { type: "string", maxLength: GEN_SHORT_REASON_MAX },
  },
  required: [
    "legitimateValue",
    "acceptedCost",
    "competentIntent",
    "concreteAction",
    "boundaryCompliance",
    "urgencySafetyBasis",
    "whyNotDominated",
    "distinguishesFromSibling",
  ],
} as const;

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

export const CHOICE_CONSTRUCTION_DEFECT_CODES = [
  "no_legitimate_value",
  "no_real_cost",
  "construction_metadata_generic",
  "construction_contradicts_label",
  "competent_intent_bad_faith",
  "dominated_choice",
  "duplicate_value_cost_profile",
  "unsupported_boundary_compliance",
  "unsupported_delay_basis",
  "construction_missing",
] as const;
export type ChoiceConstructionDefectCode = (typeof CHOICE_CONSTRUCTION_DEFECT_CODES)[number];

/** Label-level defects measured in accepted live output. Each is narrow and fixture-guarded. */
export const MEASURED_LABEL_DEFECT_CODES = [
  "false_reassurance",
  "vague_reassurance",
  "deflection_without_value",
  "repeated_choice_meaning_within_branch",
  "repeated_action_meaning",
] as const;

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").replace(/\s+/g, " ").trim();
}
const wordCount = (s: string) => (normalizeText(s) ? normalizeText(s).split(" ").length : 0);

/** Values that carry no information wherever they appear. Not a morality list — a placeholder list. */
const PLACEHOLDERS = new Set([
  "", "n a", "na", "none", "nil", "tbd", "unknown", "various", "general", "generic", "it depends",
  "value", "cost", "the value", "the cost", "good", "bad", "yes", "no", "ok", "fine", "not applicable",
]);
const isPlaceholder = (s: string) => PLACEHOLDERS.has(normalizeText(s));

/**
 * Bad-faith intent stated in the METADATA (never in learner text): the choice is justified BY
 * concealment or deception. Negated mentions ("avoid misleading the client") are not matches — the
 * whole point of the rule is to catch a justification that RELIES on bad faith.
 */
const BAD_FAITH_VERBS = /\b(lie|lies|lying|mislead|misleads|misleading|conceal|conceals|concealing|concealment|deceive|deceives|deceiving|deception|hide|hides|hiding|cover up|covering up|pretend|pretends|pretending|falsify|falsifies|stall|stalls|stalling|deflect|deflects|deflecting)\b/g;
const NEGATORS = /\b(avoid|avoids|avoiding|without|never|not|no|rather than|instead of|refuses? to|declines? to|does not|doesn't|stops?)\b/;

export function statesBadFaithIntent(text: string): boolean {
  const t = text.toLowerCase();
  for (const m of t.matchAll(BAD_FAITH_VERBS)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    // Look only at the immediate lead-in; a negation five clauses back is not this verb's negation.
    if (NEGATORS.test(before.split(/[.;,]/).pop() ?? before)) continue;
    return true;
  }
  return false;
}

/** Does this text announce a delay as the action? Used to require a safety basis for it. */
const DELAY_ACTION = /\b(delay|delays|delaying|wait|waits|waiting|hold off|holds off|postpone|postpones|postponing|defer|defers|deferring|pause|pauses|pausing)\b/;
export const announcesDelay = (text: string): boolean => DELAY_ACTION.test(text.toLowerCase());

// ---------------------------------------------------------------------------
// MEASURED label defects (Part 9) — narrow, each tied to observed output
// ---------------------------------------------------------------------------

/** c01: "Assure the client that everything is on schedule" — while the delivery was already missed. */
const ON_SCHEDULE_CLAIM = /\b(on schedule|on track|everything is fine|all is well|nothing to worry|no delays?|no issues?)\b/;
/** The input side of the same defect: the facts state the miss the claim denies. */
const FACTS_STATE_A_MISS = /\b(missed|miss|late|overdue|slipped|slipping|behind schedule|delayed|breach|failed to deliver|not yet confirmed)\b/;

/** c01: "Suggest they trust your timeline without further explanation." */
const REASSURANCE_PHRASE = /\b(as soon as possible|asap|trust (the|your|our) (timeline|schedule|process|judgement|judgment)|without (further|any)? ?explanation|without explaining|reassure them that|pacify|placate|smooth (it|things) over)\b/;
/**
 * A concrete commitment marker: an owner, a threshold, a checkpoint or a next step. Its PRESENCE is
 * what separates a legitimate short update from reassurance used to buy time.
 */
const COMMITMENT_MARKER = /\b(by |within |once |after |before |at the |each |daily|hourly|tomorrow|today|end of (day|week)|checkpoint|update at|report back|owner|i will|we will|assign|schedule a|set a|commit to|escalate|document)\b/;

/** c01 branch: "Continue to deflect questions." */
const DEFLECTION_PHRASE = /\b(deflect|deflecting|stall|stalling|dodge|dodging|evade|evading|change the subject|avoid the question)\b/;

export type IntegrityResult = { ok: boolean; errors: string[] };

/** Does the training input itself state a miss? The on-schedule rule is only about FALSE claims. */
export const factsStateAMiss = (factsText: string): boolean => FACTS_STATE_A_MISS.test(factsText.toLowerCase());

/**
 * Measured defects readable from ONE choice label.
 *
 * `factsSayMiss` is what makes the on-schedule rule truthful rather than a vocabulary ban: the same
 * label is only FALSE reassurance when the training facts say the schedule already slipped.
 */
export function detectLabelDefects(label: string, factsSayMiss: boolean): string[] {
  const out: string[] = [];
  const t = label.toLowerCase();
  if (factsSayMiss && ON_SCHEDULE_CLAIM.test(t)) out.push("false_reassurance");
  if (REASSURANCE_PHRASE.test(t) && !COMMITMENT_MARKER.test(t)) out.push("vague_reassurance");
  if (DEFLECTION_PHRASE.test(t)) out.push("deflection_without_value");
  return out;
}

/** Deterministic label + repetition checks for defects measured in ACCEPTED live output. */
export function detectMeasuredLabelDefects(draft: ArenaScenarioDraft, factsText: string): IntegrityResult {
  const errors: string[] = [];
  const factsSayMiss = factsStateAMiss(factsText);

  for (const c of enumerateChoices(draft)) errors.push(...detectLabelDefects(c.label, factsSayMiss));

  // c09: the SAME choice text offered again one phase later inside one branch.
  const branchIds = draft.primary.choices.map((p) => p.id);
  const actionSets: string[][] = [];
  for (const pid of branchIds) {
    const b = draft.branches?.[pid];
    if (!b) continue;
    const tradeoff = new Set(b.tradeoffChoices.map((c) => normalizeText(c.label)));
    const actions = b.actionDecision.choices.map((c) => normalizeText(c.label));
    if (actions.some((a) => tradeoff.has(a))) errors.push("repeated_choice_meaning_within_branch");
    actionSets.push([...actions].sort());
  }
  // Total collapse only: EVERY branch offering an identical action set. Two branches sharing one
  // label is legitimate reuse, so it is deliberately NOT caught here.
  if (actionSets.length >= 2) {
    const first = JSON.stringify(actionSets[0]);
    if (actionSets.every((s) => JSON.stringify(s) === first)) errors.push("repeated_action_meaning");
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

// ---------------------------------------------------------------------------
// Construction validation (Parts 2-3)
// ---------------------------------------------------------------------------

export type ConstructionContext = {
  constraintIds: string[];
  /** The training facts, used only by the false-reassurance rule. */
  factsText: string;
};

/**
 * Validate the provider's per-choice construction records against the scenario they describe.
 *
 * Fail-closed. This proves the STRUCTURAL contract — every choice constructed, no placeholder
 * justification, no bad-faith intent, no unknown boundary claimed, no unexplained delay, no sibling
 * group sharing one value/cost profile. Whether the stated value is genuinely worth protecting is
 * the reviewer's call.
 */
export function validateChoiceConstructions(
  draft: ArenaScenarioDraft,
  constructionsByChoiceId: unknown,
  ctx: ConstructionContext,
): IntegrityResult {
  const errors: string[] = [];
  if (typeof constructionsByChoiceId !== "object" || constructionsByChoiceId === null) {
    return { ok: false, errors: ["construction_missing"] };
  }
  const map = constructionsByChoiceId as Record<string, unknown>;
  const confirmed = new Set(ctx.constraintIds);
  const choices = enumerateChoices(draft);
  /** normalized value|cost|intent tuples per sibling group, for the duplicate-profile check. */
  const profiles = new Map<string, string[]>();

  for (const c of choices) {
    const raw = map[c.id];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      errors.push("construction_missing");
      continue;
    }
    const k = raw as Partial<ProviderChoiceConstruction>;
    const value = typeof k.legitimateValue === "string" ? k.legitimateValue : "";
    const cost = typeof k.acceptedCost === "string" ? k.acceptedCost : "";
    const intent = typeof k.competentIntent === "string" ? k.competentIntent : "";
    const action = typeof k.concreteAction === "string" ? k.concreteAction : "";
    const notDominated = typeof k.whyNotDominated === "string" ? k.whyNotDominated : "";
    const distinguishes = typeof k.distinguishesFromSibling === "string" ? k.distinguishesFromSibling : "";
    const safetyBasis = typeof k.urgencySafetyBasis === "string" ? k.urgencySafetyBasis : "";
    const boundaryIds = Array.isArray(k.boundaryCompliance) ? k.boundaryCompliance.filter((b): b is string => typeof b === "string") : [];

    // 1. A named value and a real cost. A value may be one word ("speed"); a COST is an explanation.
    if (!value.trim() || isPlaceholder(value)) errors.push("no_legitimate_value");
    if (!cost.trim() || isPlaceholder(cost)) errors.push("no_real_cost");
    else if (wordCount(cost) < 2) errors.push("no_real_cost");

    // 2. Placeholder justifications defeat the whole contract.
    if (!intent.trim() || isPlaceholder(intent) || wordCount(intent) < 3) errors.push("construction_metadata_generic");
    if (!action.trim() || isPlaceholder(action)) errors.push("construction_metadata_generic");
    if (!distinguishes.trim() || isPlaceholder(distinguishes) || wordCount(distinguishes) < 3) errors.push("construction_metadata_generic");
    // "Why not dominated" that merely echoes the label says nothing.
    if (!notDominated.trim() || isPlaceholder(notDominated)) errors.push("dominated_choice");
    else if (normalizeText(notDominated) === normalizeText(c.label)) errors.push("construction_metadata_generic");

    // 3. THE c01 DEFECT — a justification that RESTS on concealment or deflection.
    if (statesBadFaithIntent(intent)) errors.push("competent_intent_bad_faith");

    // 4. THE c01 SHAPE — metadata asserting competent intent over a measurably bad-faith label.
    if (detectLabelDefects(c.label, factsStateAMiss(ctx.factsText)).length > 0 && intent.trim() && !statesBadFaithIntent(intent)) {
      errors.push("construction_contradicts_label");
    }

    // 5. Confirmed boundaries: claimed ids must exist, and a constrained scenario must claim them.
    for (const id of boundaryIds) if (!confirmed.has(id)) errors.push("unsupported_boundary_compliance");
    if (confirmed.size > 0 && boundaryIds.length === 0) errors.push("unsupported_boundary_compliance");

    // 6. A delay needs a stated basis — the measured c18 unsafe-delay shape, at construction time.
    if ((announcesDelay(c.label) || announcesDelay(action)) && !safetyBasis.trim()) errors.push("unsupported_delay_basis");

    const key = siblingKey(c);
    const list = profiles.get(key) ?? [];
    list.push(`${normalizeText(value)}|${normalizeText(cost)}|${normalizeText(intent)}`);
    profiles.set(key, list);
  }

  // 7. Siblings sharing one value/cost/intent profile are not a choice — they are one option twice.
  for (const list of profiles.values()) {
    if (new Set(list).size !== list.length) errors.push("duplicate_value_cost_profile");
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
