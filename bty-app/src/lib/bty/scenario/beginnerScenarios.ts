import type { BeginnerScenario } from "./beginnerTypes";

/**
 * Beginner 7-step scenarios. One question per screen; button-based; minimal text.
 * Content aligned with user JSON (title_en, context_en, emotion_options, hidden_risk, integrity_trigger, decision_options, growth).
 */
export const BEGINNER_SCENARIOS: BeginnerScenario[] = [
  {
    scenarioId: "senior_staff_resists_new_protocol_033",
    title: "Senior Staff Resists New Protocol",
    context:
      "A long-time staff member openly resists a new sterilization protocol.",
    emotionOptions: ["Irritated", "Threatened", "Respectful", "Calm"],
    hiddenRiskQuestion: "If you force compliance publicly, what happens to influence?",
    riskOptions: [
      "They comply but trust drops.",
      "Others see you as fair; influence grows.",
    ],
    integrityTrigger: "Assert authority vs Preserve dignity while reinforcing standards.",
    integrityOptions: ["Assert authority", "Preserve dignity, reinforce standards"],
    decisionOptions: [
      { id: "A", label: "Correct them in front of the team." },
      { id: "B", label: "Speak privately and understand their concern." },
      { id: "C", label: "Delay the implementation." },
    ],
    growth: "Standards last longer when dignity is preserved.",
  },
  {
    scenarioId: "patient_leaves_negative_review_034",
    title: "Patient Leaves a Negative Online Review",
    context: "You discover a harsh online review criticizing your professionalism.",
    emotionOptions: ["Angry", "Embarrassed", "Calm", "Defensive"],
    hiddenRiskQuestion: "If you react publicly with emotion, what happens to credibility?",
    riskOptions: [
      "Readers may side with the patient; credibility drops.",
      "A calm reply can protect trust.",
    ],
    integrityTrigger: "Defend reputation vs Respond with composure.",
    integrityOptions: ["Defend reputation", "Respond with composure"],
    decisionOptions: [
      { id: "A", label: "Respond aggressively." },
      { id: "B", label: "Respond calmly and invite discussion offline." },
      { id: "C", label: "Ignore the review." },
    ],
    growth: "Reputation grows when ego shrinks.",
  },
  {
    scenarioId: "you_feel_compared_to_another_doctor_035",
    title: "You Feel Compared to Another Doctor",
    context: "A patient says they prefer another doctor in your office.",
    emotionOptions: ["Insecure", "Competitive", "Calm", "Resentful"],
    hiddenRiskQuestion: "If comparison drives you, what happens to confidence?",
    riskOptions: [
      "You may act defensively; relationship suffers.",
      "Focusing on growth keeps you steady.",
    ],
    integrityTrigger: "Compete internally vs Focus on your own growth.",
    integrityOptions: ["Compete internally", "Focus on your own growth"],
    decisionOptions: [
      { id: "A", label: "Criticize the other doctor subtly." },
      { id: "B", label: "Respect the patient's preference professionally." },
      { id: "C", label: "Withdraw emotionally." },
    ],
    growth: "Maturity chooses growth over comparison.",
  },
  {
    scenarioId: "patient_challenges_fee_032",
    title: "Patient Challenges Your Fee",
    context: "A patient compares your fees to a cheaper clinic.",
    emotionOptions: ["Insecure", "Confident", "Annoyed", "Neutral"],
    hiddenRiskQuestion: "If you defend aggressively, what happens to value perception?",
    riskOptions: [
      "They may feel unheard; trust drops.",
      "Calm explanation of value protects the relationship.",
    ],
    integrityTrigger: "Compete on price vs Communicate value.",
    integrityOptions: ["Compete on price", "Communicate value"],
    decisionOptions: [
      { id: "A", label: "Match competitor price." },
      { id: "B", label: "Explain quality differences calmly." },
      { id: "C", label: "Dismiss their concern." },
    ],
    growth: "Value must be communicated, not defended.",
  },
];

export function getBeginnerScenarioById(scenarioId: string): BeginnerScenario | undefined {
  return BEGINNER_SCENARIOS.find((s) => s.scenarioId === scenarioId);
}

export function pickRandomBeginnerScenario(excludeId?: string): BeginnerScenario {
  const pool = excludeId
    ? BEGINNER_SCENARIOS.filter((s) => s.scenarioId !== excludeId)
    : BEGINNER_SCENARIOS;
  const arr = pool.length > 0 ? pool : BEGINNER_SCENARIOS;
  return arr[Math.floor(Math.random() * arr.length)];
}
