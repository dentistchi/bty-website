/**
 * OWN-RE-02-R1 — canonical vertical slice (ownership / performance-review distortion).
 * First-class id (not a `core_*` proxy). Binding ids follow `docs/BTY Arena — 최종 3-Choice 시나리오 템플릿.md`.
 */

import type { EscalationBranch } from "@/domain/arena/scenarios/types";

const SID = "OWN-RE-02-R1" as const;

function branchA(): EscalationBranch {
  return {
    escalation_text:
      "보고는 이미 진행됐고, 팀원 일부는 보상 결과를 기대하고 있다. 지금 수정하면 혼란이 생길 수 있다.",
    pressure_increase: 0.58,
    second_choices: [
      {
        id: "X",
        label: "일단 그대로 두고 다음 사이클에서 조정한다",
        cost:
          "You limit exposure today; the underlying distortion in performance data may harden into an accepted narrative.",
        direction: "exit",
        pattern_family: "future_deferral",
        dbChoiceId: `${SID}_tradeoff_A_X`,
      },
      {
        id: "Y",
        label: "지금이라도 내부적으로 원인을 정리하고 수정 가능성을 검토한다",
        cost:
          "You invite immediate friction; the same trade-off between clarity and stability remains visible to the team.",
        direction: "entry",
        pattern_family: "repair_avoidance",
        dbChoiceId: `${SID}_tradeoff_A_Y`,
      },
    ],
    action_decision: {
      prompt:
        "지금 이 왜곡을 당신 책임 범위 안으로 끌어와 실제로 바로잡을 것인가?",
      promptKo:
        "지금 이 왜곡을 당신 책임 범위 안으로 끌어와 실제로 바로잡을 것인가?",
      choices: [
        {
          id: "ACT",
          label: "오늘 안으로 관련자와 직접 대화하고 수정 프로세스를 시작한다",
          commitment: "You are choosing visible follow-through over indefinite preparation.",
          dbChoiceId: `${SID}_action_A_Y_ACT`,
          meaning: { is_action_commitment: true },
        },
        {
          id: "DEFER",
          label: "지금은 건드리지 않고 다음 기회에 처리한다",
          commitment: "You are choosing containment and timing over impulse or avoidance.",
          dbChoiceId: `${SID}_action_A_Y_DEFER`,
          meaning: { is_action_commitment: false },
        },
      ],
    },
  };
}

function branchB(): EscalationBranch {
  return {
    escalation_text:
      "상부에 공유한 뒤 기대가 생겼다. 지금 방향을 바꾸면 신뢰와 일정이 동시에 흔들릴 수 있다.",
    pressure_increase: 0.6,
    second_choices: [
      {
        id: "X",
        label: "공유한 방향을 유지하고, 수정은 별도 트랙으로 문서화만 한다",
        cost: "You protect the narrative you started; the data gap may widen before it is corrected.",
        direction: "exit",
        pattern_family: "future_deferral",
        dbChoiceId: `${SID}_tradeoff_B_X`,
      },
      {
        id: "Y",
        label: "추가 사실 확인을 요청하고, 필요 시 상부에 정정 가능성을 명시한다",
        cost: "You accept short-term uncertainty in exchange for structural honesty.",
        direction: "entry",
        pattern_family: "repair_avoidance",
        dbChoiceId: `${SID}_tradeoff_B_Y`,
      },
    ],
    action_decision: {
      prompt: "After sharing upward, will you still own correcting the record in the real world?",
      promptKo: "상부 공유 이후에도, 기록을 바로잡을 책임을 실제로 가져갈 것인가?",
      choices: [
        {
          id: "ACT",
          label: "오늘 안으로 관련자와 직접 대화하고 수정 프로세스를 시작한다",
          commitment: "You are choosing visible follow-through over indefinite preparation.",
          dbChoiceId: `${SID}_action_B_ACT`,
          meaning: { is_action_commitment: true },
        },
        {
          id: "DEFER",
          label: "지금은 건드리지 않고 다음 기회에 처리한다",
          commitment: "You are choosing containment and timing over impulse or avoidance.",
          dbChoiceId: `${SID}_action_B_DEFER`,
          meaning: { is_action_commitment: false },
        },
      ],
    },
  };
}

/** Structural elite row — validated by `validateEliteScenario` when the canonical dataset loads. */
export function buildOwnRe02R1EliteScenario() {
  return {
    id: SID,
    title: "성과 리뷰 왜곡 이슈",
    role: "Clinical Director",
    pressure:
      "이전 매니저 시절 잘못 입력된 성과 데이터가 이미 상위 보고까지 올라갔다. 지금 상태로는 팀원 평가와 보상에 왜곡이 생긴다. 이 문제는 직접 만든 것이 아니다. 하지만 현재 이 조직의 책임자는 당신이다.",
    tradeoff:
      "절차를 지키면 왜곡이 굳어질 수 있고, 바로잡으면 단기 혼란과 신뢰 비용이 생긴다. 말로만 정리하면 다음 사이클에도 같은 패턴이 반복된다.",
    bty_tension_axis: "Structural Honesty vs. Face-Saving",
    action_contract: {
      description:
        "Distorted performance data를 이해관계자와 명명하고, 시스템이 허용하는 범위에서 기록을 바로잡는다.",
      time_window_hours: 48,
    },
    air_logic: {
      success: "Name the distortion as a system issue and schedule at least one correction touchpoint.",
      miss: "Treat it as someone else’s past mistake with no visible ownership action.",
    },
    forced_reset: {
      trigger: "blame_shift_to_prior_manager",
      action: "Reframe as current-scope ownership and name one correction step you will take this week.",
    },
    pattern_detection: ["ownership_escape", "avoidance", "explanation_substitution"],
    difficulty_level: 3,
    primaryChoices: [
      {
        id: "A",
        label: "기존 절차대로 진행하고, 문제는 나중에 따로 수정한다",
        dbChoiceId: `${SID}_primary_A`,
      },
      {
        id: "B",
        label: "데이터 오류 가능성을 상부에 공유하고 상황을 확인한다",
        dbChoiceId: `${SID}_primary_B`,
      },
    ],
    escalationBranches: {
      A: branchA(),
      B: branchB(),
    },
  };
}
