BTY JSON ↔ Supabase Binding Layer Spec v3

0. 목적

이 문서는 BTY Arena를 게임형 선택 UI가 아니라 행동 훈련 엔진으로 작동시키기 위한 최종 연결 명세다.

이 문서의 목적은 세 가지다.
	•	JSON 기반 시나리오 표현 계층과 Supabase 기반 행동 엔진을 하나의 런타임으로 묶는다
	•	BTY의 실제 3-선택 구조를 상태기계, DB, API, UI에 일관되게 반영한다
	•	다른 GPT, Cursor, 개발자가 중간 해석 없이 그대로 구현할 수 있게 한다

⸻

1. 핵심 원칙

BTY는 다음 5단 구조를 가진다.

Scenario → Primary → Tradeoff → Action Decision → Action → Re-exposure

즉 BTY는 단순히 두 번 선택하는 시스템이 아니다.
세 번째에서 실제 행동을 고르게 만드는 시스템이다.

⸻

2. 문제 정의

현재 시스템은 두 개의 엔진으로 나뉘어 있다.

2.1 JSON Engine

담당 범위:
	•	시나리오 텍스트
	•	UI copy
	•	escalation 흐름
	•	선택지 레이블
	•	단계별 화면 표현

2.2 Supabase Engine

담당 범위:
	•	axis
	•	pattern_family
	•	direction
	•	trigger evaluation
	•	action contract generation
	•	validation
	•	re-exposure
	•	intervention sensitivity

2.3 현재 문제

이 둘이 완전히 연결되지 않으면 다음 문제가 생긴다.
	•	UI는 진행되는데 행동 엔진은 기록되지 않음
	•	DB trigger가 발생했는데 UI는 막히지 않음
	•	시나리오 스토리와 행동 의미가 드리프트함
	•	사용자는 “선택은 했는데 실제 행동은 내가 고른 적 없다”고 느낀다

⸻

3. 최종 구조 요약

3.1 역할 분리
	•	JSON = 표현
	•	Supabase = 판단
	•	Binding Layer = 번역 + 무결성 보장

3.2 최종 런타임 규칙
	•	JSON이 무엇을 보여줄지 정의한다
	•	DB가 그것이 허용되는지, 어떤 결과를 낳는지 결정한다
	•	클라이언트는 서버 snapshot을 렌더할 뿐, 의미를 추측하지 않는다

⸻

4. 최종 Runtime State

BTY Arena의 최종 상태기계는 아래와 같다.

SCENARIO_READY
→ PRIMARY_CHOICE_ACTIVE
→ TRADEOFF_ACTIVE
→ ACTION_DECISION_ACTIVE
→ ACTION_REQUIRED
→ ACTION_SUBMITTED
→ ACTION_AWAITING_VERIFICATION
→ REEXPOSURE_DUE
→ NEXT_SCENARIO_READY
→ FORCED_RESET


⸻

5. 상태 의미 정의

SCENARIO_READY

시나리오가 준비되었으나 아직 상호작용이 시작되지 않은 상태

PRIMARY_CHOICE_ACTIVE

첫 반응을 고르는 단계
사용자의 본능적/습관적 반응 패턴이 드러나는 단계

TRADEOFF_ACTIVE

압박이 증가한 뒤 재선택하는 단계
사용자의 자기합리화, 압박 속 유지/수정 패턴이 드러나는 단계

ACTION_DECISION_ACTIVE

실제 행동 여부를 고르는 단계
여기서 처음으로 “생각”이 아니라 “실행 결단”이 선택된다

ACTION_REQUIRED

이미 Action Decision에서 행동 진입을 선택했고,
이제 실제 contract / QR / 실행 단계로 넘어가야 하는 상태

ACTION_SUBMITTED

행동은 제출되었으나 아직 검증 전 상태

ACTION_AWAITING_VERIFICATION

검증 또는 승인 대기 상태

REEXPOSURE_DUE

행동 후 재노출 검증 시나리오가 필요한 상태

NEXT_SCENARIO_READY

다음 일반 시나리오로 진행 가능한 상태

FORCED_RESET

무결성 붕괴 또는 감정 붕괴로 Center 강제 이동이 필요한 상태

⸻

6. 가장 중요한 의미 구분

이 두 상태는 반드시 구분되어야 한다.

ACTION_DECISION_ACTIVE = decide

사용자가 행동할지 말지를 고르는 단계

ACTION_REQUIRED = execute

사용자가 이미 행동 진입을 선택했고,
이제 실제 action contract / QR 실행이 필요한 단계

즉 ACTION_REQUIRED는 다시 행동 여부를 선택하는 상태가 아니다.

⸻

7. 3-Choice BTY 구조

BTY의 실제 선택 구조는 아래와 같다.

1) Primary Choice

