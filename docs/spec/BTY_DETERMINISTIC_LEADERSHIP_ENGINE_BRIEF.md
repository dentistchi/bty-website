# BTY Deterministic Leadership Engine — Executive Brief

**큰 그림 참조**: 이해가 가장 쉬운 비전 소스는 **The_Integrity_Engine.pptx** (로컬 경로: `.../bty arena/presentation/*The_Integrity_Engine.pptx`). **이 프레젠테이션에 나온 Integrity Engine을 구현하는 것이 우리의 목표**이다. → [INTEGRITY_ENGINE_VISION_SOURCE.md](../INTEGRITY_ENGINE_VISION_SOURCE.md)

**목적**: 조직 성장 시 리더십 무결성을 유지하고, 의도를 행동으로 전환하며, 문화적 표류를 막는 **결정론적 행동 정렬 엔진**의 경영진용 요약.  
동기 부여 플랫폼이 아니라 **Behavioral Alignment Engine**이다.

---

## What Is Deterministic Leadership?

**Deterministic Leadership**, as operationalized by the BTY Deterministic Leadership Engine, is a **systemic approach to management** that relies on **objective, automated mechanisms** to align behavior and scale culture, rather than depending on subjective human evaluation or continuous executive intervention.

**Core premise:** It **does not replace human leadership, but rather stabilizes it**. It addresses the reality that as an organization grows, leaders cannot be everywhere—which typically leads to inconsistent cultures, reactive interventions, and executive burnout.

**Defining characteristics:**

| Characteristic | Description |
|----------------|-------------|
| **Action-driven over emotion-driven** | The system explicitly rejects operating as a "motivation platform". It functions on a strict action-based philosophy: **positive** = action-generating, **negative** = action-blocking. Growth is treated as a formula: **repeated action + delayed reward**. |
| **Objective accountability** | Guesswork and subjective performance evaluations are eliminated. Execution integrity is measured purely through data, primarily the **Action Integrity Rate (AIR)**—completed actions divided by chosen actions—to deterministically track whether an individual is doing what they committed to do. |
| **Systemic correction of distortions** | Poor performance is not treated as a fixed personality trait but as a temporary **behavioral distortion** under pressure. The system automatically detects when individuals fall into states such as Over-Intervention or Expectation Collapse and deploys **mechanical corrections**. |
| **Automated interventions** | To maintain standards without requiring a manager to constantly intervene, the system uses automated triggers. If integrity drops below a threshold, a **Forced Reset** is automatically deployed (48-hour corrective window). If behavioral distortions repeat, the **Mirror Mechanism** automatically switches the user's perspective (e.g., leader experiences staff viewpoint) to train empathy through experience rather than lectures. |

Ultimately, deterministic leadership is designed to systematically **convert intention into action, standardize integrity, and prevent cultural drift**—building future leaders while aggressively protecting the energy of current executives.

---

## Why This Exists

- 조직이 커지면 문화가 불일치해진다.
- 리더가 물리적으로 모든 곳에 있을 수 없다.
- 기준이 표류하고, 개입이 반응형이 되며, 번아웃이 증가한다.

이 시스템은 다음을 위해 설계되었다.

- **Preserve leadership integrity at scale**
- **Convert intention into action**
- **Prevent cultural drift**
- **Reduce dependency on constant executive intervention**

**This is not a motivation platform. It is a deterministic behavioral alignment engine.**

**“This is not a motivation problem. It is a systems problem.”**

---

## Cultural Drift and How the Engine Prevents It

Cultural drift occurs as an organization grows because **leaders cannot be physically present everywhere**, which naturally leads to inconsistent culture, drifting standards, and reactive interventions. The BTY Deterministic Leadership Engine is specifically **engineered to prevent cultural drift** by scaling culture and standardizing integrity across the organization.

Rather than acting as a simple motivational tool, the system prevents drift by functioning as a **deterministic behavioral alignment engine** that consistently **converts intentions into concrete actions**. It achieves this through three mechanisms:

