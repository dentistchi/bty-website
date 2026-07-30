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

/**
 * A primary choice id — for a branch-aware scenario it is ALSO the branch key
 * (Slice 3.2I). Free-form (Foundry does not use the canonical fixed A/B/C/D ids).
 */
export type PrimaryChoiceId = string;

/**
 * Slice 3.2I — one causal BRANCH: the reality created by a specific PRIMARY choice.
 * Mirrors the canonical `EscalationBranch` shape (src/domain/arena/scenarios/types.ts)
 * but with Foundry's free-form choice ids and looser draft cardinality. `escalationText`
 * / `tradeoffChoices` / `actionDecision` are branch-SPECIFIC — they follow from the
 * primary choice that keys this branch, not from a shared continuation.
 */
export type ScenarioBranch = {
  /** Optional plain-language "what happened because of this choice" (Manager review). */
  resultingWorldState?: string;
  escalationText: string;
  tradeoffChoices: ScenarioDraftChoice[];
  actionDecision: ActionDecisionPhase;
};

/**
 * The complete draft. `opening` is the realistic opening situation. The flat
 * `tradeoff` / `actionDecision` are the LEGACY shared continuation (kept for legacy
 * drafts and as a safe fallback). When `branches` is present (Slice 3.2I) the scenario
 * is BRANCH-AWARE: exactly one branch per primary choice id, and the runtime resolves
 * `branches[selectedPrimaryChoiceId]` instead of the shared flat continuation.
 */
export type ArenaScenarioDraft = {
  title: string;
  opening: string;
  primary: PrimaryPhase;
  tradeoff: TradeoffPhase;
  actionDecision: ActionDecisionPhase;
  /** Present → branch-aware; absent/empty → legacy flat. Keyed by primary choice id. */
  branches?: Record<PrimaryChoiceId, ScenarioBranch>;
  /**
   * Slice 3.2I-R5A — the Manager-confirmed practice boundary this scenario was generated
   * under, copied onto the scenario at generation so it rides into the immutable published
   * snapshot (audit + regeneration safety). NOT learner-facing. Provider constraint
   * assessments and semantic-review output are NEVER stored here.
   */
  practiceBoundary?: import("./boundary").PracticeBoundary;
};

/** A scenario is branch-aware iff it carries at least one branch. Pure discriminator. */
export function isBranchAware(
  draft: Pick<ArenaScenarioDraft, "branches">,
): draft is ArenaScenarioDraft & { branches: Record<PrimaryChoiceId, ScenarioBranch> } {
  return !!draft.branches && Object.keys(draft.branches).length > 0;
}

/**
 * Slice 3.2I — the learner's actual decision path through a run, stored server-side
 * (`foundry_arena_practice_runs.selected_path`) as truthful behavioral evidence. Only
 * stable choice IDs (never user-facing text, scores, or interpretation).
 */
export type SelectedPath = {
  /** Schema version discriminator for the stored JSON. */
  v: 1;
  primaryChoiceId: string;
  tradeoffChoiceId?: string;
  actionChoiceId?: string;
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
