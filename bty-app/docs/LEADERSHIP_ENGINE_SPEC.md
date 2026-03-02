# Leadership Engine — 단일 명세 (All Cursors)

**목적**: 결정론적·규칙 기반 상태 머신 엔진의 **단일 소스**. 모든 Cursor가 이 파일만 읽고 같은 로직을 구현한다.

**원칙**: 역할 기반 시나리오 훈련 제품. 동일 4단계 엔진이 모든 역할(Doctor/Manager/DSO/Staff/Executive)에 적용. 개인 점수 비공개, 팀 수준 지수만 공개. **설명 가능·감사 가능**(블랙박스 ML 없음).

---

## 1. 개요

- **엔진**: 결정론적·규칙 기반 상태 머신.
- **세션**: 한 세션은 하나의 **ROLE(viewpoint)** 에 고정, 세션 종료까지 유지.
- **Mirror(시점 전환)**: 특별 이벤트가 아니라 **일반 플로우**. Stage 반복에 따라 결정론적으로 트리거.
- **저장**: 모든 사용자 이벤트를 **이벤트 로그**에 저장. 지표는 **주간·롤링 창(7/14/90일)** 로 계산.
- **모듈**: (1) Stage Transition Logic (2) AIR Calculation Engine (3) Reset Forced Conditions (4) Team Index Calculation (5) Certified / LRI Logic (6) Role Mirror Logic.

---

## 2. 4-Stage 상태 머신

사용자당 **항상 정확히 하나**의 현재 Stage.

| Stage | 이름 | 설명 |
|-------|------|------|
| **STAGE_1** | Over-Intervention | Speed Bias / Over-control / Over-compensation |
| **STAGE_2** | Expectation Collapse | Cynicism Drift |
| **STAGE_3** | Responsibility Withdrawal | Avoidance / Presence Shrink |
| **STAGE_4** | Integrity Reset | Forced Realignment |

Stage는 **세션 종료 시** 갱신. 롤링 창 기반 **결정론적 전이 규칙**.

---

## 3. Stage 전이 규칙 (Module 1)

**규칙 (재현 가능·단위 테스트 가능)**

- **Stage1 → Stage2** (최근 7일 내):
  - `count(Stage1ChoiceType = "direct_fix_or_takeover") >= 2`
  - AND `missedActivationCount >= 2`

- **Stage2 → Stage3** (최근 14일 내):
  - `count(Stage2ChoiceType = "cynicism_or_lower_expectations") >= 2`
  - AND `completedRelationshipResetActivation == 0`
  - AND (TSP_trend ≤ -1 for 2 consecutive weeks OR 유사 안정성 악화 플래그)

- **Stage3 → Stage4**: Reset 모듈에서 강제 트리거 처리. 트리거 시 **즉시** Stage = Stage4.

- **Stage4 → Stage1**: ResetActivation이 **completed + verified** 이면 전이.

**노출 함수**

```ts
evaluate_stage_transition(user_id, session_id) -> new_stage
```

---

## 4. AIR (Action Integrity Rate) — Module 2

**정의**

- 매 세션은 0..N개의 **activation intents**(실행 필요 선택 행동)를 생성.
- 각 activation:
  - `activation_id`, `type` (micro_win | reset | others), `chosen_at`, `due_at`(창 종료), `completed_at`, `verified` (bool)

**계산**

- **주간(롤링 7일)** 계산, 14/90일 요약도 저장.

**Base**

- `AIR_raw = completed_verified_activations / chosen_activations`

**가중치**

- reset activation weight = **2.0**
- micro win activation weight = **1.0**

**가중 AIR**

- `AIR = sum(weight of completed_verified) / sum(weight of chosen)`

**패널티**

- activation window missed (`completed_at` is null after `due_at`): 해당 주간 AIR에 **-0.10** (floor 0).
- **3연속** missed window → `integrity_slip` = true.

**노출**

