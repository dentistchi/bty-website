# Role-Based Leadership Distortion Engine — 계획서

**근거**: ENGINE ARCHITECTURE DIRECTIVE (상단 원문 요약 반영)  
**단일 명세 (로직·규칙·스키마)**: **`docs/LEADERSHIP_ENGINE_SPEC.md`** — 모든 Cursor가 **이 파일을 기준**으로 동일한 Stage/AIR/Reset/TII/Certified/LRI/Mirror 로직을 구현한다.  
**목적**: 시나리오 퀴즈가 아니라 **상태 전이 기반 행동 보정 엔진**으로 설계·구현하기 위한 계획을 서류화하고, 여러 Cursor에 단계별로 지시할 수 있게 한다.

**참고**: **P1–P8 = Phase(단계)** 이고, **Cursor 1·2·3·4 = 담당자(역할)** 이다. Phase 번호와 Cursor 번호를 혼동하지 말 것.  
역할은 **Cursor 1(Engine), 2(Infrastructure), 3(Scenario), 4(Commander)** 네 개로 나누고, **나(커맨더)**가 순서·검증을 조율한다.

> **사용 전 안내**  
> 아래 §5를 **해당 Cursor(1–4)** 에 붙여 넣기 전에 `docs/AGENTS_SHARED_README.md`, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` 를 열어 두라고 안내한다.

---

## 1. 원문 요약 (DIRECTIVE)

- **정의**: Role-Based **Leadership Distortion Engine**. 시나리오 퀴즈 시스템이 아님. **상태 전이(State-Transition) 행동 보정 엔진**.
- **4 Core Stages**: Stage 1 Over-Intervention (Speed Bias) → Stage 2 Expectation Collapse (Cynicism Drift) → Stage 3 Leadership Withdrawal (Responsibility Avoidance) → Stage 4 Integrity Reset (Forced Realignment).
- **Stage 전이 규칙**: 결정론적·데이터 기반. 1 반복(위임 없음) → 2, 2 반복(교정 활성화 없음) → 3, 3 + AIR 임계 미달 → 4, 4 완료 → 1 복귀.
- **AIR (Action Integrity Rate)**: Executed Activations / Chosen Activations. 가중치(Integrity Reset = 2x, Missed Window = -10%, 3연속 미실행 = 경고). 주간 재계산. Certified: AIR ≥ 80%, MWD 충족, 90일 내 Reset 2회 이상 등.
- **Reset 강제 조건**: Stage 3를 14일 내 2회 선택, AIR < 70% 2주 연속, 7일 QR 미검증, 팀 안정성 2주 음수 → Stage 4 자동 발동. Reset은 영구 무시 불가, 최대 48시간 지연만 허용.
- **Team Index (TII)**: (Avg AIR × 0.6) + (Avg Micro Win Density × 0.25) + (Team Stability Pulse × 0.15). **팀 점수만 공개**, 개인 점수는 비공개.
- **Certified / LRI**: Certified(리더만) = AIR·MWD·Reset 준수·분기 재평가. LRI(비리더) = 행동 트렌드·Reset 반응·위임/주도 패턴, 리더 공동 승인 시 리더 트랙 전환. 역할 매핑: Doctor / Manager / DSO / Executive — 동일 엔진, 콘텐츠 레이어만 다름.

---

## 2. BTY 연동 시 유의사항

- **bty-arena-global / bty-release-gate**: Arena XP·주간 XP·리더보드·시즌 규칙은 기존 정책 유지. 이 엔진의 **Stage/AIR/TII/Certified**는 별도 도메인으로 두고, UI는 **API에서 받은 값만 표시**하며 XP/랭킹/시즌 계산을 UI에서 하지 않는다.
- **데이터 분리**: Stage·AIR·Reset·TII·Certified/LRI는 기존 `arena_profiles`·`weekly_xp`와 **분리된 스키마/테이블**로 설계 권장. (예: `leadership_engine_state`, `air_ledger`, `team_index_snapshot` 등.)
- **역할**: 도메인 규칙은 순수 함수·도메인 레이어에 두고, API/서비스만 부수 효과(DB·외부 호출) 수행.

---

## 3. 역할 효율 분담 (Cursor 1·2·3·4)

**구분**: **P1–P8 = Phase(단계)**. **Cursor 1·2·3·4 = 담당 역할**. Phase가 Cursor가 아님.

한 Cursor에 모든 작업을 몰지 않고, 역할별로 나누어 병렬·순차를 조합한다.

| Cursor | 역할(별칭) | 담당 | 산출물 |
|--------|------------|------|--------|
| **Cursor 1** | Engine | AIR 계산, Stage 4 강제 트리거, TII, Certified/LRI **도메인·로직** | 함수 시그니처·순수 함수·결정론적 단위 테스트 |
| **Cursor 2** | Infrastructure | 이벤트 로깅 스키마·저장, 주간 스냅샷(TeamWeeklyMetrics) | 로그 테이블·스냅샷 테이블·마이그레이션, 파생 전용 저장 금지 |
| **Cursor 3** | Scenario | Stage4 호환 시나리오(Reset 템플릿, 48h, 검증 경로), `supports_reset` 태그 | bty_scenario_v1 시나리오 JSON·태그 |
| **Cursor 4** | Commander | Phase 2→3→4→5 **순서 관리**, 모듈 완료 검증 후 다음 단계, 결정론적 테스트 요구, Stage Engine(P1) 호환 확인 | 검증 체크리스트·게이트 통과 기록 |

**이상적인 운영 인원**: **Cursor 4개 + 나(커맨더) 1명 = 총 5명**이면 Phase를 나누어 담당하기에 적당하다. Cursor를 6개 이상으로 늘리면 Phase 간 의존성·검증 대기 때문에 오히려 지연될 수 있다.

**Cursor 4(Commander) 규칙**

- **반드시 할 것**: (1) Phase 2→3→4→5 순서 유지 (2) 다음 Phase 전에 모듈 완료 검증 (3) 결정론적 테스트 커버리지 요구 (4) 확률·AI 의존 로직 거부 (5) Stage Engine(P1)과 호환 보장  
- **금지**: (1) 비즈니스 로직 직접 작성 (2) 검증 체크포인트 생략 (3) Phase 조기 통합

---

## 4. 단계별 계획 (Phase P1–P8)

**주의**: 아래 **P1–P8은 Phase(단계)** 이지 Cursor 번호가 아니다. 각 Phase를 **어느 Cursor가 담당할지**는 §3·§6 참고.

**전제**: Phase 1(Stage Engine)이 완료되었거나 동일 명세로 호환 가능해야 함. Phase 2→3→4→5는 **Cursor 4(Commander)** 가 순서대로 진행하며, 각 Phase 완료 검증 후 다음으로 넘긴다.

| Phase | 내용 | 산출물 | 담당 Cursor |
|-------|------|--------|-------------|
| **P1** | Stage 상태·전이 로직 | 사용자별 Stage 저장, 전이 규칙 서비스, 결정론적 단위 테스트 | Cursor 1 |
| **P2** | AIR 계산 + 이벤트 로깅 | AIR 모듈(함수·데이터 요구·테스트) / 로그 스키마·저장(재계산 가능) | Cursor 1 + Cursor 2 |
| **P3** | Stage 4 강제 트리거 + 시나리오 | evaluate_forced_reset, reset_state_transition_handler, 테스트 / Stage4 시나리오 태그·Reset 템플릿·48h·검증 | Cursor 1 + Cursor 3 |
| **P4** | TII + 주간 스냅샷 | compute_team_tii, 주간 재계산 job 명세 / TeamWeeklyMetrics 불변 스냅샷 | Cursor 1 + Cursor 2 |
| **P5** | Certified / LRI | is_certified, compute_lri, approve_leader_track, 테스트 | Cursor 1 |
| **P6** | API·DB·마이그레이션 검증 | REST/내부 API, bty-release-gate D·E·F 충족 | Cursor 1 + Cursor 2 + Cursor 4 검증 |
| **P7** | UI 연동 (표시만) | Stage/AIR/TII/Certified API 값만 표시 | UI 담당 (별도 또는 Cursor 1) |
| **P8** | 최종 검증·문서 | 전이·AIR·Reset·TII·Certified 검증, RUNBOOK·CURRENT_TASK 반영 | Cursor 4 |

---

## 5. 복사용 프롬프트 (Cursor 1·2·3·4별)

> **안내:** 아래를 **해당 Cursor 번호(1–4)** 에 붙여 넣기 전에 `docs/AGENTS_SHARED_README.md`, **`docs/LEADERSHIP_ENGINE_SPEC.md`**, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` 를 열어 두라고 안내한다.