상황을 보고 첫 판단을 한다
주로 instinct / habit / first-pattern이 나온다

질문:
	•	나는 어떻게 반응하나?

2) Tradeoff Choice

상황이 꼬이거나 악화된 뒤 다시 선택한다
pressure, fairness, credibility, performance가 개입한다

질문:
	•	그래도 그 선택을 유지할 것인가?

3) Action Decision

이제 현실 행동 여부를 고른다
행동 회피와 행동 진입이 갈린다

질문:
	•	그래서 실제로 움직일 것인가?

⸻

8. 왜 Action Decision이 필수인가

기존 잘못된 구조는 이랬다.

Primary
→ Tradeoff
→ 바로 ACTION_REQUIRED 또는 DONE

이 구조의 문제:
	•	사용자는 행동을 선택한 적이 없다
	•	시스템이 행동을 대신 결정한 것처럼 느껴진다
	•	“생각 → 생각 → 갑자기 행동 강제”처럼 보인다

올바른 구조는 이렇다.

Primary
→ Tradeoff
→ Action Decision
→ ACTION_REQUIRED or NEXT_SCENARIO_READY

즉 BTY는 세 번째에서 행동을 선택하게 만드는 시스템이어야 한다.

⸻

9. JSON 시나리오 구조

각 JSON 시나리오는 DB 의미와 명시적으로 연결되어야 한다.

9.1 Scenario 구조

type JsonArenaScenario = {
  scenarioId: string;
  dbScenarioId: string;
  title: string;
  context: string;
  choices: JsonArenaChoice[];
  escalationBranches: Record<string, JsonArenaBranch>;
};

9.2 Primary choice 구조

type JsonArenaChoice = {
  choiceId: string;
  label: string;
  dbChoiceId: string;
};

9.3 Branch 구조

type JsonArenaBranch = {
  escalation_text: string;
  second_choices: JsonTradeoffChoice[];
  action_decision: {
    context: string;
    choices: JsonActionDecisionChoice[];
  };
};

9.4 Tradeoff choice 구조

type JsonTradeoffChoice = {
  id: string;
  label: string;
  dbChoiceId: string;
};

9.5 Action Decision choice 구조

type JsonActionDecisionChoice = {
  choiceId: string;
  label: string;
  dbChoiceId: string;
};


⸻

10. Scenario Mapping Rule

각 JSON scenario는 정확히 하나의 DB scenario에 연결되어야 한다.

권장 구조:

{
  "scenarioId": "core_01_training_system",
  "dbScenarioId": "OWN-RE-02-R1"
}

규칙:
	•	모든 JSON scenario는 dbScenarioId를 가져야 한다
	•	해당 dbScenarioId는 DB에 실제 존재해야 한다
	•	매핑이 없거나 틀리면 runtime은 playable 상태가 되어선 안 된다

⸻

11. Choice Mapping Rule

문자 suffix 조합은 개발용 fallback일 수 있지만,
운영 구조에선 explicit choice mapping이 우선이다.

권장 구조:

{
  "choiceId": "A",
  "label": "...",
  "dbChoiceId": "OWN-RE-02-R1_primary_A"
}

규칙:
	•	모든 JSON choice는 정확히 하나의 DB choice로 resolve되어야 한다
	•	UI label text로 choice를 추측하면 안 된다
	•	position-only mapping 금지
	•	action_decision choice도 같은 규칙을 따른다

⸻

12. DB 모델 확장

새 테이블보다 기존 scenario_choices 확장이 우선이다.

12.1 추가 필드

alter table scenario_choices
add column if not exists choice_phase text check (
  choice_phase in ('primary', 'tradeoff', 'action_decision')
);

alter table scenario_choices
add column if not exists parent_choice_id text null;

alter table scenario_choices
add column if not exists branch_key text null;

alter table scenario_choices
add column if not exists is_action_commitment boolean default false;

12.2 의미
	•	choice_phase
	•	primary / tradeoff / action_decision 구분
	•	parent_choice_id
	•	branch 계층 연결
	•	branch_key
	•	JSON branch와의 안정 매핑 키
	•	is_action_commitment
	•	실제 contract/QR 실행 권한을 가진 선택지인지 표시

⸻

13. Load-Time Binding Validation

binding 무결성 검사는 클릭 후가 아니라 로드 시점부터 시작되어야 한다.

13.1 필수 검증 항목
	1.	JSON scenario에 dbScenarioId가 있는가
	2.	해당 dbScenarioId가 DB에 존재하는가
	3.	JSON choice 수와 DB choice 수가 일치 가능한가
	4.	각 JSON choice가 정확히 하나의 DB choice에 대응되는가
	5.	모든 mapped DB choice가 해당 DB scenario에 속하는가
	6.	모든 mapped DB choice가 scenario와 같은 axis를 공유하는가

