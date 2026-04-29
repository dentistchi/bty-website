# 엔진 명세 ↔ 시나리오 스키마 정합성 검토 및 역할 분담

**목적**: (1) `LEADERSHIP_ENGINE_SPEC`의 index/엔진 정의가 시나리오 스키마 `bty_scenario_v1`과 맞는지 검토하고, (2) 누가 어떤 작업을 담당할지 명시한다.  
**실행 방식**: 사용자가 이 문서를 기준으로 각 Cursor에 복사·실행 지시. 각 Cursor는 **완료 시 해당 서류를 갱신·첨부**. 건의/이슈가 있으면 서류를 읽고 보정 지시를 내린다.

---

## 1. 참조 문서

| 문서 | 용도 |
|------|------|
| `docs/LEADERSHIP_ENGINE_SPEC.md` | Stage/AIR/Reset/TII/Certified/LRI/Mirror 로직·스키마 단일 명세 |
| `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` | Phase별 계획·복사용 프롬프트 |
| `docs/specs/bty-scenario-schema-v1.json` | 시나리오 스키마 정의 (bty_scenario_v1) |
| `docs/specs/scenarios/SCN_WA_0001.json` | 시나리오 예시 (Handoff Breakdown) — 마이그레이션 참조용 |
| `docs/specs/scenarios/SCN_RESET_0001.json` | Stage4 전용 시나리오 (Integrity Reset, 48h, 검증 경로) |
| `docs/SCENARIO_MIGRATION_LOG.md` | 시나리오 추가/변경 로그 및 Stage4 호환 체크 |

---

## 2. 정합성 검토 (Fit Check)

### 2.1 가정

- 시나리오는 **콘텐츠 레이어**. 엔진은 **세션·선택·활성화 로그**만으로 Stage/AIR/Reset/TII 등을 계산한다.
- 시나리오 JSON의 `engine_signals`, `activation_plan`, `metrics_hooks`는 **엔진이 소비하는 입력**이다. UI는 이 값을 "해석"하지 않고, API가 준 결과만 표시한다.

### 2.2 매핑 요약

| 시나리오 스키마 | 엔진 명세 | 비고 |
|-----------------|-----------|------|
| `context_type` (process \| conflict \| pressure \| relationship) | `Session.context_type` | 일치. Mirror 시 동일 context 유지에 사용. |
| `choices[].engine_signals.choice_type` | Stage 전이 규칙 | 아래 2.3 참고. |
| `choices[].engine_signals.risk_flags` | Stage 해석 보조 | speed_bias→Stage1, cynicism→Stage2, avoidance→Stage3. 엔진은 **choice_type**으로만 전이 판단; risk_flags는 로깅/분석용. |
| `activation_plan.type` (micro_win \| reset) | `Activation.type` | 일치. |
| `activation_plan.weight` | AIR 가중치 | reset=2.0, micro_win=1.0; 시나리오 weight는 엔진이 그대로 사용 가능. |
| `activation_plan.window_hours` | `Activation.due_at` | due_at = chosen_at + window_hours. |
| `activation_plan.verification.method` "qr" | `Activation.verified`, `verifier_id` | QR 검증 완료 시 verified=true. |
| `activation_plan.verification.verifier_role` | 검증자 역할 | Manager/LeaderPeer/DSO/Self — 검증 정책용. |
| `metrics_hooks.air.counts_activation` | AIR 분모·분자 | true면 해당 선택 시 Activation 생성, AIR에 포함. |
| `metrics_hooks.mwd.micro_win` | MWD 분자 | micro_win 타입 완료·검증 시 MWD에 반영. |
| `metrics_hooks.tsp.weekly_pulse_prompt` | TSP 설문 문항 | 주간 펄스 문구로 저장·사용. |
| `delayed_outcome.delay_days` (14) | 재진입·지연 결과 | 14일 후 재진입 시 `delayed_outcome.outcomes` 노출. |
| `delayed_outcome.reentry_conditions.if_choice_types_in_last_14d` | 재진입 조건 | 엔진이 최근 14일 선택 이력으로 조건 평가. |
| `delayed_outcome.outcomes[].if.pattern` | 패턴 (예: repeated_direct_fix) | **엔진 확장 필요**: 14일 창 내 choice_type/activation 완료 패턴으로 O1/O2 등 결정. |
| `supports_reset` (시나리오 루트) | Stage4 호환 여부 | `true`이면 해당 시나리오가 Stage4(Integrity Reset) 플로우에서 사용 가능. **필수**: 최소 1개 choice에 `activation_plan.type === "reset"`, `window_hours === 48`, `verification` 경로 포함. |

