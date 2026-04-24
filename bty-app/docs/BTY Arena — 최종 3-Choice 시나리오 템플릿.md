✅ BTY Arena — 최종 3-Choice 시나리오 템플릿 (Canonical v1)

type JsonArenaScenario = {
  scenarioId: string;        // JSON 고유 ID
  dbScenarioId: string;      // Supabase scenario 연결

  title: string;             // 시나리오 제목
  role: string;              // 사용자 역할
  context: string;           // 상황 설명 (현실감 + 압박 포함)

  choices: Array<{
    choiceId: string;        // UI 선택 ID
    label: string;           // 사용자에게 보이는 문장
    dbChoiceId: string;      // Supabase choice 매핑
  }>;

  escalationBranches: Record<string, {
    escalation_text: string; // 상황 악화 / 압박 증가

    second_choices: Array<{
      id: string;
      label: string;
      dbChoiceId: string;
    }>;

    action_decision: {
      context: string;       // “그래서 실제로 할 건가?” 단계
      choices: Array<{
        choiceId: string;
        label: string;
        dbChoiceId: string;
      }>;
    };
  }>;
};


⸻

🎯 실제 예시 (OWN-RE-02-R1 기반)

이건 바로 사용할 수 있는 수준으로 쓴다.

{
  "scenarioId": "core_ownership_01",
  "dbScenarioId": "OWN-RE-02-R1",

  "title": "성과 리뷰 왜곡 이슈",
  "role": "Clinical Director",

  "context": "이전 매니저 시절 잘못 입력된 성과 데이터가 이미 상위 보고까지 올라갔다. 지금 상태로는 팀원 평가와 보상에 왜곡이 생긴다. 이 문제는 직접 만든 것이 아니다. 하지만 현재 이 조직의 책임자는 당신이다.",

  "choices": [
    {
      "choiceId": "A",
      "label": "기존 절차대로 진행하고, 문제는 나중에 따로 수정한다",
      "dbChoiceId": "OWN-RE-02-R1_primary_A"
    },
    {
      "choiceId": "B",
      "label": "데이터 오류 가능성을 상부에 공유하고 상황을 확인한다",
      "dbChoiceId": "OWN-RE-02-R1_primary_B"
    }
  ],

  "escalationBranches": {
    "A": {
      "escalation_text": "보고는 이미 진행됐고, 팀원 일부는 보상 결과를 기대하고 있다. 지금 수정하면 혼란이 생길 수 있다.",

      "second_choices": [
        {
          "id": "X",
          "label": "일단 그대로 두고 다음 사이클에서 조정한다",
          "dbChoiceId": "OWN-RE-02-R1_tradeoff_A_X"
        },
        {
          "id": "Y",
          "label": "지금이라도 내부적으로 원인을 정리하고 수정 가능성을 검토한다",
          "dbChoiceId": "OWN-RE-02-R1_tradeoff_A_Y"
        }
      ],

      "action_decision": {
        "context": "지금 이 왜곡을 당신 책임 범위 안으로 끌어와 실제로 바로잡을 것인가?",

        "choices": [
          {
            "choiceId": "ACT",
            "label": "오늘 안으로 관련자와 직접 대화하고 수정 프로세스를 시작한다",
            "dbChoiceId": "OWN-RE-02-R1_action_A_Y_ACT"
          },
          {
            "choiceId": "DEFER",
            "label": "지금은 건드리지 않고 다음 기회에 처리한다",
            "dbChoiceId": "OWN-RE-02-R1_action_A_Y_DEFER"
          }
        ]
      }
    }
  }
}


⸻

🔒 이 템플릿에서 절대 깨면 안 되는 규칙

이건 “스타일”이 아니라 엔진 무결성 조건이다.

1. 반드시 3단 구조여야 한다
	•	Primary
	•	Tradeoff
	•	Action Decision

👉 하나라도 빠지면 BTY가 아니라 그냥 선택 게임이다
👉 Action Decision이 없으면 “행동을 선택한 경험”이 사라진다  ￼

⸻

2. Action Decision은 “생각”이 아니라 “결단”이다
	•	길게 설명하면 안 된다
	•	에세이 금지
	•	2~3개 버튼
	•	바로 행동/회피 갈림

👉 “그래서 할 거야 말 거야” 느낌이어야 한다

⸻

3. dbChoiceId는 반드시 존재해야 한다
	•	UI label로 의미 추측 금지
	•	suffix 임시 조합 금지
	•	load-time validation 필요

👉 binding 실패 상태에서 플레이되면 구조 실패다  ￼

⸻

4. contract 생성은 여기서만 일어난다

if (is_action_commitment === true)
→ ACTION_REQUIRED

👉 Tradeoff에서는 절대 생성되면 안 된다
👉 이거 깨지면 “생각 → 생각 → 갑자기 실행 강제”로 느껴진다  ￼

⸻

5. 회피 선택도 비용이 있어야 한다

if (action_decision_exit) {
  no_change_risk += 1
}

👉 그냥 다음으로 넘어가게 하면 엔진이 무너진다
👉 BTY는 “선택 기록 시스템”이 아니라 “패턴 누적 시스템”이다

⸻

6. 시나리오 목적은 정답이 아니라 패턴 노출이다
	•	exit는 “틀린 선택”처럼 보이면 안 된다
	•	entry는 “좋은 선택”처럼 보이면 안 된다

👉 둘 다 설득력 있어야 한다
👉 대신 하나는 행동을 막고, 하나는 행동을 만든다

이게 BTY의 핵심 정의다  ￼

⸻

🔥 마지막 정리 (실무용 한 줄)

이 템플릿을 쓸 때는 이렇게 생각하면 된다.

👉 Primary = 내가 어떻게 반응하는가
👉 Tradeoff = 압박 속에서 그걸 유지하는가
👉 Action Decision = 그래서 실제로 움직일 것인가

그리고 시스템은:

👉 선택을 기록하지 않는다
👉 패턴을 쌓는다
👉 행동을 강제한다
👉 다시 같은 상황으로 돌려보낸다

이게 BTY 엔진의 완성 루프다  ￼

⸻
