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
  difficulty_level: 3,
  difficulty_label: "내면 갈등, 경쟁하는 가치",
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
  escalationBranches: {
    A: {
      escalation_text:
        "환자가 팔짱을 낍니다. 당신의 명확함이 압박으로 들리고, 프론트의 ‘깜짝 비용’ 소문이 진료실에 함께 들어왔습니다.",
      pressure_increase: 0.55,
      second_choices: [
        {
          id: "X",
          label: "긴장을 직접 이름 붙이고, 자신의 이해를 바로잡아 달라고 초대한다.",
          cost: "시간과 더 부드러운 권위.",
          pattern_family: "repair_avoidance",
          direction: "entry",
        },
        {
          id: "Y",
          label: "수가 정책만 다시 고정하고 구체적 다음 단계 일정을 잡는다.",
          cost: "관계의 따뜻함(단기).",
          pattern_family: "ownership_escape",
          direction: "exit",
        },
        {
          id: "Z",
          label: "임상 설명을 잠시 멈추고 목격자와 함께 재정 대화로 넘긴다.",
          cost: "케어 연속성 서사.",
          pattern_family: "delegation_deflection",
          direction: "entry",
        },
      ],
    },
    B: {
      escalation_text:
        "환자는 ‘정책’을 외면으로 듣습니다. 구조와 냉랭함 사이의 선이 얇아지고, 스태프는 경계를 어떻게 지키는지 지켜봅니다.",
      pressure_increase: 0.62,
      second_choices: [
        {
          id: "X",
          label: "정책을 다시 말하기 전에 정서적 비용을 먼저 인정한다.",
          cost: "해결 속도로 인한 인상.",
          pattern_family: "explanation_substitution",
          direction: "entry",
        },
        {
          id: "Y",
          label: "하나의 한정된 예외 경로를 제안하고 문서화한다.",
          cost: "팀 내 선례 리스크.",
          pattern_family: "future_deferral",
          direction: "exit",
        },
        {
          id: "Z",
          label: "대화를 개인 진료실로 옮기고 속도를 늦춘다.",
          cost: "체어 타임·일정 압박.",
          pattern_family: "repair_avoidance",
          direction: "entry",
        },
      ],
    },
    C: {
      escalation_text:
        "감소 노력이 회피로 읽힙니다. 환자는 지금 약속을 원하고, 대기실 시계는 크게 들립니다.",
      pressure_increase: 0.48,
      second_choices: [
        {
          id: "X",
          label: "트레이드오프를 이름 붙이고, 그들에게 공정한 약속이 무엇인지 묻는다.",
          cost: "협상에 노출.",
          pattern_family: "ownership_escape",
          direction: "entry",
        },
        {
          id: "Y",
          label: "짧은 타이머: 지금 하나의 결정, 하나의 후속 일정.",
          cost: "경직됨으로 인한 인상.",
          pattern_family: "future_deferral",
          direction: "exit",
        },
        {
          id: "Z",
          label: "중립 제3자(예: 오피스 매니저)를 불러 다음 단계를 맞춘다.",
          cost: "조정 비용.",
          pattern_family: "delegation_deflection",
          direction: "entry",
        },
      ],
    },
  },
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
