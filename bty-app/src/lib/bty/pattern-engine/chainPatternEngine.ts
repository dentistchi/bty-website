/**
 * Chain workspace pattern engine: aggregates archetype + state_impact across
 * completed chains (after 3 chains × 3 choices). Pure domain — no I/O.
 */

import type { Archetype, StateImpact } from "@/lib/bty/scenario-node-validator";

export type ChainChoiceRecord = {
  archetype: Archetype;
  state_impact: StateImpact;
};

export type ArchetypeCounts = Record<Archetype, number>;

/** Per-axis totals across choices (sums; not limited to single-step deltas). */
export type SummedStateImpact = {
  reputation: number;
  trust: number;
  self_narrative: number;
  courage: number;
};

export type PatternState = {
  archetypeCounts: ArchetypeCounts;
  summedImpact: SummedStateImpact;
  choiceCount: number;
};

export type PatternTriggers = {
  /** A: any archetype appears at least 4 times across all collected choices. */
  repetition: boolean;
  /** B: trust, courage, or self_narrative sum <= -3. */
  negativeDrift: boolean;
  /** C: avoid >> confront OR confront >> structure (see SIGNIFICANT_GAP). */
  imbalance: boolean;
  /** A ∧ B — opens intervention action contract + QR (only this path uses QR). */
  interventionQr: boolean;
  /** A ∧ C ∧ ¬B — reflective balance copy only; no contract / QR flow. */
  stretchPrompt: boolean;
};

/** Minimum count difference for "significantly higher" (imbalance C). */
export const CHAIN_PATTERN_SIGNIFICANT_GAP = 2;

export type ActionContractAnswers = {
  who: string;
  what: string;
  when: string;
  how: string;
};

function emptySummedImpact(): SummedStateImpact {
  return { reputation: 0, trust: 0, self_narrative: 0, courage: 0 };
}

export function emptyArchetypeCounts(): ArchetypeCounts {
  return { avoid: 0, structure: 0, confront: 0 };
}

export function buildPatternState(choices: ChainChoiceRecord[]): PatternState {
  const archetypeCounts = emptyArchetypeCounts();
  const summedImpact = emptySummedImpact();

  for (const c of choices) {
    archetypeCounts[c.archetype] += 1;
    summedImpact.reputation += c.state_impact.reputation;
    summedImpact.trust += c.state_impact.trust;
    summedImpact.self_narrative += c.state_impact.self_narrative;
    summedImpact.courage += c.state_impact.courage;
  }

  return {
    archetypeCounts,
    summedImpact,
    choiceCount: choices.length,
  };
}

export function detectPatternTriggers(state: PatternState): PatternTriggers {
  const { avoid, structure, confront } = state.archetypeCounts;
  const maxArchetypeCount = Math.max(avoid, structure, confront);
  const repetition = maxArchetypeCount >= 4;

  const { trust, courage, self_narrative } = state.summedImpact;
  const negativeDrift =
    trust <= -3 || courage <= -3 || self_narrative <= -3;

  const imbalance =
    avoid - confront >= CHAIN_PATTERN_SIGNIFICANT_GAP ||
    confront - structure >= CHAIN_PATTERN_SIGNIFICANT_GAP;

  const interventionQr = repetition && negativeDrift;
  const stretchPrompt = repetition && imbalance && !negativeDrift;

  return { repetition, negativeDrift, imbalance, interventionQr, stretchPrompt };
}

type DrainedAxis = "trust" | "courage" | "self_narrative" | "reputation" | null;

function mostDrainedAxis(sum: SummedStateImpact): DrainedAxis {
  const entries: [DrainedAxis, number][] = [
    ["trust", sum.trust],
    ["courage", sum.courage],
    ["self_narrative", sum.self_narrative],
    ["reputation", sum.reputation],
  ];
  let best: DrainedAxis = null;
  let min = 0;
  for (const [axis, v] of entries) {
    if (v < min) {
      min = v;
      best = axis;
    }
  }
  return best;
}

function dominantArchetype(counts: ArchetypeCounts): Archetype | "balanced" {
  const order: Archetype[] = ["avoid", "structure", "confront"];
  let max = -1;
  for (const a of order) {
    max = Math.max(max, counts[a]);
  }
  const leaders = order.filter((a) => counts[a] === max);
  if (leaders.length !== 1) return "balanced";
  return leaders[0]!;
}

