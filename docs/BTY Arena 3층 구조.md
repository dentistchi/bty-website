BTY Arena 3층 구조
 BTY Arena는 아래 3층 구조로 이해하면 헷갈릴 일이 없다.

최종 고정 구조

1) JSON = 런타임 스토리 소스

역할:
	•	시나리오 문맥
	•	압박의 전개
	•	선택지 레이블
	•	branch 흐름
	•	Action Decision UI 문구

즉, 사용자에게 무엇을 보여줄지를 담당한다.
이 방향은 binding spec의 핵심 문장과 정확히 일치한다.
“JSON tells the story. Supabase decides the consequence. Binding Layer makes them one runtime.”  ￼

2) Supabase = 행동 의미 엔진

역할:
	•	axis
	•	direction
	•	pattern_family
	•	intensity
	•	trigger evaluation
	•	action contract
	•	re-exposure
	•	validation

즉, 그 선택이 행동적으로 무슨 의미인지를 결정한다.
BTY의 본질도 이쪽에 맞다. BTY는 선택을 채점하는 게 아니라 패턴을 감지하고 행동을 강제하고, 재노출로 변화 여부를 검증하는 엔진이다.  ￼

3) Binding Layer = 번역 + 무결성

역할:
	•	JSON scenario ↔ DB scenario 연결
	•	JSON choice ↔ DB choice 연결
	•	phase 검증
	•	snapshot 반환
	•	클라이언트 추론 차단

즉, 둘을 느슨하게 섞는 게 아니라 하나의 런타임으로 묶는 계층이다.
명세도 이걸 분명히 요구한다. 클라이언트는 의미를 추측하는 쪽이 아니라 서버 snapshot을 렌더하는 쪽이어야 한다.  ￼

⸻

그래서 지금의 해석은 이렇게 고정하면 된다

첨부 파일의 역할

첨부 파일은 버린 것이 아니다.
역할이 바뀐 것이다.
	•	첨부 파일 = 철학 / 기준선 / 설계 문서
	•	JSON = 런타임 스토리
	•	Supabase = 런타임 판단 엔진

이 구분이 맞다.
첨부 문서들은 계속 기준선으로 살아 있어야 한다.
예를 들어:
	•	No Action → No Progression  ￼
	•	QR은 결과가 아니라 트리거  ￼
	•	행동 → 재노출 → 변화 검증 구조  ￼

⸻

Supabase에 넣은 두 시나리오의 의미도 정확하다

네가 정리한 두 개:
	•	OWN-RE-02-R1
	•	OWN-RE-03-R1

이 둘은 단순 콘텐츠가 아니라 ownership 축의 re-exposure 검증 샘플이다.

핵심은 둘 다 같은 축을 보되, 사건의 표면을 다르게 입혀서
사용자가 **“같은 왜곡을 다른 현실에서 다시 만나는 구조”**를 만들었다는 점이다.

이건 BTY 엔진 정의와도 완전히 맞는다.
재노출은 같은 상황을 복붙하는 게 아니라, 유사한 압박 아래에서 선택이 바뀌는지 확인하는 단계다.  ￼

그리고 exit를 “나쁜 답”처럼 보이게 하지 않고,
논리적으로 그럴듯하지만 책임 중심에서 빠지는 선택으로 설계한 것도 정확하다.
BTY는 정답 시험이 아니라 패턴 노출 장치여야 하기 때문이다.  ￼

⸻

최종 시나리오 구조도 이걸로 고정하면 된다

이제 BTY는 2-choice가 아니라 3-choice다.

canonical flow

Scenario
→ Primary Choice
→ Tradeoff Choice
→ Action Decision
→ Action Required / Next Scenario Ready
→ Action
→ Re-exposure
→ Validation

이건 binding spec에서 이미 canonical state machine으로 잠겨 있다.
특히 ACTION_DECISION_ACTIVE와 ACTION_REQUIRED를 분리해야 한다는 점이 중요하다.
전자는 결단, 후자는 실행 요구다.  ￼

⸻

앞으로 실무에서 헷갈리지 않게 쓰는 문장

이 한 문장으로 팀 전체를 정렬하면 된다.

JSON은 이야기를 말한다.
Supabase는 의미와 결과를 판단한다.
Binding Layer는 둘을 하나의 훈련 런타임으로 묶는다.

그리고 구현 문장으로 바꾸면:
	•	JSON에는 dbScenarioId, dbChoiceId, action_decision이 있어야 한다
	•	Supabase choice는 choice_phase로 primary / tradeoff / action_decision을 구분해야 한다
	•	contract 생성 권한은 is_action_commitment === true에 걸어야 한다
	•	client는 local step이 아니라 snapshot을 우선 렌더해야 한다

이게 최종 운영 원칙이다.  ￼  ￼

⸻

지금 시점의 가장 중요한 실무 포인트

이제 새 시나리오를 만들 때는 이렇게 보면 된다.
	1.	스토리 먼저 JSON으로 쓴다
사용자 체감, 압박, 전개, Action Decision 문구까지.
	2.	의미는 Supabase에 넣는다
axis, direction, pattern_family, intensity, kind.
	3.	둘을 explicit binding 한다
암묵 추론 금지. suffix 임시 조합 금지. load-time validation 필요.

이 순서를 지키면
“콘텐츠는 예쁜데 엔진이 비어 있는 상태”도 막고,
반대로 “엔진은 강한데 사용자 경험이 뜬금없는 상태”도 막을 수 있다.

다음 답변에서는 네가 말한 대로, 앞으로 그대로 복사해서 새 시나리오 만들 수 있게 현재 기준 최종 시나리오 템플릿 1개를 한국어로 깔끔하게 정리해주겠다.