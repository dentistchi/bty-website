/**
 * Arena mission scenario — data contract for Lobby / Play / Resolve.
 * UI renders from this shape only; no duplicate business copy in components.
 */

export type HiddenStat =
  | "Integrity"
  | "Communication"
  | "Insight"
  | "Resilience"
  | "Gratitude";

export type ScenarioDifficulty = "Low" | "Moderate" | "High";

/** Runtime difficulty tier (1–5); optional on legacy scenarios. */
export type ArenaDifficultyLevel = 1 | 2 | 3 | 4 | 5;

export type SecondChoice = {
  id: string;
  label: string;
  /** Required — empty string is invalid content. */
  cost: string;
  pattern_family?: string;
  direction: "entry" | "exit";
};

export type EscalationBranch = {
  escalation_text: string;
  /** 0.0–1.0 — how much harder the situation became after the primary choice. */
  pressure_increase: number;
  second_choices: SecondChoice[];
};

export type PrimaryChoice = {
  id: string;
  label: string; // A / B / C
  title: string;
  subtitle?: string;
};

export type ReinforcementChoice = {
  id: string;
  label: string; // X / Y
  title: string;
};

/** Relational vs operational emphasis + regulation — internal only. */
export type ArenaOutcomeMeta = {
  relationalBias: number;
  operationalBias: number;
  emotionalRegulation: number;
};

export type ResolveOutcome = {
  interpretation: string[];
  activatedStats: HiddenStat[];
  systemMessage: string;
  /** 0–1 weights keyed by `HiddenStat` — signal pipeline / My Page metrics. */
  traits?: Partial<Record<HiddenStat, number>>;
  meta?: ArenaOutcomeMeta;
};

export type ArenaScenario = {
  id: string;
  stage: string;
  caseTag: string;
  title: string;
  difficulty: ScenarioDifficulty;
  description: string[];
  primaryChoices: PrimaryChoice[];
  reinforcementChoices: ReinforcementChoice[];
  /** Keys like A_X, A_Y — primary id + "_" + reinforcement id */
  outcomes: Record<string, ResolveOutcome>;
  /** Runtime tier; optional until all payloads carry it. */
  difficulty_level?: ArenaDifficultyLevel;
  /**
   * Optional human-readable difficulty label (e.g. for UI). Distinct from `difficulty` (`Low` | `Moderate` | `High`).
   */
  difficulty_label?: string;
  /**
   * Post–primary-choice escalation: keyed by primary choice id (e.g. `A`); drives step 3–4 flow when present.
   */
  escalationBranches?: Record<string, EscalationBranch>;
};

/** Fixed five — UI shows monograms only; no numeric values. */
export const ARENA_HIDDEN_STAT_ORDER: readonly HiddenStat[] = [
  "Integrity",
  "Communication",
  "Insight",
  "Resilience",
  "Gratitude",
];

/** 1+1 choice model: outcome key from stored primary/reinforcement ids */
export function getArenaOutcomeKey(primaryId: string, reinforcementId: string): string {
  return `${primaryId}_${reinforcementId}`;
}

export function getArenaOutcome(
  scenario: ArenaScenario,
  primaryId: string,
  reinforcementId: string,
): ResolveOutcome | null {
  const key = getArenaOutcomeKey(primaryId, reinforcementId);
  return scenario.outcomes[key] ?? null;
}