---

### TO: Cursor 1 — AIR 계산 모듈 (Phase P2)

**TO: Cursor 1 (P2)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7(도메인 명세)에 **산출물 파일 경로/요약/테스트 경로**를 업데이트하고, 필요 시 `docs/LEADERSHIP_ENGINE_SPEC.md`도 동기화한 뒤 **갱신본을 첨부**.

Design and implement the AIR computation module.

**Requirements:**

1. AIR is weighted:
   - micro_win activation weight = 1.0
   - reset activation weight = 2.0

2. AIR is calculated on rolling 7d, 14d, and 90d windows.

3. Missed activation windows:
   - Each missed window applies -0.10 penalty (floor at 0)
   - 3 consecutive missed windows triggers integrity_slip flag

4. AIR must be recalculable entirely from:
   - Activation logs
   - Verification logs
   - Timestamp fields

**Deliverables:**
- Function signatures
- Data model requirements
- Test cases (normal / penalty / edge case)

---

### TO: Cursor 2 — AIR용 이벤트 로깅 (Phase P2)

**TO: Cursor 2 (P2)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7(도메인 명세)에 **로그 테이블/필드/인덱스/마이그레이션/롤백**을 업데이트하고, 관련 스키마 파일 변경이 있으면 **갱신본을 첨부**.

Design the event logging system required for AIR.