13.2 실패 시 동작
	•	scenario는 playable 상태가 되면 안 된다
	•	choice interaction은 막혀야 한다
	•	binding error surface를 보여줘야 한다
	•	random fallback 금지
	•	partial play 금지

⸻

14. Choice Phase 모델

Binding API는 이제 반드시 phase를 받아야 한다.

type BindingPhase =
  | "primary"
  | "tradeoff"
  | "action_decision";


⸻

15. POST /arena/choice API 계약

15.1 요청

{
  "run_id": "uuid",
  "json_scenario_id": "core_01_training_system",
  "db_scenario_id": "OWN-RE-02-R1",
  "json_choice_id": "A",
  "db_choice_id": "OWN-RE-02-R1_primary_A",
  "binding_phase": "primary"
}

15.2 서버 필수 검증
	1.	run 유효성 검증
	2.	scenario binding 검증
	3.	dbChoiceId가 dbScenarioId에 속하는지 검증
	4.	choice_phase 일치 검증
	5.	choice event 기록
	6.	pattern state 업데이트
	7.	trigger 판단
	8.	canonical runtime snapshot 반환

⸻

16. POST /arena/choice 응답 규칙

응답은 trigger-only 객체가 아니라 canonical runtime snapshot이어야 한다.

16.1 Primary 이후

{
  "runtime_state": "TRADEOFF_ACTIVE",
  "gates": {
    "choice_allowed": true,
    "next_allowed": false,
    "qr_allowed": false
  }
}

16.2 Tradeoff 이후

branch에 action_decision이 있으면:

{
  "runtime_state": "ACTION_DECISION_ACTIVE",
  "gates": {
    "choice_allowed": true,
    "next_allowed": false,
    "qr_allowed": false
  }
}

branch에 action_decision이 없으면:
	•	legacy transitional behavior 허용 가능
	•	단, canonical elite path에서는 action_decision이 존재해야 한다

16.3 Action Decision 이후

행동 진입 선택

{
  "runtime_state": "ACTION_REQUIRED",
  "gates": {
    "choice_allowed": false,
    "next_allowed": false,
    "qr_allowed": true
  },
  "action_contract": {
    "exists": true,
    "id": "uuid"
  }
}

행동 회피 선택

{
  "runtime_state": "NEXT_SCENARIO_READY",
  "gates": {
    "choice_allowed": false,
    "next_allowed": true,
    "qr_allowed": false
  }
}

중요:
이 경우에도 시스템은 단순 normal continue로 보지 말고,
no_change risk 또는 equivalent intervention sensitivity를 적립해야 한다.

⸻

17. Trigger Rule 수정

기존 잘못된 구조:

exit_count >= threshold
→ 바로 action_request 생성

수정 구조:

exit_count >= threshold
→ ACTION_DECISION_ACTIVE

그 후:

user selects action_decision choice

if is_action_commitment === true
→ ACTION_REQUIRED

if is_action_commitment === false
→ NEXT_SCENARIO_READY + no_change risk accrual

즉 threshold는 action 생성기가 아니라
행동 결단 단계 진입기다.

⸻

18. is_action_commitment와 direction의 역할 분리

이 둘은 반드시 분리해서 써야 한다.

direction
	•	pattern 의미 해석
	•	validation 해석
	•	분석용

is_action_commitment
	•	contract 생성 권한
	•	ACTION_REQUIRED 진입 권한

즉 contract 생성은 아래처럼 판단한다.

const shouldRequireAction = meaning.is_action_commitment === true;

direction만으로 contract 생성 여부를 판단하면 안 된다.

⸻

19. UI 권한 규칙

원칙:
	•	JSON은 무엇을 보여줄지 결정한다
	•	DB snapshot은 그것이 허용되는지 결정한다

금지
	•	local step만으로 progression 결정
	•	snapshot 무시
	•	choice_allowed false인데 클릭 가능
	•	runtime_state가 blocked인데 UI가 계속 진행

⸻

20. UI 컴포넌트 구조

ArenaScenarioOpeningPanel
	•	title
	•	role / pressure / dilemma
	•	primary choices

ArenaTradeoffPanel
	•	worsened context
	•	tradeoff choices

ArenaActionDecisionPanel
	•	현실 행동 결단 패널
	•	긴 설명 금지
	•	짧고 날카로운 context
	•	2~3개 명확한 버튼
	•	reflection처럼 보이면 안 된다

ArenaBlockedSurface
	•	ACTION_REQUIRED → My Page action contract flow
	•	FORCED_RESET → Center
	•	REEXPOSURE_DUE → re-exposure panel

⸻

21. BtyArenaRunPageClient 최종 분기 원칙

if (snapshot?.runtime_state === "ACTION_REQUIRED") {
  return <ArenaBlockedSurface snapshot={snapshot} />;
}

