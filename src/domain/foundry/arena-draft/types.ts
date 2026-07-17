/**
 * Foundry Guided Arena Builder — domain types (pure).
 *
 * The shape of a host-authored Arena PRACTICE DRAFT: two guided answers plus a
 * three-phase learner-facing scenario (PRIMARY -> TRADEOFF -> ACTION DECISION).
 *
 * This is a Foundry artifact that DESCRIBES an Arena-shaped scenario; it is NOT
 * the live Arena runtime contract (src/data/scenario, public.scenarios) and is
 * deliberately kept in Foundry's own domain so the Arena system is never modified.
 * Phase vocabulary (`primary` / `tradeoff` / `action_decision`) mirrors the Arena
 * canonical model for familiarity, but cardinality is the looser V1 draft range
 * (primary 2-4, tradeoff 2-3, action_decision 2-3) and choice ids are stable
 * free-form strings, not the runtime's fixed A/B/C/D + X/Y + AD1/AD2 enums.
 *
 * No DB, no I/O, no providers, no display strings.
 */

// ---------------------------------------------------------------------------
// Guided answers (the two questions the host actually answers)
// ---------------------------------------------------------------------------

/** Q1 — "When is this hardest to do?" Fixed option keys (UI localizes labels). */
export type HardestWhenOption =
  | "time_limited"
  | "other_resists"
  | "performance_pressure"
  | "authority_unclear"
  | "other";

export const HARDEST_WHEN_OPTIONS: readonly HardestWhenOption[] = [
  "time_limited",
  "other_resists",
  "performance_pressure",
  "authority_unclear",
  "other",
];

/**
 * Q2 seed keys — grounded avoidance-pressure suggestions. Deterministic, derived
 * from the source module (UI localizes the seed sentence). The host may pick one,
 * edit it, or write their own free text; only the final free text is stored.
 */
export type AvoidancePressureSeed =
  | "time"
  | "relationship"
  | "authority"
  | "credibility"
  | "cost"
  | "safety";

export const AVOIDANCE_PRESSURE_SEEDS: readonly AvoidancePressureSeed[] = [
  "time",
  "relationship",
  "authority",
  "credibility",
  "cost",
  "safety",
];

export function isHardestWhenOption(v: unknown): v is HardestWhenOption {
  return typeof v === "string" && (HARDEST_WHEN_OPTIONS as readonly string[]).includes(v);
}

/**
 * The two guided answers.
 *  - hardestWhen: a fixed option; `customText` REQUIRED (non-empty) only for "other".
 *  - avoidancePressure: the host's final free text (seed-derived or their own).
 */
export type GuidedAnswers = {
  hardestWhen: { choice: HardestWhenOption; customText?: string };
  avoidancePressure: { text: string };
};

// ---------------------------------------------------------------------------
// Three-phase scenario draft
// ---------------------------------------------------------------------------

/** A behavioral choice in the PRIMARY or TRADEOFF phase. Stable id + label. */
export type ScenarioDraftChoice = {
  id: string;
  label: string;
};

/**
 * An ACTION DECISION choice. `isActionCommitment` marks a real observable action
 * commitment (as opposed to waiting / preparing / observing / deferring). At least
 * one choice in the phase must be a commitment.
 */
export type ActionDecisionChoice = ScenarioDraftChoice & {
  isActionCommitment: boolean;
};

export type PrimaryPhase = {
  choices: ScenarioDraftChoice[];
};

export type TradeoffPhase = {
  escalationText: string;
  choices: ScenarioDraftChoice[];
};

export type ActionDecisionPhase = {
  prompt: string;
  choices: ActionDecisionChoice[];
};

/** The complete three-phase draft. `opening` is the realistic opening situation. */
export type ArenaScenarioDraft = {
  title: string;
  opening: string;
  primary: PrimaryPhase;
  tradeoff: TradeoffPhase;
  actionDecision: ActionDecisionPhase;
};

// ---------------------------------------------------------------------------
// Cardinality bounds (the V1 draft range — looser than the runtime enums)
// ---------------------------------------------------------------------------

export const PRIMARY_CHOICES_MIN = 2;
export const PRIMARY_CHOICES_MAX = 4;
export const TRADEOFF_CHOICES_MIN = 2;
export const TRADEOFF_CHOICES_MAX = 3;
export const ACTION_CHOICES_MIN = 2;
export const ACTION_CHOICES_MAX = 3;

// Field length bounds for learner-facing text (drafting-generous but not unbounded).
export const TITLE_MAX = 120;
export const OPENING_MAX = 1200;
export const ESCALATION_MAX = 1200;
export const ACTION_PROMPT_MAX = 600;
export const CHOICE_LABEL_MAX = 400;
