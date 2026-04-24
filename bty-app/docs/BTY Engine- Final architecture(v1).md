좋다. 이제는 “설계”가 아니라 엔진 정의 문서로 깔끔하게 닫자.
이건 그대로 제품/코드/팀 공유 기준이 되는 수준으로 정리한다.

⸻

📘 BTY Engine — Final Architecture (v1)

⸻

0. 🔥 한 줄 정의

BTY는 선택을 평가하는 시스템이 아니라,
패턴을 감지하고 행동을 강제하며,
재노출을 통해 변화 여부를 검증하는 엔진이다

⸻

1. 🧠 전체 구조 (End-to-End Loop)

Scenario
→ Choice
→ Pattern Detection
→ Trigger Evaluation
→ QR Action Contract
→ Execution (Relational Verification)
→ Re-exposure
→ Behavior Change Validation
→ Growth Update


⸻

2. 🧩 5 Core Engines

BTY는 5개의 엔진으로 구성된다.

⸻

① Scenario Engine (입력 생성기)

역할
	•	현실 압박 상황 생성
	•	선택을 통해 “패턴”을 드러내게 함

핵심 원칙
	•	정답 없음
	•	모든 선택은 “그럴듯함”
	•	반드시 tradeoff 존재

출력

{
  "scenario_id": "...",
  "axis": "ownership",
  "choices": [
    {
      "id": "A",
      "direction": "entry",
      "pattern_family": "ownership_claim",
      "intensity": 2
    },
    {
      "id": "B",
      "direction": "exit",
      "pattern_family": "ownership_escape",
      "intensity": 3
    }
  ]
}


⸻

② Pattern Engine (의미 해석기)

역할
	•	선택 → 패턴으로 변환
	•	패턴 → 축(axis) 누적

핵심 개념
	•	axis (8개)
	•	pattern_family
	•	direction (entry / exit)
	•	intensity (1~3)

⸻

상태 저장

{
  "pattern_state": {
    "ownership": {
      "exit_count": 2,
      "entry_count": 1,
      "pressure_score": 4
    }
  }
}


⸻

핵심 원칙

👉 “선택”은 중요하지 않다
👉 “반복된 선택 패턴”이 중요하다

⸻

③ Trigger Engine (결정 엔진)

역할
	•	언제 행동이 필요한지 판단

⸻

트리거 조건

1. Immediate (즉시)

exit + intensity 3 → Forced QR


⸻

2. Accumulation (누적)

same axis exit ≥ 3 (최근 5)
→ QR


⸻

3. Convergence (다축 붕괴)

3개 이상 axis에서 exit
→ QR


⸻

4. Integrity Gap

entry 많음 + 실행 없음
→ Forced QR


⸻

출력

{
  "trigger": true,
  "axis": "ownership",
  "severity": "FORCED"
}


⸻

④ QR Action Engine (행동 강제 시스템)

역할
	•	행동을 생성
	•	행동을 실행
	•	행동을 검증

⸻

🔥 핵심 구조

Action Request
→ Execution
→ Approval (Relational)
→ XP

👉  ￼

⸻

Action Contract 구조

{
  "who": "assistant",
  "what": "direct conversation",
  "how": "no defensiveness",
  "when": "within 48 hours",
  "evidence": "meeting confirmation"
}


⸻

핵심 원칙
	•	행동은 검증 가능해야 한다
	•	행동은 불편해야 한다
	•	행동은 패턴 반대 방향이어야 한다

⸻

🔥 Relational Verification

Actor ≠ Approver

👉 타인이 검증해야 XP 지급

👉  ￼

⸻

⑤ Re-exposure Engine (변화 검증기) ← 가장 중요

역할
	•	동일/유사 상황 재노출
	•	선택 변화 여부 검증

⸻

구조

Scenario A
→ 선택 (exit)

→ QR 행동

→ Scenario A’ (유사 상황)
→ 선택 변화 확인


⸻

검증 기준

상태	의미
Same exit 반복	변화 없음
entry 선택	행동 전환
mixed	불안정


⸻

핵심 원칙

👉 “행동을 했는가”보다
👉 “선택이 바뀌었는가”가 중요

⸻

3. 🔁 전체 Loop (진짜 핵심)

1. Scenario (압박 발생)

2. Choice
→ 행동 vs 회피

3. Pattern Accumulation
→ axis pressure 증가

4. Trigger Engine
→ 행동 필요 판단

5. QR Action
→ 행동 실행
→ 관계 검증

6. Re-exposure
→ 동일 상황 재진입

7. Behavior Change Detection
→ 선택 변화 확인

8. Growth Update
→ AIR / LRI / XP 반영


⸻

4. 🎯 BTY 핵심 철학 (시스템 레벨)

⸻

1. 행동 정의

👉 행동 = 현실을 바꾸는 것

⸻

2. 긍정 / 부정

Positive = 행동을 만드는 생각
Negative = 행동을 막는 생각

👉  ￼

⸻

3. Integrity

👉 자기에게 더 엄격
👉 타인에게 더 관용

👉 행동 기준으로 판단

⸻

4. BTY

👉 비교 ❌
👉 비난 ❌

👉 질문:

이 상황에서 나는 무엇을 할 수 있는가?


⸻

5. 📊 Growth Engine 연결

⸻

AIR (핵심 지표)

AIR = 완료 행동 / 선택 행동

👉  ￼

⸻

LRI

LRI = AIR + MWD + Pulse

👉  ￼

⸻

XP 구조
	•	Weekly XP → 경쟁
	•	Core XP → 정체성

👉  ￼

⸻

6. 💣 가장 중요한 Non-Negotiable

⸻

1️⃣ No Action → No Progression

👉  ￼

⸻

2️⃣ QR은 결과가 아니라 트리거다

👉  ￼

⸻

3️⃣ 행동보다 중요한 것

👉 행동 이후 선택 변화

⸻

4️⃣ 시스템 목적

👉 행동을 시키는 것 ❌
👉 행동하게 되는 상태를 만드는 것 ⭕

⸻

7. 🧭 최종 정의

⸻

BTY Engine은

👉 선택을 평가하지 않는다
👉 패턴을 감지한다
👉 행동을 강제한다
👉 변화를 검증한다

⸻

리더 정의

Leader = Decision + Action Completion + Pattern Change


⸻

🔥 마지막 한 문장

👉 BTY는 행동을 기록하는 시스템이 아니라
행동 → 변화 → 재선택을 닫는 시스템이다

⸻