**Must store:**
- activation_id
- user_id
- chosen_at
- due_at
- completed_at
- verified
- verifier_role

Ensure all AIR metrics are recomputable from raw logs.  
**No derived-only storage.**

---

### TO: Cursor 1 — Stage 4 강제 트리거 (Phase P3)

**TO: Cursor 1 (P3)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7에 **구현 경로/함수 시그니처/테스트**를 업데이트하고, `docs/LEADERSHIP_ENGINE_SPEC.md` Stage4/Reset 절과 불일치가 없게 동기화한 뒤 **갱신본을 첨부**.

Implement deterministic Stage 4 trigger logic.

Stage 4 (Integrity Reset) must trigger when **ANY TWO** of:

- Stage3 selected twice within 14 days
- AIR_7d < 0.70 for 2 consecutive weeks
- No QR verification for 7 days
- TSP declining for 2 consecutive weeks

**Constraints:**
- User may delay reset 48 hours max.
- Reset cannot be permanently dismissed.
- After completion → Stage returns to Stage1.

**Deliver:**
- evaluate_forced_reset(user_id)
- reset_state_transition_handler
- deterministic unit tests

---

### TO: Cursor 3 — Stage4 호환 시나리오 (Phase P3)

**TO: Cursor 3 (P3)**  
완료 후(필수): 마이그레이션/추가한 시나리오 파일 경로를 **로그 문서**(예: `docs/SCENARIO_MIGRATION_LOG.md`)에 업데이트하고, Stage4 호환 시나리오에는 `supports_reset: true` 및 Reset/48h/검증 경로 포함 여부를 체크한 뒤 **갱신본을 첨부**.

Ensure every Stage4-compatible scenario includes:

- Reset activation template
- 48-hour due window
- Verification path

Mark scenarios with tag:  
`"supports_reset": true`

---

### TO: Cursor 3 — 시나리오 이전 자동 진행 (scenarios.ts → bty_scenario_v1)

**TO: Cursor 3**  
아래 지시를 **그대로 수행**해줘. 남은 시나리오를 한 건씩 이전하면서 매 건마다 `docs/SCENARIO_MIGRATION_LOG.md`를 갱신해줘. 한 세션에서 **가능한 만큼 계속 진행**하고, 중단할 경우 문서에 "다음 이전 시작: 순서 N (소스 scenarioId OOO)" 를 남겨줘.

**사전에 열어 둘 문서·파일**  
`docs/SCENARIO_MIGRATION_LOG.md`, `docs/SCENARIO_MIGRATION_LOG.md` §2-1, `docs/specs/scenarios/SCN_WA_0001.json`, `docs/specs/scenarios/SCN_PT_0001.json`, `docs/specs/bty-scenario-schema-v1.json`, `src/lib/bty/scenario/scenarios.ts`.

**수행 순서 (한 건마다 반복)**

1. **§2 표**에서 이미 이전된 **소스 scenarioId** 목록을 확인해줘. `scenarios.ts`의 `SCENARIOS[]`에서 그 목록에 **없는** 첫 번째 항목을 골라줘. (이미 이전된 것: `patient_refuses_treatment_001`. 다음 후보: `front_desk_overbook_002`, `hygienist_questions_diagnosis_003`, … `you_realize_overreacted_045`.)
2. 해당 항목의 **원본 객체**(title, summary, choices, beats 등)를 `scenarios.ts`에서 읽어줘.
3. **SCN_WA_0001 / SCN_PT_0001** 구조를 참고해 **bty_scenario_v1** 형식의 새 JSON을 작성해줘. 필수 포함: `schema_version`, `scenario_id`(예: SCN_FD_0002), `context_type`, `scene.beats`, `choices[].engine_signals`(choice_type, risk_flags), `choices[].activation_plan`(type, weight, window_hours, steps, scripts, verification), `metrics_hooks`, `delayed_outcome`. choice_type은 내용에 맞게 `direct_fix_or_takeover` | `process_fix` | `delegate_with_checkpoint` | `withdraw` | `reset_relationship` | `cynicism_or_lower_expectations` 중에서 매핑해줘.
4. **저장**: `docs/specs/scenarios/SCN_<prefix>_<NNNN>.json`. prefix·NNNN은 소스 ID와 팀 규칙에 맞게 정해줘. (예: front_desk → FD, 002번째면 0002.)
5. **SCENARIO_MIGRATION_LOG.md**  
   - **§2 표**에 한 줄 추가: (순서, 소스 scenarioId, 이전 후 scenario_id, 파일 경로, 이전 일자, 비고(choice_type 매핑 등)).  
   - **§1 표**에 해당 파일 행 추가.  
   - 필요하면 **§5 변경 이력**에 `"소스ID → SCN_XXX_NNNN 이전"` 한 줄 추가.
6. **다음 시나리오**로 넘어가서 1~5를 반복해줘. `scenarios.ts`에 남은 시나리오가 없을 때까지 계속해줘.
7. **중단할 때**: §2-1 위나 §5에 "다음 이전 시작: 순서 N (소스 scenarioId OOO)" 를 한 줄 적어줘.

