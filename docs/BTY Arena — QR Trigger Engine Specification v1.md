
⸻

📄 BTY Arena — QR Trigger Engine Specification v1

⸻

1. 🎯 목적 (Objective)

QR Trigger Engine은 사용자의 선택 패턴을 분석하여,
다음 조건이 만족될 때 **행동(Action Contract)**을 강제 생성한다.

QR은 선택의 결과가 아니라,
행동이 반드시 필요한 순간을 감지하는 시스템 트리거이다.

⸻

2. 🧠 핵심 정의 (Core Definitions)

2.1 Axis

리더십 왜곡이 발생하는 8개 축
	•	Ownership
	•	Time
	•	Conflict
	•	Truth
	•	Repair
	•	Authority
	•	Integrity
	•	Courage

⸻

2.2 Direction

entry = 행동을 발생시키는 선택
exit  = 행동을 막는 선택


⸻

2.3 Intensity

1 = 약함 (간접 회피 / 가벼운 행동)
2 = 중간 (명확한 회피 / 직접 행동)
3 = 강함 (핵심 회피 / 리스크 행동)


⸻

2.4 Pattern Family

각 선택은 반드시 하나의 pattern_family를 가진다.

예:
	•	ownership_escape
	•	conflict_avoidance
	•	explanation_substitution

⸻

2.5 Actionability

QR 생성은 다음 조건을 만족해야 한다:

- 대상이 명확하다 (who/what)
- 48~72시간 내 실행 가능하다
- 검증 가능한 행동이다


⸻

3. 📊 Scoring Model

3.1 Choice Score

if exit:
  score = +intensity

if entry:
  score = -intensity


⸻

3.2 Axis Pressure Score

axis_pressure_score = Σ(exit points) - Σ(entry points)


⸻

3.3 Global Exit Metrics

same_axis_exit_count = 동일 axis exit 횟수 (최근 N개 선택)
distinct_exit_axes = exit 발생 axis 개수
total_exit_points = exit 점수 총합


⸻

4. 🚨 QR Trigger Conditions

QR은 다음 조건 중 하나라도 만족하면 발동된다.

⸻

4.1 Immediate Trigger (즉시 트리거)

if direction == exit
and intensity == 3
→ trigger QR (Forced)

적용 대상
	•	Integrity
	•	Ownership
	•	Courage
	•	Conflict (핵심 회피)

⸻

4.2 Same-Axis Accumulation Trigger

if same_axis_exit_count(last 5 decisions) >= 3
→ trigger QR (Guided)

또는:

if axis_pressure_score >= 5
→ trigger QR


⸻

4.3 Multi-Axis Convergence Trigger

if distinct_exit_axes(last 5 decisions) >= 3
and total_exit_points >= 6
→ trigger QR (Guided)


⸻

4.4 Dominant Axis Trigger (Single Scenario)

if same_axis appears ≥ 2 times within scenario
and final decision == exit
→ trigger QR (Guided)


⸻

4.5 Integrity Gap Trigger

if entry_selection_rate ≥ 0.7
and QR_execution_rate < 0.4
→ trigger QR (Forced)

또는:

if QR_completed == true
and same_axis_exit reappears within next 2 exposures
→ trigger stronger QR (Forced)


⸻

5. 🧪 Actionability Filter

QR 생성 전 반드시 통과해야 한다.

if NOT (
  has_clear_target AND
  executable_within_72h AND
  observable_action
):
  → DO NOT trigger QR
  → fallback to scenario loop


⸻

6. 🔥 QR Severity Levels

6.1 Soft QR
	•	단순 반복
	•	선택형 행동 제안

⸻

6.2 Guided QR
	•	특정 axis 명확
	•	제한된 선택 (1~2개)

⸻

6.3 Forced QR
	•	강한 무결성 붕괴
	•	행동 필수
	•	미완료 시 진행 차단

⸻

6.4 Severity 결정

if immediate_trigger:
  severity = FORCED

elif same_axis_exit_count ≥ 3:
  severity = GUIDED

elif multi_axis_condition:
  severity = GUIDED

elif integrity_gap:
  severity = FORCED


⸻

7. 🧠 QR Trigger Score (QTS)

선택 기반 점수 모델

QTS =
(Immediate Exit Bonus)
+ (Same Axis Exit Count × 2)
+ (Distinct Exit Axes × 1)
+ (Total Exit Points × 1)
+ (Integrity Gap Bonus)
- (Recent Entry Recovery × 2)


⸻

Threshold

QTS ≥ 7  → Guided QR
QTS ≥ 10 → Forced QR


⸻

Hard Override

다음 조건은 즉시 Forced QR:

- Integrity axis intensity 3 exit
- Ownership axis intensity 3 exit
- Courage axis intensity 3 exit


⸻

8. 🔄 Engine Flow

1. User makes choice
2. Record (axis, direction, intensity)

3. Update:
   - axis pressure
   - exit counts
   - pattern states

4. Evaluate triggers:
   - immediate
   - accumulation
   - convergence
   - dominant axis
   - integrity gap

5. Apply actionability filter

6. Determine severity

7. Generate QR action (if triggered)


⸻

9. 💣 핵심 철학 (Non-negotiable Principle)

QR은 나쁜 선택의 결과가 아니다.

QR은
“이제 생각이 아니라 행동으로 넘어가야 하는 순간”
에만 발생한다.


⸻

10. 🧩 시스템 정렬 (Alignment)

이 엔진은 다음과 직접 연결된다:
	•	Pattern Engine (pattern_signals, pattern_states)
	•	Action Contract Engine
	•	LRI (Leadership Readiness Index)
	•	MWD (Micro Win Density)
	•	Integrity Slip Detection
	•	Routing Engine (L2 / L3 / L4 escalation)

⸻