| Mechanism | Role |
|-----------|------|
| **Detecting and correcting distortions** | The system recognizes that individuals under pressure rotate through the four behavioral states (Over-Intervention, Expectation Collapse, Responsibility Withdrawal, Integrity Reset). By actively detecting and correcting these states, the engine prevents temporary distortions from becoming **permanent cultural norms**. |
| **Protecting the leadership standard** | If execution integrity drops below a set threshold, the system automatically triggers a **Forced Reset** with a mandatory **48-hour execution window**. This deterministic rule ensures that behavioral standards **do not slide**. |
| **Maintaining team accountability** | The **Team Integrity Index (TII)** is the **only publicly visible score**. It maintains team-wide accountability and alignment while **preventing toxic internal competition**. |

By preventing cultural drift systemically, the engine **reduces the dependency on constant executive intervention**, thereby protecting executive energy, reducing burnout, and stabilizing overall leadership.

---

## Core Belief

- **Positive** does not mean optimistic. **Positive** means **action-generating**.
- **Negative** does not mean pessimistic. **Negative** means **action-blocking**.
- **Growth** = repeated action + delayed reward.

---

## The 4 Behavioral States

조직 내 모든 사람은 다음 4가지 **상태**를 압박 하에 순환한다.

| # | State | 설명 (기술 명세 대응) |
|---|-------|------------------------|
| 1 | **Over-Intervention** | Speed Bias / Over-control / Over-compensation |
| 2 | **Expectation Collapse** | Cynicism Drift |
| 3 | **Responsibility Withdrawal** | Avoidance / Presence Shrink |
| 4 | **Integrity Reset** | Forced Realignment |

이것은 **성격 특성이 아니라**, 압박 하의 **행동 왜곡**이다. 시스템이 이를 감지하고 보정한다.

---

## AIR — Action Integrity Rate

AIR은 **실행 무결성**을 측정한다.

- **AIR = (Completed Actions) / (Chosen Actions)**  
  (가중: Reset 행동은 2배로 계산.)
- 행동을 반복적으로 회피하면 시스템이 플래그한다.  
  추측이나 주관적 평가가 아니다.
- **구현**: `src/domain/leadership-engine/air.ts` — `computeAIR`, 가중치(micro_win 1.0, reset 2.0), missed 시 -0.10, 3연속 missed → `integrity_slip`.
- **밴드 (v2 LOCKED, 노출은 band만):** low **&lt; 0.50** · mid **0.50–0.79** · high **≥ 0.80** — `airToBand`, `AIR_BAND_LOW_MID` / `AIR_BAND_MID_HIGH`. *(구 컷오프 0.4/0.7 폐기.)* 상세: `docs/BTY_AIR_PATTERN_SHIFT_BASELINE_V2.md`.

---

## Forced Reset

- 무결성이 임계 이하로 떨어지면 **Reset**이 트리거된다. (슬라이드: 연속 4개 중 2개 critical activation window 미충족 시 트리거.)
- **AIR 주간 조건 (코드 정합):** 연속 2주 **AIR_7d &lt; 0.80**(high 밴드 미만)일 때 근거 문자열 **`air_7d_below_high_band_two_consecutive_weeks`**. *(구 0.70 기준·구 reason id 폐기.)*
- **48시간 실행 창**. 영구적으로 무시할 수 없다. 관리자가 취소·면제·연기할 수 없다.
- **준수 시:** Reset 행동 2배 가중으로 AIR 회복, 운영 모멘텀 회복, 기준 상태로 복귀.
- **무시 시:** AIR 가속 감쇠, **Leader Certified 즉 박탈**, Mirror(관점 전환) 에스컬레이션.
- **구현**: `src/domain/leadership-engine/forced-reset.ts`, `state-service.ts` — `getResetDueAt(triggeredAt + 48h)`.

---

## Team Integrity Index (TII)

- **공개되는 것은 팀 점수만**이다. 개인 AIR는 시스템과 직원 간에만 비공개(독성 내부 경쟁 방지).
- **TII = (Average AIR × 60%) + (Micro Win Density × 25%) + (Team Stability × 15%)**
- **해석 예:** TII 0.62 = 팀이 기준 운영 무결성에 필요한 행동의 62%만 수행 중; 리더십 레이어 개입 필요. **임계:** >0.70 미만 시 경고, “Leadership intervention required.”
- 내부 경쟁을 줄이면서 팀 책임을 유지한다.
- **구현**: `src/domain/leadership-engine/tii.ts` — `computeTII`, `TII_WEIGHT_AIR=0.6`, `TII_WEIGHT_MWD=0.25`, `TII_WEIGHT_TSP=0.15`.