**완료 후(필수)**  
`docs/SCENARIO_MIGRATION_LOG.md` 갱신본을 첨부하고, 이전한 **시나리오 개수**와 **마지막으로 이전한 scenario_id**를 요약해줘.

---

### TO: Cursor 1 — Team Integrity Index (Phase P4)

**TO: Cursor 1 (P4)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7에 **compute_team_tii 구현 경로/테스트/주간 재계산 job 명세**를 업데이트하고 **갱신본을 첨부**.

Implement Team Integrity Index (TII).

**TII formula:**

```
TII = (Avg AIR × 0.60) + (Avg MWD_normalized × 0.25) + (TSP_normalized × 0.15)
```

**Normalization:**
- AIR: 0–1
- MWD: normalize by target threshold
- TSP: (score - 1) / 4

**Constraints:**
- Only team score is public.
- Individual AIR never exposed.

**Deliver:**
- compute_team_tii(team_id)
- weekly recomputation job spec

---

### TO: Cursor 2 — 주간 스냅샷 저장 (Phase P4)

**TO: Cursor 2 (P4)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7에 **TeamWeeklyMetrics 스키마/불변성(immutability) 보장 방식/마이그레이션/롤백**을 업데이트하고 **갱신본을 첨부**.

Create weekly snapshot storage:

```
TeamWeeklyMetrics {
  team_id,
  week_start,
  tii,
  avg_air,
  avg_mwd,
  tsp
}
```

Snapshots must be **immutable** once stored.

---

### TO: Cursor 1 — Certified / LRI (Phase P5)

**TO: Cursor 1 (P5)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7에 **구현 경로/함수 시그니처/테스트**를 업데이트하고, 필요 시 `docs/LEADERSHIP_ENGINE_SPEC.md` Certified/LRI 절을 동기화한 뒤 **갱신본을 첨부**.

Implement:

**A) Certified (Leader only)**  
Conditions:
- AIR_14d >= 0.80
- MWD_14d >= threshold
- Reset compliance met
- No integrity_slip in 14d

Certified is dynamic. Re-evaluated quarterly and weekly.

**B) LRI (Non-leader)**  
```
LRI = 0.50 * AIR_14d + 0.30 * MWD_normalized + 0.20 * personal_responsibility_pulse
```  
If LRI >= 0.80 → readiness_flag = true

Promotion requires: leader_approval(user_id, approver_id)

**Deliver:**
- is_certified(user_id)
- compute_lri(user_id)
- approve_leader_track()

---

### TO: Cursor 4 — Phase 순서·검증 (Gatekeeper)

**TO: Cursor 4 (Commander)**  
완료 후(필수): 각 Phase(P2→P3→P4→P5) 종료 시 **검증 체크리스트 결과**를 `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §8(검증 기록)에 남기고, 불합격이면 “보정 지시”를 문서로 남긴 뒤 **갱신본을 첨부**.

**Must:**
1. Sequence phases (2 → 3 → 4 → 5)
2. Validate module completion before next phase
3. Require deterministic test coverage
4. Reject any probabilistic or AI-dependent logic
5. Ensure compatibility with Stage Engine (Phase 1)

**Must not:**
- Write business logic directly
- Skip validation checkpoints
- Combine phases prematurely

---

### TO: Cursor 1 — Stage 상태·전이 (Phase P1, 전제)

Phase 2→3→4→5의 호환 전제. `docs/LEADERSHIP_ENGINE_SPEC.md` §2·§3 기준으로 구현.

- 사용자별 현재 Stage 저장. 전이 규칙 적용 서비스. **결정론적·데이터 기반** 동작.
- 단위 테스트 필수. UI는 Stage 표시만, 전이 계산은 API/도메인만.
- **완료 후(필수):** §7에 구현 경로·테스트를 반영하고 **갱신본을 첨부**.

---

### TO: Cursor 1 — API·엔진 점검 (Phase P6)

**TO: Cursor 1 (P6)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7에 **API 목록·엔드포인트·요청/응답 요약**을 반영한 뒤 **갱신본을 첨부**.

- Stage/AIR/Reset/TII/Certified/LRI 관련 **REST 또는 내부 API**를 정리한다. 응답에는 **계산된 값만** 포함하고, UI는 그대로 표시만 하도록 한다.
- 엔드포인트별 역할·계약이 `docs/LEADERSHIP_ENGINE_SPEC.md` 및 bty-release-gate **E항목(API 계약)** 과 맞는지 확인한다.
---

### TO: Cursor 2 — DB·마이그레이션 점검 (Phase P6)

**TO: Cursor 2 (P6)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7에 **마이그레이션 목록·롤백 방법**이 빠짐없이 있는지 확인·보완하고 **갱신본을 첨부**.

- 새 테이블·인덱스·제약을 나열하고, **롤백 SQL 또는 절차**를 §7 또는 RUNBOOK에 적는다.
- bty-release-gate **D항목(Data/Migration Safety)** — 마이그레이션 경로·롤백·Core XP/Weekly XP 분리 등 — 충족 여부를 점검한다.

---

### TO: Cursor 4 — P6 검증·기록 (Phase P6)

**TO: Cursor 4 (P6)**  
완료 후(필수): P6 검증 체크리스트를 실행한 뒤 **결과를** `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` **§8(검증 기록)** 에 한 줄 추가하고, 불합격이면 보정 지시를 문서에 남긴 뒤 **갱신본을 첨부**.

- Cursor 1·2의 P6 산출물을 기준으로 **bty-release-gate D·E·F** 전체 충족 여부를 검증한다.
- §8에 일시, Phase P6, 결과(통과/보정 필요), 비고를 기록한다.

---

### TO: UI 담당 (또는 Cursor 1) — UI 연동 표시만 (Phase P7)

**TO: UI 담당 또는 Cursor 1 (P7)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7에 **연동한 화면·API 호출 경로**를 한 줄로 반영하고 **갱신본을 첨부**.

- 대시보드·필요한 화면에서 **Stage, AIR, TII(팀만), Certified/LRI** 상태를 **API에서 받은 값만** 표시한다.
- UI에서 Stage 전이·AIR·TII·Certified 계산·랭킹 로직을 **구현하지 않는다**. `.cursor/rules/bty-ui-render-only.mdc` 준수.

---

### TO: Cursor 4 — 최종 검증·문서 (Phase P8)

**TO: Cursor 4 (P8)**  
완료 후(필수): `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §8(검증 기록)에 **P8 최종 검증 결과**를 채우고, RUNBOOK·CURRENT_TASK·WHAT_NEXT 등에 반영한 뒤 **갱신본을 첨부**.

