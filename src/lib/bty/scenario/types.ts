import type {
  ActionDecisionBlock,
  ActionDecisionChoice,
  EscalationBranch,
  SecondChoice,
} from "@/domain/arena/scenarios/types";

export type HiddenStatKey = "integrity" | "communication" | "insight" | "resilience" | "gratitude";

export type { ActionDecisionBlock, ActionDecisionChoice, EscalationBranch, SecondChoice };

export type ScenarioChoice = {
  choiceId: "A" | "B" | "C" | "D";
  /** Canonical id for Supabase / behavioral engine (JSON binding layer). */
  dbChoiceId?: string;
  label: string;
  /** Elite v2: optional subcopy from `primaryChoices[].subtext` in bundled JSON (Step 2 only). */
  choiceSubtext?: string;
  /** Korean choice label. When locale is ko, used instead of label. */
  labelKo?: string;
  intent: string;
  xpBase: number;
  difficulty: number; // >1 harder, <1 easier
  hiddenDelta: Partial<Record<HiddenStatKey, number>>;
  result: string;
  /** Korean result text. When locale is ko, used instead of result. */
  resultKo?: string;
  microInsight: string;
  /** Korean microInsight. When locale is ko, used instead of microInsight. */
  microInsightKo?: string;
  followUp?: {
    enabled: boolean;
    prompt?: string;
    /** Korean follow-up prompt. */
    promptKo?: string;
    options?: string[];
    /** Korean follow-up option texts (same order as options). */
    optionsKo?: string[];
  };
};

export type ScenarioCoachNotes = {
  whatThisTrains: HiddenStatKey[];
  whyItMatters: string;
};

/** Canonical elite (`bty_elite_scenarios.json`) — structured setup; do not flatten internals into `context`. */
export type EliteScenarioSetup = {
  role: string;
  pressure: string;
  tradeoff: string;
};

export type Scenario = {
  scenarioId: string;
  /** Canonical id aligned with `arena_runs.scenario_id` / behavioral catalog. */
  dbScenarioId?: string;
  title: string;
  context: string;
  /** Korean title (optional). When locale is ko, used instead of title. */
  titleKo?: string;
  /** Korean context (optional). When locale is ko, used instead of context. */
  contextKo?: string;
  choices: ScenarioChoice[];
  coachNotes?: ScenarioCoachNotes;
  /** If set, only users with tier >= this value can get this scenario (e.g. 75 = Elite / Tier 75+). */
  minTier?: number;
  /** If true, only Elite (top 5% weekly) users can access. ELITE_4TH_SPECIAL_OR_UNLOCK_1PAGE §3. */
  elite_only?: boolean;
  /**
   * When set (canonical elite), `/bty-arena` renders structured setup instead of a single `context` blob.
   * `context` remains narrative text for APIs/DB mirror (role + pressure + tradeoff only).
   */
  eliteSetup?: EliteScenarioSetup;
  /** Optional escalation path after primary choice (steps 3–4); see `POST /api/arena/run/step`. */
  escalationBranches?: Record<string, EscalationBranch>;
  /** Runtime tier (1–5); optional until all payloads carry it. */
  difficulty_level?: 1 | 2 | 3 | 4 | 5;
  /** Present when payload originated from chain JSON projection (session router snapshot). */
  source?: "json";
};

export type ScenarioSubmitPayload = {
  scenarioId: string;
  choiceId: "A" | "B" | "C" | "D";
  /** When "ko", result/microInsight/followUp in response use Ko fields. */
  locale?: "ko" | "en";
  // MVP: 유저 식별/저장 없이 결과만 리턴. 나중에 세션 유저 붙임.
};

export type ScenarioSubmitResult = {
  ok: true;
  scenarioId: string;
  choiceId: "A" | "B" | "C" | "D";
  xpEarned: number;
  hiddenDelta: Partial<Record<HiddenStatKey, number>>;
  microInsight: string;
  result: string;
  followUp?: ScenarioChoice["followUp"];
};