```ts
compute_air(user_id, period: "7d" | "14d" | "90d") -> { air_value, missed_windows, integrity_slip_flag }
```

**구현 상태 (P2)**: `src/domain/leadership-engine/air.ts` — `computeAIR`, `detectIntegritySlip`, `computeAIRSnapshot` 완성. 테스트 25/25 PASS (`air.test.ts`).

---

## 5. Reset 강제 조건 (Module 3)

- Stage4(Integrity Reset)는 **결정론적으로 강제**.
- 사용자는 **최대 48시간 지연** 가능, **영구 무시 불가**.

**강제 조건 (최근 14일 내 아래 중 “어느 두 개”라도 만족하면 Stage4 강제)**

- `stage3_selected_count >= 2`
- `AIR_7d < 0.70` 가 **2주 연속** (주간 스냅샷 저장)
- `no_qr_verification_days >= 7`
- TSP 추세가 **2주 연속 음수** (TSP_week_n < TSP_week_n-1)

**강제 시**

- `user.current_stage = Stage4`
- `forced_reset_triggered_at = now()`, reset due = **triggered_at + 48h**
- 지연 시 due는 +48h 이내 유지, 프롬프트 자동 재표시

**Reset 완료 조건**

- activation **completed + verified**

**Reset 완료 후**

- stage → Stage1
- `forced_reset_triggered_at` null로 초기화
- (선택·결정론) 7일간 AIR ≥ 0.80 준수 시 `integrity_slip` 플래그 클리어

**노출 (구현)**

```ts
evaluateForcedReset(inputs: ResetEvalInputs) -> { shouldTrigger: boolean, reasons: string[] }
getResetDueAt(triggeredAt: Date) -> Date
triggerForcedResetToStage4(supabase, userId) -> { ok: boolean }
resetStateTransitionHandler(supabase, userId, inputs) -> { triggered, reasons, currentStage, stageName }
```

**구현 상태 (P3)**: `src/domain/leadership-engine/forced-reset.ts`, `src/lib/bty/leadership-engine/state-service.ts`. 테스트: `forced-reset.test.ts`, `state-service.test.ts`.

---

## 6. Team Integrity Index — Module 4

**유일한 공개 점수**: 팀 수준 TII.

**지표**

- **Avg AIR**: 팀 평균 AIR_7d
- **Avg MWD** (Micro Win Density, 7d): `MWD_7d = number_of_completed_verified_micro_wins / 7`
- **TSP** (Team Stability Pulse): 당주 또는 롤링 평균

**TII 수식**

- `TII = (avg_air * 0.60) + (avg_mwd_normalized * 0.25) + (tsp_normalized * 0.15)`

**정규화**

- AIR: 0..1
- MWD: `mwd_normalized = min(mwd_7d / target_mwd, 1.0)`, `target_mwd` 기본 **0.30** (주당 약 2.1)
- TSP: 1..5 → 0..1: `tsp_normalized = (tsp - 1) / 4`

**노출**

```ts
compute_team_tii(team_id) -> { tii, avg_air, avg_mwd, tsp, components... }
```

**프라이버시**

- 팀 뷰에서 **개인 AIR·개인 순위 노출 금지**.

---

## 7. Certified / LRI — Module 5

### A) Certified (Leader 전용)

- Certified는 **상태**이며 영구 아님.
- **분기 재평가** + “현재 certified” 계산.

**요건 (현재)**

- `AIR_14d >= 0.80`
- `MWD_14d >= target_mwd` (기본 threshold = TII target 0.30, 주당 평균 ~2.1)
- Reset 준수: 강제 reset 발생 시 90일 내 48h 이내 완료 1회 이상 (또는 90일 내 reset 2회—결정론 유지)
- 최근 14일 내 **integrity_slip 없음** (3연속 missed window 없음)

**노출 (구현)**