---

## Mirror Mechanism

- 왜곡이 **반복**되면 시스템이 **관점을 전환**한다.
- 리더는 스태프 시점을, 스태프는 리더 압박을 **경험**한다.
- **알리지 않고 경험하게** 한다. 강의가 아니라 경험으로 공감을 훈련한다.
- **구현**: `bty-app/docs/LEADERSHIP_ENGINE_SPEC.md` §8 Role Mirror Logic — Stage2/3 반복 시 다음 세션 viewpoint 전환, “This is mirror”라고 명시하지 않음.

---

## Certification

- **Leader Certified** 상태 요건:
  - **AIR ≥ 80%** (14일)
  - Consistent action execution (MWD 등)
  - Reset compliance (강제 Reset 시 48h 내 완료·검증)
- 정기 재평가. **영구 아님**.
- **구현**: `src/domain/leadership-engine/certified.ts` — `certifiedStatus`, `CERTIFIED_AIR_14D_MIN = 0.80`, reset 준수·integrity_slip 없음.

---

## How Leadership Integrity Is Measured (No Single “Scale”)

The system does **not** use a single metric or feature called the “Leadership Integrity Scale.” Instead, it **measures and enforces leadership integrity** through a combination of:

| Mechanism | Role |
|-----------|------|
| **Action Integrity Rate (AIR)** | Tracks **individual** execution integrity: completed actions vs. chosen actions (reset actions count double). Flags repeated avoidance; feeds into certification and team index. |
| **Team Integrity Index (TII)** | The **only score made public** to the team. Composite: Average AIR (60%), Micro Win Density (25%), Team Stability (15%). Prevents internal competition while maintaining **team accountability**. |
| **Leader Certification** | To achieve “Leader Certified” status, an individual must maintain **AIR ≥ 80%**, consistent action execution (e.g. MWD), and **reset compliance**. Certification upholds leadership standards; it is **re-evaluated regularly** and is **not permanent**. |

Together, these mechanisms preserve leadership integrity at scale and standardize integrity across the organization without relying on a single “scale” metric.

---

## System Structure

| 구성요소 | 역할 |
|----------|------|
| **Arena** | 실행 환경. 시나리오 엔진, 실시간 참여, QR 활성화, 공개 대시보드/리더보드. |
| **Foundry** | 개발 환경. 철학·훈련, 지연 보상 조건화; 일관성 달성 시 고급 모델 언락. |
| **Center** | 보정 환경. 비공개 진단 허브; 성찰; **Integrity Reset 프로토콜** 실행. |

**사용자 흐름:** Arena에서 일상 실행 → 일관성 달성 시 Foundry 언락 → AIR 하락 또는 왜곡 발생 시 **Center로 이동** → Center에서 구조적 Reset 완료 후 Arena 재진입.

---

## Strategic Value

- Reduces burnout  
- Standardizes integrity  
- Scales culture  
- Builds future leaders  
- Protects executive energy  

**This system does not replace leadership. It stabilizes it.**

---

## Action-conditioning (not gamification)

설계는 **표면적 게이미피케이션이 아니라 행동 조건화**이다. 신경-행동 루프: **행동** → **검증**(디지털/물리 확인, 예: QR) → **점수 반영·표시** → 도파민 경로 활성화 → **정체성 강화**(지위·자기 인식) → 다시 행동. “생물학적 엔지니어링이지 비디오 게임이 아니다.” 보조 수단: 리더보드(TII·사회적 증거), 동적 인증(리스 형태의 지위, 지속 재획득), QR 검증(물리·구체적 디지털 행동 강제).

---

## 90-Day MVP Protocol (슬라이드 기준)

