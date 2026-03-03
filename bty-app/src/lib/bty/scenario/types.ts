export type HiddenStatKey = "integrity" | "communication" | "insight" | "resilience" | "gratitude";

export type ScenarioChoice = {
  choiceId: "A" | "B" | "C" | "D";
  label: string;
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

export type Scenario = {
  scenarioId: string;
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
};

export type ScenarioSubmitPayload = {
  scenarioId: string;
  choiceId: "A" | "B" | "C" | "D";
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
