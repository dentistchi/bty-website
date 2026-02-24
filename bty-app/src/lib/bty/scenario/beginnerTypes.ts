/**
 * Beginner reflection flow: one question per screen, button-based, minimal text.
 * Used for 7-step flow: Context → Emotion → Risk → Integrity → Decision → Growth → Reflection.
 */

export type BeginnerScenario = {
  scenarioId: string;
  title: string;
  context: string;
  /** Step 2: 4 emotion options (order = display; scoring by index) */
  emotionOptions: [string, string, string, string];
  /** Step 3: question + 2–3 risk options */
  hiddenRiskQuestion: string;
  riskOptions: [string, string] | [string, string, string];
  /** Step 4: label for the tension + 2 options */
  integrityTrigger: string;
  integrityOptions: [string, string];
  /** Step 5: 3 decision options (order = display; scoring by index) */
  decisionOptions: [{ id: string; label: string }, { id: string; label: string }, { id: string; label: string }];
  /** Step 6: short growth message (max 2 sentences) */
  growth: string;
};

/** Stored step responses for scoring and analytics */
export type BeginnerRunResponses = {
  emotionIndex: number;       // 0–3
  riskIndex: number;         // 0–1 or 0–2
  integrityIndex: number;     // 0 or 1
  decisionIndex: number;     // 0–2
  reflectionText: string | null;
};

/** Maturity score bands for feedback */
export const MATURITY_BANDS = {
  reactive:  { min: 0,  max: 8,  label: "Reactive",  messageKey: "reactive" },
  aware:     { min: 9,  max: 14, label: "Aware",     messageKey: "aware" },
  intentional: { min: 15, max: 20, label: "Intentional", messageKey: "intentional" },
} as const;

/** Point values per step (max 20 total) */
export const BEGINNER_SCORING = {
  emotion:   [0, 1, 2, 4] as const,   // 4 options -> 0–4 pts
  risk:      (length: 2 | 3) => (length === 2 ? [0, 3] as const : [0, 1, 3] as const),
  integrity: [0, 5] as const,         // 2 options -> 0 or 5 pts
  decision:  [0, 3, 5] as const,      // 3 options -> 0–5 pts
  reflection: 3,                      // +3 if submitted
} as const;

export function computeBeginnerMaturityScore(
  responses: BeginnerRunResponses,
  riskOptionsLength: 2 | 3 = 2
): number {
  const emotionPts = BEGINNER_SCORING.emotion[responses.emotionIndex] ?? 0;
  const riskScores = BEGINNER_SCORING.risk(riskOptionsLength);
  const riskPts = riskScores[responses.riskIndex] ?? 0;
  const integrityPts = BEGINNER_SCORING.integrity[responses.integrityIndex] ?? 0;
  const decisionPts = BEGINNER_SCORING.decision[responses.decisionIndex] ?? 0;
  const reflectionPts = responses.reflectionText?.trim() ? BEGINNER_SCORING.reflection : 0;
  return emotionPts + riskPts + integrityPts + decisionPts + reflectionPts;
}

export type MaturityFeedback = {
  band: "reactive" | "aware" | "intentional";
  label: string;
  message: string;
};

export function getMaturityFeedback(score: number): MaturityFeedback {
  if (score >= MATURITY_BANDS.intentional.min) {
    return {
      band: "intentional",
      label: MATURITY_BANDS.intentional.label,
      message: "You're choosing with clarity. Trust builds when you act from here.",
    };
  }
  if (score >= MATURITY_BANDS.aware.min) {
    return {
      band: "aware",
      label: MATURITY_BANDS.aware.label,
      message: "You're noticing what's at stake. Keep linking choices to outcomes.",
    };
  }
  return {
    band: "reactive",
    label: MATURITY_BANDS.reactive.label,
    message: "You're reacting in the moment. Small pauses before acting can help.",
  };
}