- Stage 전이 규칙·AIR 수식·Reset 조건·TII·Certified/LRI가 **`docs/LEADERSHIP_ENGINE_SPEC.md`** 와 일치하는지 검증한다.
- **bty-arena-global**, **bty-release-gate**, **bty-ui-render-only** 위반이 없는지 확인한다.
- 결과를 이 문서 **§8 검증 기록**에 요약해 넣는다. (일시, Phase P8, 결과, 비고)

---

## 6. 누가 뭘 할지 한눈에 (Phase ↔ Cursor)

**P1–P8 = Phase(단계), Cursor 1–4 = 담당자.**

| Phase | 할 일 | 담당 Cursor |
|-------|--------|-------------|
| P1 | Stage 저장·전이 로직·결정론적 테스트 | Cursor 1 |
| P2 | AIR 계산(함수·데이터 요구·테스트) | Cursor 1 |
| P2 | 이벤트 로깅 스키마·저장(AIR 재계산 가능, 파생 전용 저장 금지) | Cursor 2 |
| P3 | Stage 4 강제 트리거(evaluate_forced_reset, reset_state_transition_handler, 테스트) | Cursor 1 |
| P3 | Stage4 시나리오(Reset 템플릿, 48h, 검증 경로, supports_reset 태그) | Cursor 3 |
| P4 | TII(compute_team_tii, 주간 job 명세) | Cursor 1 |
| P4 | TeamWeeklyMetrics 주간 스냅샷(불변 저장) | Cursor 2 |
| P5 | Certified / LRI(is_certified, compute_lri, approve_leader_track) | Cursor 1 |
| P6 | API·DB·마이그레이션 + bty-release-gate 검증 | Cursor 1 + Cursor 2 + Cursor 4 |
| P7 | UI 표시만 (API 값만) | UI 담당 |
| P8 | 최종 검증·문서 | Cursor 4 |

---

## 7. 도메인 명세 (산출물 링크)

### Leadership Engine REST API 목록 (P6)

| 메서드 | 엔드포인트 | 용도 | 인증 |
|--------|------------|------|------|
| GET | `/api/arena/leadership-engine/state` | 현재 Stage·Reset due 조회 | authenticated |
| GET | `/api/arena/leadership-engine/air` | AIR 7d/14d/90d (원시 로그 기반 재계산) | authenticated |
| GET | `/api/arena/leadership-engine/tii` | 팀 TII (활성 리그 = team_id, team_weekly_metrics) | authenticated |
| GET | `/api/arena/leadership-engine/certified` | Certified 상태 (Leader, 도메인 입력 기반) | authenticated |
| POST | `/api/arena/leadership-engine/transition` | Stage 전이 적용 (도메인 규칙) | authenticated |

**요청/응답 요약**

- **GET `/api/arena/leadership-engine/state`**
  - **요청**: 쿼리/바디 없음. 쿠키 세션으로 `user_id` 식별.
  - **응답 200**: `{ currentStage: 1|2|3|4, stageName: string, forcedResetTriggeredAt: string | null, resetDueAt: string | null }`. `resetDueAt` = triggeredAt + 48h (Stage 4 강제 시).
  - **응답 401**: 미인증 시 `unauthenticated` 처리.
  - **캐싱**: 명시 없음. UI는 API 값만 표시(bty-ui-render-only).