if (snapshot?.runtime_state === "FORCED_RESET") {
  return <ArenaBlockedSurface snapshot={snapshot} />;
}

if (snapshot?.runtime_state === "REEXPOSURE_DUE") {
  return <ArenaReexposurePanel ... />;
}

if (uiStep === "primary") {
  return <ArenaScenarioOpeningPanel ... />;
}

if (uiStep === "tradeoff") {
  return <ArenaTradeoffPanel ... />;
}

if (uiStep === "action_decision") {
  return <ArenaActionDecisionPanel ... />;
}

규칙:
	•	snapshot이 uiStep보다 우선한다
	•	둘이 충돌하면 snapshot이 이긴다

⸻

22. Validation Bridge

validation은 단순 before/after 비교가 아니라,
행동 결단을 포함한 변화 구조를 본다.

before
	•	prior exit pattern
	•	primary + tradeoff에서 드러난 행동 회피 구조

action_decision
	•	이번에 실제 행동 진입을 선택했는지
	•	또는 회피를 유지했는지

after
	•	re-exposure 시나리오에서 실제 선택한 결과

필수 규칙
	•	validation은 같은 axis 안에서만 수행
	•	cross-axis validation 금지

⸻

23. Validation 입력 예시

{
  "before_axis": "ownership",
  "before_pattern_family": "future_deferral",
  "before_direction": "exit",

  "action_decision_axis": "ownership",
  "action_decision_pattern_family": "ownership_claim",
  "action_decision_direction": "entry",

  "after_axis": "ownership",
  "after_pattern_family": "ownership_claim",
  "after_direction": "entry"
}

결과
	•	changed
	•	unstable
	•	no_change

⸻

24. no_change risk 적립 규칙

Action Decision에서 exit/avoidance를 선택한 경우:
	•	단순 neutral continue로 취급하면 안 된다
	•	시스템은 반드시 no_change 계열 리스크를 적립해야 한다
	•	다음 intervention sensitivity를 상승시킬 수 있어야 한다

예:

action_decision_exit
→ no_change_bias += 1
→ future intervention sensitivity up

즉 사용자는 다음으로 넘어갈 수 있어도,
시스템은 그 선택을 가볍게 보면 안 된다.

⸻

25. REEXPOSURE 규칙

BTY의 핵심 루프는 여기서 닫힌다.

Scenario
→ Primary
→ Tradeoff
→ Action Decision
→ Action Required / Execute
→ REEXPOSURE_DUE
→ Re-exposure scenario
→ Validation

중요:
	•	REEXPOSURE_DUE일 때 일반 next scenario와 mixed semantics를 만들면 안 된다
	•	re-exposure는 별도 panel과 별도 loader를 가져야 한다
	•	validation 결과가 다음 runtime state를 결정해야 한다

⸻

26. 금지 상태

다음은 구조 실패로 간주한다.
	•	JSON choice가 DB mapping 없이 클릭됨
	•	canonical elite인데 binding 없으면 조용히 legacy fallback
	•	tradeoff 직후 Action Decision 없이 바로 ACTION_REQUIRED
	•	action_decision exit가 아무 리스크 없이 normal continue 처리됨
	•	runtime snapshot이 blocked인데 local step이 계속 진행
	•	REEXPOSURE_DUE인데 일반 next scenario가 동시에 playable로 노출됨
	•	cross-axis validation

⸻

27. 최종 전체 흐름

1. Scenario load
2. Primary Choice
3. Worsened Context
4. Tradeoff Choice
5. ACTION_DECISION_ACTIVE
6. Action Decision Choice
7. ACTION_REQUIRED or NEXT_SCENARIO_READY
8. Action execution / QR
9. REEXPOSURE_DUE
10. Re-exposure scenario
11. Pattern validation


⸻

28. 구현 우선순위
	1.	choice_phase 추가
	2.	JSON에 action_decision 추가
	3.	runtime state에 ACTION_DECISION_ACTIVE 추가
	4.	tradeoff 후 반드시 action decision으로 이동
	5.	POST /api/arena/choice에 binding_phase: "action_decision" 추가
	6.	action_decision에서만 contract 생성 가능
	7.	action_decision exit 시 no_change risk 적립
	8.	re-exposure → validation 루프까지 닫기

⸻

29. 최종 한 줄 규칙

JSON tells the story.
Supabase decides the consequence.
Binding Layer makes them one runtime.
Action Decision makes BTY a real training engine.

⸻

30. 최종 결론

이제부터 BTY는 더 이상
“두 번 고르고 시스템이 대신 행동을 부여하는 구조”가 아니다.

이제 BTY는
세 번째에서 사용자가 실제 행동을 선택하게 만들고,
그 선택의 결과를 재노출과 검증으로 되돌려주는 구조가 된다.

이때부터 BTY는 게임이 아니라 훈련 엔진이다.

⸻

