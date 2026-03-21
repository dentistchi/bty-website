import type { ArenaScenario, HiddenStat } from "./types";

/** Must match `MOCK_SCENARIO_ID` in `mockScenario.ts`. */
const PATIENT_COMPLAINT_SCENARIO_ID = "patient-complaint-revised-estimate" as const;

/**
 * Korean copy for the mission prototype scenario — same ids/outcome keys as EN.
 * Loaded when route locale is `ko` (see `getScenarioById`).
 */
export const patientComplaintScenarioKo: ArenaScenario = {
  id: PATIENT_COMPLAINT_SCENARIO_ID,
  stage: "스테이지 1: 포지",
  caseTag: "환자 신뢰",
  title: "환자 불만: 수정된 견적",
  difficulty: "Moderate",
  description: [
    "환자는 최종 견적이 이전에 설명된 것보다 높다고 느낍니다.",
    "프론트와 진료실 설명이 맞지 않습니다.",
    "신뢰가 더 떨어지기 전에 응답해야 합니다.",
  ],
  primaryChoices: [
    {
      id: "A",
      label: "A",
      title: "수정된 치료 근거를 명확히 하고 먼저 신뢰를 회복한다.",
      subtitle: "정책을 강조하기 전에 설명부터 바로잡는다.",
    },
    {
      id: "B",
      label: "B",
      title: "사무 정책과 수가 구조로 대화의 초점을 다시 맞춘다.",
      subtitle: "압박 속에서도 프로세스 일관성을 지킨다.",
    },
    {
      id: "C",
      label: "C",
      title: "먼저 감정을 가라앉히고 집중 후속 일정을 잡는다.",
      subtitle: "세부 수정 전에 정서적 열기를 낮춘다.",
    },
  ],
  reinforcementChoices: [
    {
      id: "X",
      label: "X",
      title: "장기 관계 안정성을 우선한다.",
    },
    {
      id: "Y",
      label: "Y",
      title: "즉각적인 운영 일관성을 우선한다.",
    },
  ],
  outcomes: {
    A_X: {
      interpretation: [
        "압박 속에서 관계 안정화가 감지되었습니다.",
        "정책 방어에 앞서 설명의 명확성이 우선되었습니다.",
        "신뢰 회복 경로는 아직 열려 있습니다.",
      ],
      activatedStats: ["Communication", "Integrity"] satisfies HiddenStat[],
      systemMessage: "시스템 // 관계 안정이 우선 처리되었습니다.",
      traits: {
        Communication: 0.82,
        Integrity: 0.74,
        Insight: 0.62,
      },
      meta: {
        relationalBias: 0.9,
        operationalBias: 0.22,
        emotionalRegulation: 0.72,
      },
    },
    A_Y: {
      interpretation: [
        "운영 프레이밍이 있는 통제된 설명이 감지되었습니다.",
        "구조적 명확성을 유지하면서 신뢰가 보존되었습니다.",
        "관계적 마찰은 관리 가능한 수준입니다.",
      ],
      activatedStats: ["Communication", "Insight"] satisfies HiddenStat[],
      systemMessage: "시스템 // 긴장 속에서도 운영 일관성이 유지되었습니다.",
      traits: {
        Communication: 0.78,
        Insight: 0.76,
        Integrity: 0.58,
      },
      meta: {
        relationalBias: 0.55,
        operationalBias: 0.68,
        emotionalRegulation: 0.65,
      },
    },
    B_X: {
      interpretation: [
        "정책 우선 억제와 완화된 관계 의도가 감지되었습니다.",
        "프로세스 명확성은 유지되었으나 정서적 신뢰 회복은 부분적입니다.",
        "관계 회복은 가능하나 지연될 수 있습니다.",
      ],
      activatedStats: ["Integrity", "Resilience"] satisfies HiddenStat[],
      systemMessage: "시스템 // 압박 속에서 정책 명확성이 유지되었습니다.",
      traits: {
        Integrity: 0.8,
        Resilience: 0.7,
        Communication: 0.48,
      },
      meta: {
        relationalBias: 0.52,
        operationalBias: 0.72,
        emotionalRegulation: 0.58,
      },
    },
    B_Y: {
      interpretation: [
        "강한 운영 고정이 감지되었습니다.",
        "즉각적 일관성은 지켜졌으나 관계적 유연성은 좁아졌습니다.",
        "당장의 확대 위험은 억제된 상태입니다.",
      ],
      activatedStats: ["Integrity", "Insight"] satisfies HiddenStat[],
      systemMessage: "시스템 // 운영 경계가 강화되었습니다.",
      traits: {
        Integrity: 0.85,
        Insight: 0.72,
        Resilience: 0.55,
      },
      meta: {
        relationalBias: 0.35,
        operationalBias: 0.88,
        emotionalRegulation: 0.6,
      },
    },
    C_X: {
      interpretation: [
        "구조적 수정 전에 정서적 완화가 감지되었습니다.",
        "즉각적 긴장이 낮아져 신뢰 여지가 보존되었습니다.",
        "해결 경로는 열려 있으나 후속 이행이 필요합니다.",
      ],
      activatedStats: ["Resilience", "Communication"] satisfies HiddenStat[],
      systemMessage: "시스템 // 관계 단절 없이 정서적 압력이 완화되었습니다.",
      traits: {
        Resilience: 0.84,
        Communication: 0.7,
        Gratitude: 0.55,
      },
      meta: {
        relationalBias: 0.78,
        operationalBias: 0.4,
        emotionalRegulation: 0.8,
      },
    },
    C_Y: {
      interpretation: [
        "운영 재정비를 위한 통제된 지연이 감지되었습니다.",
        "절차적 질서를 유지하며 긴장이 낮아졌습니다.",
        "안정성은 두 번째 대화에서 판가름납니다.",
      ],
      activatedStats: ["Resilience", "Insight"] satisfies HiddenStat[],
      systemMessage: "시스템 // 구조적 후속을 앞두고 긴장이 관리되었습니다.",
      traits: {
        Resilience: 0.76,
        Insight: 0.68,
        Communication: 0.52,
      },
      meta: {
        relationalBias: 0.48,
        operationalBias: 0.75,
        emotionalRegulation: 0.7,
      },
    },
  },
};