- **POST `/api/arena/leadership-engine/transition`**
  - **요청 body**: `{ context: StageTransitionContext }`. `context` 값: `"repeat_1_without_delegation"` | `"repeat_2_without_corrective_activation"` | `"air_below_threshold"` | `"stage_4_completion"`.
  - **응답 200**: `{ applied: boolean, currentStage: 1|2|3|4, previousStage: 1|2|3|4 | null, stageName: string }`.
  - **응답 400**: `{ error: "INVALID_JSON" }` 또는 `{ error: "INVALID_CONTEXT", allowed: StageTransitionContext[] }`.
  - **응답 401**: 미인증.
  - **비고**: 전이 규칙은 도메인 `getNextStage(currentStage, context)`에서만 계산; API는 결과만 반영·반환.

- **GET `/api/arena/leadership-engine/air`** (P7): 응답 `{ air_7d, air_14d, air_90d }` (각각 `{ air, missedWindows, integritySlip }`). le_activation_log + le_verification_log 기반 도메인 `computeAIRSnapshot` 호출.
- **GET `/api/arena/leadership-engine/tii`** (P7): 응답 `{ tii, avg_air, avg_mwd, tsp } | null`. 활성 리그의 league_id를 team_id로 사용, `team_weekly_metrics` 최신 주 1건 반환.
- **GET `/api/arena/leadership-engine/certified`** (P7): 응답 `{ current, reasons_met, reasons_missing }`. AIR 14d·integritySlip는 로그 기반, MWD/Reset은 스텁 가능.

**P7 UI 연동 (연동 화면·API 호출 경로)**  
대시보드: `[locale]/bty/(protected)/dashboard` (`page.client.tsx`) — GET `state`, GET `air`, GET `tii`, GET `certified` 호출. Stage·Reset due·AIR(7d/14d/90d)·팀 TII·Certified를 API 응답 값만 표시(UI에서 계산 없음). 프로필 전용 페이지 없음; 대시보드에서만 표시.

AIR/TII/Certified/LRI는 도메인·서비스 레이어에서 계산되며, P7에서 GET air·tii·certified 엔드포인트 및 대시보드 표시 연동 완료.

---

- **Stage 상수·전이 규칙**: `src/domain/leadership-engine/stages.ts` — 4 Core Stage 상수(STAGE_1~4)·이름(STAGE_NAMES)·전이 컨텍스트 타입(StageTransitionContext)·순수 함수 `getNextStage(currentStage, context) → Stage | null`. 규칙: 반복 1 without delegation → 2, 반복 2 without corrective activation → 3, 3 + AIR below threshold → 4, Stage 4 completion → 1.
- **Stage 상태·전이 서비스 (P1)**: `src/lib/bty/leadership-engine/state-service.ts` — `getLeadershipEngineState`, `applyStageTransition`, `ensureLeadershipEngineState`. API: GET `/api/arena/leadership-engine/state`, POST `/api/arena/leadership-engine/transition` (body `{ context }`). 테스트: `src/domain/leadership-engine/stages.test.ts`, `src/lib/bty/leadership-engine/state-service.test.ts`.
- **DB (P1)**: `supabase/migrations/20260312000000_leadership_engine_state.sql` — 테이블 `leadership_engine_state` (user_id PK, current_stage 1–4, stage_entered_at, updated_at). RLS: 본인만 select/insert/update. **롤백**: `DROP TABLE IF EXISTS public.leadership_engine_state CASCADE;`
- **AIR 수식·함수 (P2 완료)**: `src/domain/leadership-engine/air.ts`
  - **타입**: `ActivationRecord` (activation_id, user_id, type, chosen_at, due_at, completed_at, verified), `AIRResult` { air, missedWindows, integritySlip }, `AIRSnapshot` { air_7d, air_14d, air_90d }, `ActivationType` ("micro_win" | "reset"), `AIRPeriod` ("7d" | "14d" | "90d").
  - **상수**: `WEIGHT_MICRO_WIN = 1.0`, `WEIGHT_RESET = 2.0`, `MISSED_WINDOW_PENALTY = 0.10`, `CONSECUTIVE_MISS_THRESHOLD = 3`.
  - **함수**: `computeAIR(activations, period, asOf) → AIRResult` — 가중 AIR = Σ(completed+verified weight) / Σ(chosen weight), 미실행 창 -0.10 패널티(floor 0), integrity_slip 플래그.
  - **함수**: `detectIntegritySlip(activations, asOf) → boolean` — due_at 순서 기준 3연속 미실행 시 true.
  - **함수**: `computeAIRSnapshot(activations, asOf) → AIRSnapshot` — 7d/14d/90d 한 번에 계산.
  - **레거시**: `AIRLedger` 타입, `hasThreeConsecutiveNonExecutionWarning(ledger)` — P0/P1 호환용 deprecated.
  - **테스트**: `src/domain/leadership-engine/air.test.ts` — 25 케이스 (normal 5, penalty 4, integrity_slip 4, window filtering 4, snapshot 2, edge 4, legacy 2). **PASS**.