- **도메인 (순수)**: `isCertified(inputs: CertifiedInputs) → boolean`, `certifiedStatus(inputs) → { current, reasons_met, reasons_missing }`. 입력(air14d, mwd14d, resetComplianceMet, noIntegritySlipIn14d)은 API/Infrastructure가 로그·스냅샷에서 조회해 제공.
- **서비스**: `getCertifiedStatus(userId, getInputs)`, `isUserCertified(userId, getInputs)` — getInputs는 `(userId) => Promise<CertifiedInputs>`.
- **구현**: `src/domain/leadership-engine/certified.ts`, `src/lib/bty/leadership-engine/certified-lri-service.ts`. 테스트: `certified.test.ts`, `certified-lri-service.test.ts`.

### B) LRI (Leadership Readiness Index, 비리더)

- LRI는 **비공개**. 임계 도달 시 **Ready Flag** 생성.
- 가중 트렌드(결정론):
  - `LRI = 0.50×AIR_14d + 0.30×MWD_normalized + 0.20×personal_responsibility_pulse`
- **personal_responsibility_pulse**: “I can take responsibility without avoidance” (1..5) → 정규화 `(pulse - 1) / 4` → 0..1.

**Ready Flag**

- `LRI >= 0.80` AND `integrity_slip` 플래그 없음 → `readiness_flag = true`

**승진 단계**

- `readiness_flag` 시 **리더 공동 승인**으로 리더 트랙 전환: `leader_approval(user_id, approver_id)`. 규칙: `canApproveLeaderTrack(candidateReadinessFlag, approverIsCertifiedLeader)`.

**노출 (구현)**

- **도메인 (순수)**: `computeLRI(inputs: LRIInputs) → { lri, readiness_flag, reasons }`, `canApproveLeaderTrack(readinessFlag, approverIsCertified) → boolean`.
- **서비스**: `getLRI(userId, getInputs)`, `approveLeaderTrack(supabase, userId, approverId, getLRIInputs, getCertifiedInputs) → { approved, reason? }`. 승인 시 `leadership_engine_state`에 `is_leader_track`, `leader_approved_at`, `leader_approver_id` 저장.
- **구현**: `src/domain/leadership-engine/lri.ts`, `src/lib/bty/leadership-engine/certified-lri-service.ts`. DB: `supabase/migrations/20260316000000_leadership_engine_leader_track.sql`. 테스트: `lri.test.ts`, `certified-lri-service.test.ts`.

---

## 8. Role Mirror Logic — Module 6

- Mirror는 **일반 플로우**, 별도 “이벤트”로 알리지 않음.
- 세션마다:
  - `role_viewpoint` (Leader | TeamMember)
  - `role_type` (Doctor | Manager | DSO | Staff | Executive)
- **세션 역할 할당**: 결정론적. Stage 반복이 “블라인드 스팟”을 나타내면 **다음 세션 viewpoint 전환**.

**Blind spot 규칙**

- `current_stage in [Stage2, Stage3]` AND `repetition_count_in_14d >= 2`:
  - 다음 세션 `viewpoint` = 지난 세션의 **반대**
  - 다음 세션 `context_type` = 지난 세션과 동일 (pressure | process | conflict | relationship)
  - 다음 세션 `scenario_id` = 동일 context, **role-flipped** 콘텐츠 풀에서 선택

**UI**

- “This is mirror”라고 명시하지 않음.
- (선택) 미묘한 힌트: “You may have heard something like this recently.”

**노출**

```ts
assign_next_session_role(user_id, last_session) -> { viewpoint, role_type, context_type, mirror_applied: boolean }
```

---

## 9. 최소 스키마 / 타입

**User**

- `id`, `team_id`, `role_type`, `is_leader_track`, `current_stage`, `integrity_slip_flag`, `readiness_flag`

**Session**

- `id`, `user_id`, `started_at`, `ended_at`, `viewpoint` (Leader | TeamMember), `context_type` (pressure | process | conflict | relationship), `stage_at_start`, `stage_at_end`, `scenario_id`