### 2.3 choice_type ↔ Stage 전이

엔진 명세의 Stage 전이에는 다음이 사용된다.

- **Stage1→2**: `choice_type === "direct_fix_or_takeover"` 2회 이상 + missedActivationCount ≥ 2 (7일).
- **Stage2→3**: `choice_type === "cynicism_or_lower_expectations"` 2회 이상 + completedRelationshipResetActivation === 0 + TSP 등.
- **Stage3→4**: Reset 모듈 강제 조건.
- **Stage4→1**: Reset activation completed + verified.

시나리오 스키마의 `choice_type` enum에 **`cynicism_or_lower_expectations`** 가 포함되어 있어야 Stage2 시나리오를 표현할 수 있다.  
→ `docs/specs/bty-scenario-schema-v1.json`에는 이미 포함됨. 새 시나리오 작성 시 이 값을 쓰는 선택지를 추가하면 됨.

### 2.4 결론 (정합성)

- **PASS**: 현재 엔진 index/정의는 시나리오 스키마와 호환된다.
- **권장**: `delayed_outcome.outcomes[].if.pattern` 평가를 위한 "패턴 규칙"을 `LEADERSHIP_ENGINE_SPEC` 또는 별도 "Delayed Outcome 규칙" 절에 명시할 것. (예: `repeated_direct_fix` = 14일 내 direct_fix_or_takeover ≥ 2회, `delegation_micro_wins_present` = 14일 내 delegate_with_checkpoint 선택 + 해당 activation 완료·검증 ≥ 1.)

---

## 3. 역할 분담 (Cursor 1·2·3·4)

**구분**: **P1–P8 = Phase(단계)**, **Cursor 1–4 = 담당자**. Phase 번호와 Cursor 번호를 혼동하지 말 것.  
Phase 순서·검증 게이트는 **`docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`** §3·§4·§6 참고.

아래를 **해당 Cursor(1–4)** 에 복사해 붙여 넣고 실행하라고 지시하면 된다. 완료 시 해당 Cursor는 **서류를 갱신·첨부**하고, 건의 사항이 있으면 서류에 기록한 뒤 보정 지시를 요청한다.

---

### Cursor 1 (Engine) — 엔진·도메인 로직

**담당**:  
- `LEADERSHIP_ENGINE_SPEC` 기준 Stage 전이(P1), **AIR 계산(P2)**, **Stage 4 강제 트리거(P3)**, **TII(P4)**, **Certified/LRI(P5)** 도메인·로직 구현.  
- 시나리오 JSON의 `engine_signals`, `activation_plan`, `metrics_hooks`를 **소비**하는 서비스/API (선택 저장 시 Activation 생성, AIR/주간 지표 재계산 등).  
- 함수 시그니처·데이터 모델 요구사항·**결정론적 단위 테스트**. 확률·AI 의존 로직 금지.

**참고 문서**:  
`docs/LEADERSHIP_ENGINE_SPEC.md`, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`, `docs/specs/bty-scenario-schema-v1.json`, `docs/specs/scenarios/SCN_WA_0001.json`.

**완료 시**:  
구현한 모듈·API를 명세 또는 계획서의 "구현 현황" 절에 반영하고, 변경된 서류를 첨부/갱신.

---

### Cursor 2 (Infrastructure) — 로깅·스냅샷 저장

**담당**:  
- **AIR용 이벤트 로깅** 스키마·저장(activation_id, user_id, chosen_at, due_at, completed_at, verified, verifier_role). 모든 AIR 지표가 **원시 로그만으로 재계산 가능**. 파생 전용 저장 금지.  
- **TeamWeeklyMetrics** 주간 스냅샷(team_id, week_start, tii, avg_air, avg_mwd, tsp). 저장 후 **불변**.

**참고 문서**:  
`docs/LEADERSHIP_ENGINE_SPEC.md`, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`, `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md`.