- **AIR 이벤트 로깅 스키마 (P2 Infrastructure 완료)**: `supabase/migrations/20260313000000_leadership_engine_activation_logs.sql`
  - **테이블 `le_activation_log`**: `id` bigserial PK, `activation_id` uuid UNIQUE, `session_id` uuid null, `user_id` uuid FK, `type` text CHECK (micro_win|reset), `weight` numeric(4,2) default 1.0, `chosen_at` timestamptz, `due_at` timestamptz, `completed_at` timestamptz null, `created_at` timestamptz.
  - **인덱스**: `(user_id, chosen_at DESC)` — 롤링 윈도우 쿼리, `(user_id, due_at DESC)` — missed detection, `(session_id) WHERE NOT NULL` — 세션 스코프.
  - **테이블 `le_verification_log`**: `id` bigserial PK, `activation_id` uuid FK, `user_id` uuid FK, `verifier_id` uuid null FK, `verifier_role` text null, `verified` boolean, `verified_at` timestamptz, `method` text null, `created_at` timestamptz.
  - **인덱스**: `(activation_id, verified_at DESC)` — 최신 검증 조회, `(user_id, verified_at DESC)` — 유저별 AIR 조인.
  - **RLS**: 양 테이블 모두 `auth.uid() = user_id` — select/insert 본인만. activation_log는 update(completed_at 설정)도 본인만. service_role은 RLS 바이패스.
  - **재현성**: 모든 AIR 지표는 이 두 테이블의 원시 로그만으로 재계산 가능. 파생 전용 저장 없음.
  - **도메인 매핑**: `le_activation_log` → `ActivationRecord` (air.ts). verification은 `le_verification_log.verified = true` 인 최신 행으로 `ActivationRecord.verified` 판정.
  - **롤백**: `DROP TABLE IF EXISTS public.le_verification_log CASCADE; DROP TABLE IF EXISTS public.le_activation_log CASCADE;`
- **TII 수식·함수 (P4 완료)**: `src/domain/leadership-engine/tii.ts`
  - **수식**: TII = (Avg AIR × 0.60) + (Avg MWD_normalized × 0.25) + (TSP_normalized × 0.15). 정규화: AIR 0–1, MWD = min(mwd/target_mwd, 1) target_mwd 기본 0.30, TSP = (score−1)/4 (1..5→0..1).
  - **함수**: `computeTII(inputs: TIIInputs) → number`, `computeTIIWithComponents(inputs) → TIIResult` (팀 수준만 반환, 개인 AIR 미노출). `normalizeAIR`, `normalizeMWD`, `normalizeTSP` 내보냄.
  - **테스트**: `src/domain/leadership-engine/tii.test.ts` — 15 케이스 (normalize 8, computeTII 5, computeTIIWithComponents 2). **PASS**.
- **TII 서비스 (P4)**: `src/lib/bty/leadership-engine/tii-service.ts` — `compute_team_tii(teamId, getInputs, weekStart?) → Promise<TIIResult>`. `GetTeamTIIInputs`는 Infrastructure가 구현 (팀별 AIR/MWD/TSP 집계). 테스트: `src/lib/bty/leadership-engine/tii-service.test.ts` (3). **PASS**.
- **TII 주간 재계산 job 명세**: `docs/TII_WEEKLY_JOB_SPEC.md` — 주기(매주), 입력 수집(팀별 Avg AIR/MWD/TSP), `compute_team_tii` 호출, 불변 스냅샷 저장(TeamWeeklyMetrics). 개인 AIR 미노출·결정론 유지.
- **TeamWeeklyMetrics 스키마 (P4 Infrastructure 완료)**: `supabase/migrations/20260315000000_team_weekly_metrics.sql`
  - **테이블 `team_weekly_metrics`**: `team_id` text NOT NULL, `week_start` date NOT NULL, `tii` numeric(5,4) 0..1, `avg_air` numeric(5,4) 0..1, `avg_mwd` numeric(5,4), `tsp` numeric(3,2) 1..5, `created_at` timestamptz. PK `(team_id, week_start)`. 인덱스: `(week_start DESC)`.
  - **불변성**: BEFORE UPDATE OR DELETE 트리거 `team_weekly_metrics_immutable_trigger` → `team_weekly_metrics_immutable()` 호출, 예외 발생으로 UPDATE/DELETE 차단. INSERT만 허용(주간 job이 service_role로 삽입).
  - **RLS**: `authenticated` — SELECT만 허용(팀 TII 공개). INSERT는 RLS 정책 없음 → service_role(주간 job)만 RLS 우회로 INSERT.
  - **롤백**: `DROP TRIGGER IF EXISTS team_weekly_metrics_immutable_trigger ON public.team_weekly_metrics; DROP FUNCTION IF EXISTS public.team_weekly_metrics_immutable(); DROP TABLE IF EXISTS public.team_weekly_metrics CASCADE;`
