import type { Scenario } from "./types";

/**
 * ✅ MVP 원칙
 * - 시나리오 콘텐츠는 코드에 상수로 둔다 (DB 없이)
 * - 나중에 DB/콘텐츠 CMS로 옮겨도 엔진/타입은 그대로 재사용
 */
export const SCENARIOS: Scenario[] = [
  // 1) 직원 갈등 시나리오 (사용자 제공 JSON 기반)
  {
    scenarioId: "conflict_staff_001",
    title: "침묵의 진료실: 에이스의 항명",
    context:
      "치과 내 매출의 40%를 담당하는 수석 치과위생사 '민지'가 최근 후배 교육 방식을 두고 당신에게 정면으로 불만을 제기했습니다. 그녀는 '원장님은 현장의 고충도 모르면서 원칙만 강조하신다'며 동료들 앞에서 차갑게 반응한 뒤, 현재 업무 지시를 최소한으로만 이행하고 있습니다. 진료실 분위기는 눈에 띄게 냉랭해졌고, 다른 직원들도 민지의 눈치를 보며 업무 효율이 급격히 떨어지는 중입니다. 오늘은 민지와 정기 면담이 예정된 날입니다. 그녀는 면담실에 앉아 시선을 피한 채 '할 말 없으니 빨리 끝내달라'고 말합니다. 리더로서 당신은 이 냉기 흐르는 침묵을 어떻게 깨뜨리겠습니까?",
    choices: [
      {
        choiceId: "A",
        label: "업무 성과와 태도를 분리하여 엄격하게 경고한다.",
        intent: "Professional Discipline",
        xpBase: 40,
        difficulty: 1.2,
        hiddenDelta: { integrity: 3, communication: -2, insight: 1, resilience: 2, gratitude: -1 },
        result:
          "민지는 입술을 깨물며 '알겠습니다'라고 답하지만, 이후 그녀의 이직 준비 소문이 돌기 시작합니다. 단기적으로 기강은 잡혔으나 팀 내 심리적 안전감이 붕괴되어 정보 공유가 중단됩니다. 리더의 권위는 지켰지만, 핵심 인재의 마음은 완전히 닫혔습니다.",
        microInsight: "Authority re-established, trust compromised.",
        followUp: {
          enabled: true,
          prompt: "경직된 분위기를 완화하고 업무 효율을 복구하기 위한 후속 조치는?",
          options: ["성과 기반의 개별 보상안 제시", "팀 전체가 참여하는 업무 프로세스 재설계 워크숍", "1:1 심층 고충 상담 기간 선포"],
        },
      },
      {
        choiceId: "B",
        label: "그녀의 감정에 공감하며 불편함의 원인을 먼저 묻는다.",
        intent: "Empathetic Inquiry",
        xpBase: 85,
        difficulty: 0.9,
        hiddenDelta: { integrity: 1, communication: 3, insight: 2, resilience: 1, gratitude: 2 },
        result:
          "민지는 처음엔 방어적이었으나, 당신의 진심 어린 경청에 결국 눈물을 보이며 과도한 업무량과 후배들의 미숙함에서 오는 번아웃을 토로합니다. 갈등의 핵심이 '태도'가 아닌 '시스템의 과부하'였음을 발견합니다. 두 사람 사이의 보이지 않는 벽이 허물어지기 시작합니다.",
        microInsight: "Empathy unlocked the hidden bottleneck.",
        followUp: {
          enabled: true,
          prompt: "감정적 해소 이후, 실제적인 업무 과부하를 해결할 방안은?",
          options: ["진료 보조 파트타임 인력 즉시 채용", "연차 및 휴게 시간 강제 배정", "디지털 스캐너 도입 등 진료 효율화 장비 투자"],
        },
      },
      {
        choiceId: "C",
        label: "리더로서의 미숙함을 먼저 사과하고 도움을 요청한다.",
        intent: "Vulnerable Leadership",
        xpBase: 70,
        difficulty: 1.4,
        hiddenDelta: { integrity: 2, communication: 2, insight: 3, resilience: -1, gratitude: 2 },
        result:
          "당신의 예상치 못한 사과에 민지는 당황하지만, 곧 리더를 돕겠다는 책임감을 보이며 현장의 문제점들을 구체적으로 제안하기 시작합니다. 상하관계가 아닌 '파트너십'이 형성됩니다. 다만, 일부 직원들 사이에서 리더가 너무 유약하다는 평가가 나올 위험이 있습니다.",
        microInsight: "Vulnerability converted to collaborative power.",
        followUp: {
          enabled: true,
          prompt: "파트너십을 공고히 하면서도 리더의 기준을 명확히 전달하려면?",
          options: ["민지를 '현장 개선 팀장'으로 공식 임명", "주간 회의 시 결정권의 범위 명확화", "공동의 비전과 KPI 재설정"],
        },
      },
      {
        choiceId: "D",
        label: "대화를 중단하고 며칠간 생각할 시간을 서로 갖자고 한다.",
        intent: "Tactical Cooling-off",
        xpBase: 30,
        difficulty: 1.5,
        hiddenDelta: { integrity: -1, communication: -2, insight: 1, resilience: 2, gratitude: 0 },
        result:
          "시간은 벌었으나 감정의 골은 더 깊어집니다. 민지는 리더가 문제를 회피한다고 판단하여 이직을 결심하게 됩니다. 침묵은 해결책이 아니라 갈등을 고착화시키는 촉매제가 되었습니다. 진료실의 냉기는 이제 환자들에게까지 전달됩니다.",
        microInsight: "Avoidance confirmed the worst suspicion.",
        followUp: {
          enabled: true,
          prompt: "이미 냉각된 관계를 되살리기 위한 최후의 수단은?",
          options: ["제3자(중간관리자)를 통한 중재 시도", "파격적인 연봉 협상 제안", "공식적인 사과와 함께 면담 재요청"],
        },
      },
    ],
    coachNotes: {
      whatThisTrains: ["communication", "insight", "resilience"],
      whyItMatters:
        "DSO급 리더는 임상 실력뿐 아니라 고숙련 인력을 관리하는 '매니지먼트' 역량이 필수적입니다. 핵심 인재와의 갈등은 단순한 감정 싸움이 아니라 운영 리스크로 직결됩니다. 이번 시나리오는 태도 이면에 숨겨진 업무적 고충을 파악하고, 리더의 감정적 성숙도가 조직의 유지력을 어떻게 결정하는지 훈련합니다.",
    },
  },

  // 2) 환자 컴플레인 시나리오 (MVP용 추가 예시)
  {
    scenarioId: "complaint_patient_001",
    title: "대기실의 폭발: 리뷰 1점 위기",
    context:
      "VIP 환자가 '30분 넘게 기다렸다'며 프론트에서 큰 소리로 항의했고, 진료 후 즉시 구글 리뷰 1점을 남겼습니다. 직원들은 당황했고, 대기실의 다른 환자들도 불편한 표정을 짓고 있습니다. 지금 이 순간, 리더로서 무엇을 우선해야 할까요?",
    choices: [
      {
        choiceId: "A",
        label: "바로 사과하고 환자에게 당장 보상(할인/무료)을 제시한다.",
        intent: "Immediate Compensation",
        xpBase: 55,
        difficulty: 1.1,
        hiddenDelta: { communication: 1, resilience: 1, gratitude: 0, integrity: 0, insight: 1 },
        result:
          "환자는 일단 진정하지만, '소란을 부리면 혜택을 받는다'는 학습이 생길 위험이 있습니다. 직원들은 다음에도 같은 상황이 반복될까 불안해합니다.",
        microInsight: "Crisis softened fast, precedent created.",
        followUp: { enabled: true, prompt: "재발 방지를 위해 운영 측면에서 무엇을 바꿀까?", options: ["대기 안내 프로토콜", "예약 간격 조정", "VIP 동선 분리"] },
      },
      {
        choiceId: "B",
        label: "먼저 대기실 분위기를 안정시키고, 환자와는 별도 공간에서 대화한다.",
        intent: "De-escalation First",
        xpBase: 85,
        difficulty: 1.2,
        hiddenDelta: { communication: 3, resilience: 2, insight: 2, integrity: 1, gratitude: 1 },
        result:
          "대기실의 긴장을 낮춘 뒤 환자와 조용히 대화할 수 있어 문제의 핵심(예약 운영/안내 실패)이 더 명확해집니다. 직원들도 '리더가 상황을 컨트롤한다'는 안정감을 얻습니다.",
        microInsight: "Stability first. Root cause becomes visible.",
        followUp: { enabled: true, prompt: "환자의 1점 리뷰에 대한 대응은?", options: ["공식 답글 + 개선 약속", "개인 연락 + 재방문 제안", "내부 개선 후 일정 기간 모니터링"] },
      },
      {
        choiceId: "C",
        label: "직원들에게 먼저 지시하고, 환자에게는 잠시 기다려달라고 한다.",
        intent: "Operational Command",
        xpBase: 45,
        difficulty: 1.3,
        hiddenDelta: { communication: -1, resilience: 2, insight: 1, integrity: 1, gratitude: 0 },
        result:
          "팀은 움직이지만 환자는 '무시당했다'고 느낄 수 있습니다. 속도는 나지만 관계 비용이 커질 수 있습니다.",
        microInsight: "Efficiency gained, emotional debt created.",
        followUp: { enabled: true, prompt: "환자의 감정 비용을 줄이기 위한 보완은?", options: ["즉시 상황 설명", "대기시간 가시화", "개인 사과 및 확인"] },
      },
      {
        choiceId: "D",
        label: "리뷰는 나중에 처리하고, 당장 진료에만 집중한다.",
        intent: "Ignore & Proceed",
        xpBase: 25,
        difficulty: 1.4,
        hiddenDelta: { communication: -2, resilience: 1, insight: 0, integrity: -1, gratitude: 0 },
        result:
          "진료는 진행되지만, 브랜드 손상과 팀 불안이 누적됩니다. 작은 불씨가 시스템 리스크로 변합니다.",
        microInsight: "Short-term focus, long-term damage.",
        followUp: { enabled: true, prompt: "이미 퍼진 불신을 회복하려면?", options: ["후속 연락", "프로세스 리셋 공지", "직원 리커버리 미팅"] },
      },
    ],
    coachNotes: {
      whatThisTrains: ["communication", "resilience", "insight"],
      whyItMatters:
        "리더는 '환자 경험'과 '팀 안정'을 동시에 지켜야 합니다. 이 시나리오는 감정 완충(De-escalation) → 원인 규명 → 재발 방지라는 운영 리더십 루틴을 훈련합니다.",
    },
  },
];

export function getScenarioById(scenarioId: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.scenarioId === scenarioId);
}