**Activation**

- `id`, `session_id`, `user_id`, `type` (micro_win | reset), `chosen_at`, `due_at`, `completed_at`, `verified` (bool), `verifier_id` (optional), `weight`

**WeeklyMetrics**

- `user_id`, `week_start_date`, `air`, `mwd`, `tsp`, `missed_windows_count`

**TeamWeeklyMetrics**

- `team_id`, `week_start_date`, `tii`, `avg_air`, `avg_mwd`, `tsp`

**재현성**

- 모든 계산은 **Session + Activation 로그**만으로 재현 가능해야 함.

---

## 10. 노출 함수 목록 (API/도메인)

| 함수 | 모듈 | 용도 |
|------|------|------|
| `evaluate_stage_transition(user_id, session_id)` | 1 | 세션 종료 시 새 Stage 반환 |
| `compute_air(user_id, period)` | 2 | AIR·missed_windows·integrity_slip_flag |
| `check_forced_reset` / `resetStateTransitionHandler` (user_id, inputs) | 3 | 강제 Reset 여부·사유·전이 |
| `compute_team_tii(team_id)` | 4 | TII·avg_air·avg_mwd·tsp |
| `isCertified(inputs)` / `getCertifiedStatus(userId, getInputs)` | 5A | Certified 여부 (도메인/서비스) |
| `certifiedStatus(inputs)` | 5A | Certified 상세·이유 |
| `computeLRI(inputs)` / `getLRI(userId, getInputs)` | 5B | LRI·readiness_flag·reasons |
| `approveLeaderTrack(supabase, userId, approverId, getLRIInputs, getCertifiedInputs)` | 5B | 리더 트랙 승인 |
| `assign_next_session_role(user_id, last_session)` | 6 | 다음 세션 viewpoint·role_type·context_type·mirror_applied |

---

## 11. 시나리오 스키마 ↔ 엔진 매핑 (bty_scenario_v1)

시나리오 JSON(`docs/specs/bty-scenario-schema-v1.json`)과 엔진 입력 관계. 상세 정합성·역할 분담은 `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md` 참고.

| 시나리오 필드 | 엔진 사용처 |
|---------------|-------------|
| `context_type` | `Session.context_type` (Mirror 시 동일 유지) |
| `choices[].engine_signals.choice_type` | Stage 전이: `direct_fix_or_takeover`→Stage1 신호, `cynicism_or_lower_expectations`→Stage2, `withdraw` 등→Stage3 |
| `choices[].activation_plan.type` | `Activation.type` (micro_win \| reset) |
| `choices[].activation_plan.weight`, `window_hours` | AIR 가중치, `Activation.due_at` |
| `choices[].activation_plan.verification.method` "qr" | `Activation.verified`, `verifier_id` |
| `metrics_hooks.air.counts_activation` | 해당 선택 시 Activation 생성 → AIR 분모/분자 |
| `metrics_hooks.mwd.micro_win` | MWD 완료·검증 집계 |
| `metrics_hooks.tsp.weekly_pulse_prompt` | TSP 설문 문구 |
| `delayed_outcome.*` | 14일 재진입·패턴 평가(엔진 확장 시 구현) |

---

## 12. BTY 연동 (기존 규칙)

- **bty-arena-global**: Arena XP·주간 XP·리더보드·시즌 규칙과 분리. 이 엔진의 Stage/AIR/TII/Certified/LRI는 **별도 도메인·테이블**.
- **bty-ui-render-only**: UI는 위 지표를 **API에서 받은 값만 표시**, 계산·랭킹 로직 금지.
- **bty-release-gate**: 새 마이그레이션·API 변경 시 D·E·F 항목 충족.

---

*이 파일이 Leadership Engine의 단일 명세입니다. 구현 시 이 문서와 `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` Phase를 함께 참고할 것.*