- **Reset 강제 조건 (P3 완료)**: `src/domain/leadership-engine/forced-reset.ts` — 순수 함수 `evaluateForcedReset(inputs) → { shouldTrigger, reasons }`. 조건 4개 중 **어느 두 개** 만족 시 Stage 4 강제: (1) Stage3 14일 내 2회 선택 (2) AIR_7d < 0.70 2주 연속 (3) QR 미검증 7일 (4) TSP 2주 연속 하락. `getResetDueAt(triggeredAt)` = triggeredAt + 48h. `src/lib/bty/leadership-engine/state-service.ts` — `triggerForcedResetToStage4(supabase, userId)`, `resetStateTransitionHandler(supabase, userId, inputs)`. DB: `leadership_engine_state.forced_reset_triggered_at` (마이그레이션 `20260314000000_leadership_engine_state_forced_reset.sql`). 4→1 전이 시 해당 컬럼 null로 초기화. 테스트: `src/domain/leadership-engine/forced-reset.test.ts` (9), `state-service.test.ts` (trigger/handler 4).
- **Certified (P5 완료)**: `src/domain/leadership-engine/certified.ts`
  - **조건**: AIR_14d >= 0.80, MWD_14d >= threshold, Reset compliance met, No integrity_slip in 14d. Certified는 동적·분기/주간 재평가.
  - **타입**: `CertifiedInputs` (air14d, mwd14d, resetComplianceMet, noIntegritySlipIn14d, mwdThreshold?), `CertifiedStatusResult` (current, reasons_met, reasons_missing).
  - **상수**: `CERTIFIED_AIR_14D_MIN = 0.8`, `CERTIFIED_MWD_THRESHOLD_DEFAULT` (TII와 동일).
  - **함수**: `isCertified(inputs) → boolean`, `certifiedStatus(inputs) → CertifiedStatusResult`.
  - **테스트**: `src/domain/leadership-engine/certified.test.ts` — 10 케이스 (all met, AIR/MWD/reset/slip 단일 실패, 경계, 복수 실패). **PASS**.
- **LRI (P5 완료)**: `src/domain/leadership-engine/lri.ts`
  - **수식**: LRI = 0.50×AIR_14d + 0.30×MWD_normalized + 0.20×personal_responsibility_pulse (1..5 → 0..1). LRI >= 0.80 && no integrity_slip → readiness_flag = true.
  - **타입**: `LRIInputs`, `LRIResult` (lri, readiness_flag, reasons). `canApproveLeaderTrack(candidateReadinessFlag, approverIsCertifiedLeader) → boolean`.
  - **함수**: `computeLRI(inputs) → LRIResult`, `normalizePersonalPulse(pulse)`.
  - **테스트**: `src/domain/leadership-engine/lri.test.ts` — 13 케이스 (normalize, formula, readiness_flag, canApproveLeaderTrack). **PASS**.
- **Certified/LRI 서비스 (P5)**: `src/lib/bty/leadership-engine/certified-lri-service.ts` — `getCertifiedStatus(userId, getInputs)`, `isUserCertified(userId, getInputs)`, `getLRI(userId, getInputs)`, `approveLeaderTrack(supabase, userId, approverId, getLRIInputs, getCertifiedInputs)`. 입력은 API/Infrastructure가 `GetCertifiedInputs`/`GetLRIInputs`로 제공. 테스트: `src/lib/bty/leadership-engine/certified-lri-service.test.ts` (7). **PASS**.
- **Leader track 저장 (P5)**: `supabase/migrations/20260316000000_leadership_engine_leader_track.sql` — `leadership_engine_state`에 `is_leader_track` (boolean default false), `leader_approved_at`, `leader_approver_id` (FK auth.users). **롤백**: 동일 마이그레이션 주석 참고.

---

## 8. 검증 기록

| 일시 | Phase | 결과 | 비고 |
|------|-------|------|------|
| 2025-02-28 (완료) | P8 | 통과 | SPEC 일치·bty-arena-global·bty-release-gate·bty-ui-render-only 위반 없음. CURRENT_TASK·WHAT_NEXT §1-7 반영. |

---

## 9. 참고 문서

| 문서 | 용도 |
|------|------|
| **`docs/LEADERSHIP_ENGINE_SPEC.md`** | **Stage/AIR/Reset/TII/Certified/LRI/Mirror 로직·규칙·스키마 단일 명세**. 구현 시 이 파일 기준. |
| `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md` | 시나리오 스키마 정합성·역할 분담(Cursor 1–4 참조) |
| `docs/COMMANDER_CURSORS_REF.md` | 커맨더·Cursor 역할 |
| `docs/NEXT_STEPS_RUNBOOK.md` | 진행/검증 프롬프트 |
| `docs/AGENTS_SHARED_README.md` | 공통 규칙·경로 |
| `.cursor/rules/bty-arena-global.mdc`, `bty-release-gate.mdc` | Arena/XP/리더보드 규칙 |
| `.cursor/rules/bty-ui-render-only.mdc` | UI 렌더만 |

---

*이 문서는 ENGINE ARCHITECTURE DIRECTIVE를 bty-app에서 단계별로 구현하기 위한 계획·복사용 프롬프트입니다. **P1–P8 = Phase(단계)**, **Cursor 1–4 = 담당 역할**이며, 나(커맨더)가 순서·검증을 조율합니다. 구현이 진행되면 §7·§8을 갱신할 것.*