- **Phase 1 (Day 1–38):** Leadership AIR Acquisition — 80%+ Leader Cert 목표, 기준 확립.
- **Phase 2 (Day 38–68):** Conditional Certification & Friction Testing — Reset 포기율 &lt;5%, 인증 게이트.
- **Phase 3 (Day 68–98):** System Integrity Validation & Broader Rollout Prep — 주관적 불만 감소, 전사 롤아웃 준비.
- **성공 지표:** 80%+ Leader Certification 비율, &lt;5% Reset abandonment.
- **문화 전환 지표:** 주관적 HR 불만 감소, 자발적 교정 행동 증가, 표준화된 팀 회의.

---

## 기존 서류·코드 매핑

| Brief 항목 | 서류 | 코드/API |
|------------|------|----------|
| 4 States / Stage 전이 | `bty-app/docs/LEADERSHIP_ENGINE_SPEC.md` §2, §3 | `src/domain/leadership-engine/stages.ts`, state-service |
| AIR | 위 명세 §4 | `src/domain/leadership-engine/air.ts`, `GET /api/arena/leadership-engine/air` |
| Forced Reset | 위 명세 §5 | `forced-reset.ts`, `state-service.ts` |
| TII | 위 명세 §6 | `tii.ts`, `GET /api/arena/leadership-engine/tii` |
| Certified / LRI | 위 명세 §7 | `certified.ts`, `lri.ts`, certified-lri-service |
| Mirror | 위 명세 §8 | Role Mirror Logic, viewpoint 전환 규칙 |
| Arena/Foundry/Center | `docs/spec/ARENA_DOMAIN_SPEC.md`, FOUNDRY_DOMAIN_SPEC, CENTER_DOMAIN_SPEC | 앱 라우트·시나리오 엔진 |
| Phase·구현 계획 | `bty-app/docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` | P1–P8 단계, Cursor 역할 |

---

## 구현 계획 요약

### 현재 구현 상태 (완료·부분)

| 항목 | 상태 | 비고 |
|------|------|------|
| Stage 전이·4단계 | ✅ | stages.ts, state-service |
| AIR 계산 (7d/14d/90d, 가중, integrity_slip) | ✅ | air.ts, API /air |
| Forced Reset 조건·48h | ✅ | forced-reset.ts |
| TII 계산·팀만 공개 | ✅ | tii.ts, API /tii |
| Certified 요건 (AIR≥80%, MWD, reset 준수) | ✅ | certified.ts |
| LRI·Ready·리더 승인 | ✅ | lri.ts, certified-lri-service |
| Mirror (viewpoint 전환) | ✅ | 명세 §8, 시나리오·세션 역할 할당 |
| 대시보드 AIR/TII 위젯 | ✅ | ProgressCard, API 응답 표시만 (render-only) |
| LE Stage API·위젯 | ✅ | stage-summary 등 |

### 남은 단계 (로드맵·백로그 기준)

| 순서 | 내용 | 참고 |
|------|------|------|
| 1 | AIR/TII/LE 상수·barrel 정리·edges 테스트 보강 | SPRINT_PLAN, 도메인 테스트 |
| 2 | 팀·조직 기능(Phase 2+), AIR·TII 연동 심화 | NEXT_YEAR_BACKLOG, ROADMAP |
| 3 | Reset 시나리오·48h UX·검증 플로우 완비 | LEADERSHIP_ENGINE_SPEC §5, 시나리오 태그 |
| 4 | Certified/LRI UI 노출 정책·재평가 주기 고정 | 명세 §7 |
| 5 | Mirror 콘텐츠 풀·role-flipped 시나리오 확보 | 명세 §8, 시나리오 메타 |

### 단일 명세 원칙

- **로직·규칙의 단일 소스**: `bty-app/docs/LEADERSHIP_ENGINE_SPEC.md`  
- 모든 Cursor는 이 명세를 기준으로 Stage/AIR/Reset/TII/Certified/LRI/Mirror를 구현한다.  
- UI는 **API에서 받은 값만 표시**하며, AIR/TII/Stage/Reset 규칙을 클라이언트에서 계산하지 않는다 (bty-ui-render-only, bty-arena-global).

---

*이 문서는 BTY Deterministic Leadership Engine의 경영진용 브리프이며, 상세 규칙·수식·API는 `LEADERSHIP_ENGINE_SPEC.md` 및 도메인 코드를 따른다.*
