import type { BeginnerScenario } from "./beginnerTypes";

/**
 * Beginner 7-step scenarios. One question per screen; button-based; minimal text.
 * Content aligned with user JSON (title_en, context_en, emotion_options, hidden_risk, integrity_trigger, decision_options, growth).
 */
export const BEGINNER_SCENARIOS: BeginnerScenario[] = [
  {
    scenarioId: "senior_staff_resists_new_protocol_033",
    title: "Senior Staff Resists New Protocol",
    titleKo: "시니어 스태프가 새 프로토콜에 반대한다",
    context:
      "A long-time staff member openly resists a new sterilization protocol.",
    contextKo: "오래 근무한 스태프가 새 멸균 프로토콜에 공개적으로 반대합니다.",
    emotionOptions: ["Irritated", "Threatened", "Respectful", "Calm"],
    emotionOptionsKo: ["짜증남", "위협감", "존중", "차분함"],
    hiddenRiskQuestion: "If you force compliance publicly, what happens to influence?",
    hiddenRiskQuestionKo: "공개적으로 따르게 강요하면 영향력에는 어떤 일이 생기나요?",
    riskOptions: [
      "They comply but trust drops.",
      "Others see you as fair; influence grows.",
    ],
    riskOptionsKo: [
      "따르지만 신뢰는 떨어진다.",
      "공정하다고 보며 영향력이 커진다.",
    ],
    integrityTrigger: "Assert authority vs Preserve dignity while reinforcing standards.",
    integrityTriggerKo: "권위를 세우기 vs 존엄을 지키며 기준을 강화하기.",
    integrityOptions: ["Assert authority", "Preserve dignity, reinforce standards"],
    integrityOptionsKo: ["권위를 세우기", "존엄 지키고 기준 강화하기"],
    decisionOptions: [
      { id: "A", label: "Correct them in front of the team." },
      { id: "B", label: "Speak privately and understand their concern." },
      { id: "C", label: "Delay the implementation." },
    ],
    decisionOptionsKo: [
      { id: "A", label: "팀 앞에서 바로잡는다." },
      { id: "B", label: "사적으로 말하고 걱정을 듣는다." },
      { id: "C", label: "시행을 미룬다." },
    ],
    growth: "Standards last longer when dignity is preserved.",
    growthKo: "존엄이 지켜질 때 기준이 오래 유지돼요.",
  },
  {
    scenarioId: "patient_leaves_negative_review_034",
    title: "Patient Leaves a Negative Online Review",
    titleKo: "환자가 부정적인 온라인 리뷰를 남긴다",
    context: "You discover a harsh online review criticizing your professionalism.",
    contextKo: "당신의 전문성을 비난하는 거친 온라인 리뷰를 발견합니다.",
    emotionOptions: ["Angry", "Embarrassed", "Calm", "Defensive"],
    emotionOptionsKo: ["화남", "당혹", "차분함", "방어적"],
    hiddenRiskQuestion: "If you react publicly with emotion, what happens to credibility?",
    hiddenRiskQuestionKo: "감정적으로 공개 반응하면 신뢰도에는 어떤 일이 생기나요?",
    riskOptions: [
      "Readers may side with the patient; credibility drops.",
      "A calm reply can protect trust.",
    ],
    riskOptionsKo: [
      "독자가 환자 편을 들 수 있고, 신뢰도가 떨어진다.",
      "차분한 답변이 신뢰를 지킬 수 있다.",
    ],
    integrityTrigger: "Defend reputation vs Respond with composure.",
    integrityTriggerKo: "평판 지키기 vs 침착하게 대응하기.",
    integrityOptions: ["Defend reputation", "Respond with composure"],
    integrityOptionsKo: ["평판 지키기", "침착하게 대응하기"],
    decisionOptions: [
      { id: "A", label: "Respond aggressively." },
      { id: "B", label: "Respond calmly and invite discussion offline." },
      { id: "C", label: "Ignore the review." },
    ],
    decisionOptionsKo: [
      { id: "A", label: "공격적으로 답한다." },
      { id: "B", label: "차분히 답하고 오프라인 논의를 제안한다." },
      { id: "C", label: "리뷰를 무시한다." },
    ],
    growth: "Reputation grows when ego shrinks.",
    growthKo: "자아가 줄어들 때 평판이 자란다.",
  },
  {
    scenarioId: "you_feel_compared_to_another_doctor_035",
    title: "You Feel Compared to Another Doctor",
    titleKo: "다른 의사와 비교당하는 느낌",
    context: "A patient says they prefer another doctor in your office.",
    contextKo: "환자가 당신 오피스의 다른 의사를 선호한다고 말합니다.",
    emotionOptions: ["Insecure", "Competitive", "Calm", "Resentful"],
    emotionOptionsKo: ["불안", "경쟁심", "차분함", "서운함"],
    hiddenRiskQuestion: "If comparison drives you, what happens to confidence?",
    hiddenRiskQuestionKo: "비교가 당신을 움직이게 하면 자신감에는 어떤 일이 생기나요?",
    riskOptions: [
      "You may act defensively; relationship suffers.",
      "Focusing on growth keeps you steady.",
    ],
    riskOptionsKo: [
      "방어적으로 행동할 수 있고, 관계가 손상된다.",
      "성장에 집중하면 흔들리지 않는다.",
    ],
    integrityTrigger: "Compete internally vs Focus on your own growth.",
    integrityTriggerKo: "내적으로 경쟁하기 vs 자기 성장에 집중하기.",
    integrityOptions: ["Compete internally", "Focus on your own growth"],
    integrityOptionsKo: ["내적으로 경쟁하기", "자기 성장에 집중하기"],
    decisionOptions: [
      { id: "A", label: "Criticize the other doctor subtly." },
      { id: "B", label: "Respect the patient's preference professionally." },
      { id: "C", label: "Withdraw emotionally." },
    ],
    decisionOptionsKo: [
      { id: "A", label: "다른 의사를 은근히 비난한다." },
      { id: "B", label: "환자의 선호를 전문적으로 존중한다." },
      { id: "C", label: "감정적으로 물러난다." },
    ],
    growth: "Maturity chooses growth over comparison.",
    growthKo: "성숙은 비교보다 성장을 선택해요.",
  },
  {
    scenarioId: "patient_challenges_fee_032",
    title: "Patient Challenges Your Fee",
    titleKo: "환자가 진료비에 이의를 제기한다",
    context: "A patient compares your fees to a cheaper clinic.",
    contextKo: "환자가 당신 진료비를 더 싼 클리닉과 비교합니다.",
    emotionOptions: ["Insecure", "Confident", "Annoyed", "Neutral"],
    emotionOptionsKo: ["불안", "자신감", "짜증", "중립"],
    hiddenRiskQuestion: "If you defend aggressively, what happens to value perception?",
    hiddenRiskQuestionKo: "공격적으로 방어하면 가치 인식에는 어떤 일이 생기나요?",
    riskOptions: [
      "They may feel unheard; trust drops.",
      "Calm explanation of value protects the relationship.",
    ],
    riskOptionsKo: [
      "못 들은 느낌에 신뢰가 떨어진다.",
      "차분한 가치 설명이 관계를 지킨다.",
    ],
    integrityTrigger: "Compete on price vs Communicate value.",
    integrityTriggerKo: "가격으로 경쟁하기 vs 가치를 전달하기.",
    integrityOptions: ["Compete on price", "Communicate value"],
    integrityOptionsKo: ["가격으로 맞서기", "가치 전달하기"],
    decisionOptions: [
      { id: "A", label: "Match competitor price." },
      { id: "B", label: "Explain quality differences calmly." },
      { id: "C", label: "Dismiss their concern." },
    ],
    decisionOptionsKo: [
      { id: "A", label: "경쟁 클리닉 가격에 맞춘다." },
      { id: "B", label: "품질 차이를 차분히 설명한다." },
      { id: "C", label: "걱정을 무시한다." },
    ],
    growth: "Value must be communicated, not defended.",
    growthKo: "가치는 방어가 아니라 전달돼야 해요.",
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
