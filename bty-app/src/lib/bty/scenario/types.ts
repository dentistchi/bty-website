export type HiddenStatKey = "integrity" | "communication" | "insight" | "resilience" | "gratitude";

export type ScenarioChoice = {
  choiceId: "A" | "B" | "C" | "D";
  label: string;
  intent: string;
  xpBase: number;
  difficulty: number; // >1 harder, <1 easier
  hiddenDelta: Partial<Record<HiddenStatKey, number>>;
  result: string;
  microInsight: string;
  followUp?: {
    enabled: boolean;
    prompt?: string;
    options?: string[];
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
  choices: ScenarioChoice[];
  coachNotes?: ScenarioCoachNotes;
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