/**
 * Short, observational copy — no praise/blame; describes tendency + aggregate state movement.
 */
export function generateChainPatternInsight(
  state: PatternState,
  triggers: PatternTriggers,
): string {
  const dom = dominantArchetype(state.archetypeCounts);
  const drained = mostDrainedAxis(state.summedImpact);
  const { summedImpact: s } = state;

  if (dom === "avoid" && drained === "trust") {
    return "You tend to close situations quickly at the cost of trust.";
  }
  if (dom === "confront" && drained === "reputation") {
    return "You face tension directly, even when it damages your standing.";
  }
  if (dom === "avoid" && drained === "courage") {
    return "You often contain or exit tension; courage shows the steepest downward shift in aggregate.";
  }
  if (dom === "avoid" && drained === "self_narrative") {
    return "You often limit exposure under pressure; how you read yourself shifts downward across these choices.";
  }
  if (dom === "confront" && drained === "trust") {
    return "You move toward conflict; trust accumulates the largest negative movement here.";
  }
  if (dom === "confront" && drained === "self_narrative") {
    return "You meet friction head-on; your internal story tightens or dips most in the totals.";
  }
  if (dom === "structure" && drained === "trust") {
    return "You reach for process and clarity; trust still drifts down in the combined picture.";
  }
  if (dom === "structure") {
    return "You often stabilize situations through structure, rules, or explicit next steps.";
  }
  if (dom === "avoid") {
    return "You often reduce immediate exposure or defer the hardest part of the exchange.";
  }
  if (dom === "confront") {
    return "You often stay in the tension instead of buffering or postponing it.";
  }

  if (triggers.repetition) {
    return "One response style shows up repeatedly across these chains.";
  }
  if (s.trust + s.courage + s.self_narrative + s.reputation === 0) {
    return "Choices were mixed; combined state shifts stay near neutral.";
  }
  if (drained === "trust") {
    return "Across these choices, trust moves down the most in aggregate.";
  }
  if (drained === "courage") {
    return "Across these choices, courage moves down the most in aggregate.";
  }
  if (drained === "self_narrative") {
    return "Across these choices, self-narrative moves down the most in aggregate.";
  }
  return "Your responses blend different moves; no single line dominates the totals.";
}

/**
 * Short balance-oriented line when stretchPrompt fires (repetition + imbalance, no negative drift).
 */
export function generateStretchBalanceMessage(state: PatternState): string {
  const { avoid, confront, structure } = state.archetypeCounts;
  if (avoid - confront >= CHAIN_PATTERN_SIGNIFICANT_GAP) {
    return "You leaned on containment or distance often here, while the summed shifts stayed relatively steady. In upcoming chains, try letting one beat go through structure or directness—not to correct yourself, just to widen the range you practice.";
  }
  if (confront - structure >= CHAIN_PATTERN_SIGNIFICANT_GAP) {
    return "You moved toward tension often here with less use of explicit structure. Next time, try anchoring one exchange with a clear frame or next step—lightly, to balance how you show up.";
  }
  return "One response style dominated these chains while drift stayed mild. Consider rehearsing a different lever once—structure, containment, or directness—so your defaults stay movable.";
}

const CONTRACT_SCHEME = "bty://contract";

/**
 * Encodes the action contract as a single URI string (QR payload compatible).
 */
export function encodeActionContractQrUri(answers: ActionContractAnswers): string {
  const q = new URLSearchParams({
    who: answers.who.trim(),
    what: answers.what.trim(),
    when: answers.when.trim(),
    how: answers.how.trim(),
  });
  return `${CONTRACT_SCHEME}?${q.toString()}`;
}

export function parseActionContractQrUri(uri: string): ActionContractAnswers | null {
  const trimmed = uri.trim();
  if (!trimmed.startsWith(CONTRACT_SCHEME + "?")) return null;
  const qs = trimmed.slice((CONTRACT_SCHEME + "?").length);
  const params = new URLSearchParams(qs);
  const who = params.get("who") ?? "";
  const what = params.get("what") ?? "";
  const when = params.get("when") ?? "";
  const how = params.get("how") ?? "";
  if (!who && !what && !when && !how) return null;
  return { who, what, when, how };
}