**완료 시**:  
스키마·마이그레이션·롤백 방법을 서류에 반영하고 갱신본 첨부.

---

### Cursor 3 (Scenario) — 시나리오·Stage4 호환

**담당**:  
- 기존 시나리오를 **bty_scenario_v1** 형식으로 마이그레이션. `engine_signals`, `activation_plan`, `metrics_hooks`, `delayed_outcome` 필수.  
- **Stage4 호환** 시나리오: Reset activation 템플릿, 48시간 due window, 검증 경로 포함. 태그 `"supports_reset": true`.  
- 참조: `docs/specs/scenarios/SCN_WA_0001.json`.

**참고 문서**:  
`docs/specs/bty-scenario-schema-v1.json`, `docs/specs/scenarios/SCN_WA_0001.json`, `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md`, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`.

**완료 시**:  
마이그레이션 목록·경로를 `docs/SCENARIO_MIGRATION_LOG.md` 등에 기록하고 해당 서류 첨부. 스키마/엔진 이슈는 서류에 건의 후 보정 지시 요청.

---

### Cursor 4 (Commander) — Phase 순서·검증

**담당**:  
- **Phase 2→3→4→5 순서** 유지. 다음 Phase 전 **모듈 완료 검증**.  
- **결정론적 테스트 커버리지** 요구. 확률·AI 의존 로직 **거부**.  
- **Stage Engine(Phase 1)** 과 호환 확인.  
- 비즈니스 로직 직접 작성 금지. 검증 체크포인트 생략·Phase 조기 통합 금지.

**참고 문서**:  
`docs/LEADERSHIP_ENGINE_SPEC.md`, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`, `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md`.

**완료 시**:  
검증 결과·게이트 통과 기록을 계획서 §8 검증 기록에 반영하고 서류 갱신·첨부.

---

### UI / Arena (별도 또는 Cursor 1 보조)

**담당**:  
- Arena XP·주간 XP·리더보드·시즌·아바타 등 기존 작업.  
- 엔진 연동 시: **Stage/AIR/TII/Certified**는 **API에서 받은 값만 표시**, 계산·랭킹 로직 금지.

**참고 문서**:  
`docs/LEADERSHIP_ENGINE_SPEC.md` §12 BTY 연동, `bty-arena-global`, `bty-release-gate`.

**완료 시**:  
변경한 UI/연동 내용을 해당 서류나 CURRENT_TASK에 반영하고 갱신본 첨부.

---

## 4. 완료 시 서류 갱신 규칙

- 각 Cursor는 담당 작업 완료 시 **위 "완료 시"** 에 따라 해당 서류를 **갱신·첨부**한다.  
- **건의 사항/이슈**가 있으면 해당 서류에 "건의 사항" 절을 추가하거나 이슈 목록에 기록한 뒤, **보정 지시**를 요청한다. (다른 Cursor 또는 커맨더가 서류를 읽고 보정 명령을 내리거나, 명세를 수정한다.)

---

## 5. 다음 단계 체크리스트

- [ ] **Cursor 1**: P1 Stage → P2 AIR → P3 Stage4 트리거 → P4 TII → P5 Certified/LRI (순서는 Cursor 4가 관리)
- [ ] **Cursor 2**: P2 이벤트 로깅 → P4 TeamWeeklyMetrics 스냅샷
- [ ] **Cursor 3**: Stage4 호환 시나리오(supports_reset, Reset 템플릿, 48h, 검증) + 마이그레이션 로그
- [ ] **Cursor 4**: Phase P2→P3→P4→P5 검증 게이트, 결정론적 테스트 요구, 문서 갱신
- [ ] **UI/Arena**: 엔진 지표 API 값만 표시

Phase 순서·복사용 프롬프트는 **`docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`** §5·§6 참고.

---

*이 문서는 엔진 명세와 시나리오 스키마의 정합성 검토 및 역할 분담용입니다. 수정 시 `docs/ENGINE_SCENARIO_FIT_AND_ROLES.md`를 갱신하세요.*
