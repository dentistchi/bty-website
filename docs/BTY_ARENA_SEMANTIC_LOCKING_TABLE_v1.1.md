# BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.1

**Status:** Stage 0 산출물. Cursor 코드화 진입 전 semantic gate.
**Authority precedence:** Server `ArenaRuntimeStateId` > Client `jsonFlow.state` > UI surface.
**Frozen decisions:** Commander 결정값 6개 (본 문서 §3). 변경 시 v2 필요.
**Source files:** `arenaRuntimeSnapshot.types.ts:9` (server gate), `data/scenario/index.ts:500` (client UI state).
**Filename note:** in-document version marker is **v1.1.1**; filename remains `BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md` per the Stage 0 `ba1d375` filename-stability lesson — renaming the file would break every cross-doc reference.

---

## 0. Changelog (v1 → v1.1.1)

v1.1은 Stage 1 proposal phase에서 표면화된 ambiguity 중 v1 자체 결함 5건을 정정. 신규 결정 없음, 기존 의도 명료화만.

| 정정 | v1 문제 | v1.1 조치 |
|---|---|---|
| **C-A3** | §10은 "D1을 Stage 1 entry에 결정"하라 했고 §9-D1은 "Lobby 코드화 시(Stage 2) 결정"이라 함 — timing 모순 | §9-D1 기준으로 통일. D1은 **Stage 2 Lobby 코드화 시 결정**. §10은 "D1 flag 표기"로 약화 (결정 아님) |
| **C-A4** | §11이 Stage 2 순서를 "권장"으로 표기 | Commander가 lock 확정함. §11에서 **LOCKED**로 변경 |
| **C-A5 + C-A9** | §2 Authority가 단일 컬럼 — REEXPOSURE_DUE의 server-trigger/client-render 2-layer 표현 불가 | §2 Authority를 **Trigger Authority / Render Authority 2-컬럼**으로 분리 |
| **C-A8** | §12 끝 self-location이 `bty-app/docs/...`로 stale (실제는 outer `docs/`) | 실제 outer 경로로 수정 |

A1(Hub 정체)·A2(HK6)·A6(NEXT_SCENARIO 분리)·A7(Foundry shape)은 v1 결함 아님 — Stage 1 매핑 doc에서 처리. A2는 Cursor 코드 검증으로 closed (no impact).

### v1.1 → v1.1.1 (2026-05-14)

v1.1.1은 Stage 2 step 4 (Center) 코드화 entry 시점에 표면화된 §5.5 outlier framing을 정정. 신규 결정 없음, scope 정확화만.

| 정정 | v1.1 문제 | v1.1.1 조치 |
|---|---|---|
| **§5.5 / §8-5 scope** | §5.5는 Center 전체를 "system interrupt surface (FD-5)" / "safe room 아님"으로 표기, §8-5는 menu/dashboard 표현 전면 금지. 그러나 4개 FINAL LOCKED 문서 (`BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` Screens 9-13, `BTY_CURSOR_MASTER_PROMPT.md` Recovery layer, `BTY_MASTER_BUILD_V1.md` §6, `LEADERSHIP_ENGINE_SPEC.md` §5) + 라이브 제품 (`/center` route가 Dear-Me / Resilience / Self-esteem / Healing Phase Tracker 통합 surface)이 Center = recovery surface (default) + FORCED_RESET sub-mode (override)임을 일관되게 정의. §5.5는 outlier. | §5.5를 default recovery surface + FORCED_RESET override sub-mode 2-mode 구조로 재정의. §8-5 prohibition은 sub-mode scope로 한정. §6 prohibition/requirement는 sub-mode scope로 한정 (§6.2/§6.3 header reframe + §6 top-level scope clarifier 추가). §2 row 8 / §3 FD-5 / §8-7 변경 없음 (이미 sub-mode-scoped). Commander decision 2026-05-14, Center Stage 2 step 4 sub-phase 2A → 2B. |

**v1.1.1에서 변경 없음:** FD-1~FD-6 frozen decisions, §2 runtime state ↔ surface mapping rows, §8 prohibition list semantics (1/2/3/4/6/7/8 동일; 5만 scope 정확화), §11 Stage 2 LOCKED order.

---

## 1. Core Principle

BTY UI는 flow UX가 아닌 **interruption UX**다. 핵심 invariant:

- **No Action → No Progression** — progression button은 state gate가 unlock한 경우에만 활성화.
- **Two-layer state authority** — server gate가 client UI state를 override할 수 있으나, 역은 불가.
- **Resolve ≠ feedback screen** — Resolve는 **execution gateway**. 결과 확인이 아니라 행동 진입.
- **Center ≠ menu** — Center는 **system interrupt surface**. navigation이 아닌 forced redirect 대상.

---

## 2. Runtime State ↔ Surface Mapping

**v1.1 변경:** Authority 컬럼을 2개로 분리 (C-A5/C-A9). 대부분 행은 Trigger=Render지만, REEXPOSURE_DUE만 다름 — server gate가 mode를 trigger하고, Play surface(client)가 mode를 render. 이게 FD-4의 정확한 의미.

| # | Runtime State | Trigger Authority | Render Authority | Surface | UI Mode | Lock | Progression CTA |
|---|---|---|---|---|---|---|---|
| 1 | `PRIMARY_CHOICE_ACTIVE` | client (`jsonFlow.state`) | client (Play) | **Play** | choice cards 활성 | unlocked | choice 선택 → Tradeoff |
| 2 | `TRADEOFF_ACTIVE` | client | client (Play) | **Play** | tradeoff panel | unlocked | tradeoff 확정 → Action Decision |
| 3 | `ACTION_DECISION_ACTIVE` | client | client (Play) | **Play** | action decision panel (AD2 포함) | unlocked | decision 제출 → ACTION_REQUIRED 전이 |
| 4 | `ACTION_REQUIRED` | **server gate** | server gate (Resolve) | **Resolve** | execution gateway (QR/contract entry) | **LOCKED** | QR 생성 / contract bind 외 진행 불가 |
| 5 | `ACTION_SUBMITTED` | server gate | server gate (Resolve) | **Resolve** | "executed, awaiting verification" | **LOCKED** | approver 대기, 유저 행동 없음 |
| 6 | `AWAITING_VERIFICATION` | server gate | server gate (Resolve) | **Resolve** | approver scan/eval surface | **LOCKED** | approver 외 유저는 wait |
| 7 | `REEXPOSURE_DUE` | **server gate** | **client (Play re-exposure mode)** | **Play (re-exposure mode)** | scenario re-fires, primary choice 재제시 | unlocked | 새 primary choice |
| 8 | `FORCED_RESET_PENDING` | server gate | server gate (Center) | **Center** | hard interrupt, 다른 surface 접근 차단 | **HARD LOCKED** | compliance task 완료만 unlock |
| 9 | `NEXT_SCENARIO_READY` | server gate | server gate (Lobby/Hub) | **Lobby** or **Hub** | next scenario CTA | unlocked | enter → 새 Play |
| 10 | `ARENA_SCENARIO_READY` | server gate | server gate (Lobby) | **Lobby** | first scenario CTA | unlocked | enter → Play |

**Authority 2-layer 해석 (C-A5/C-A9):**
- **Trigger Authority** = 어느 layer가 이 state로의 진입을 결정하는가
- **Render Authority** = 어느 layer가 이 state의 UI를 그리는가
- 행 7 REEXPOSURE_DUE만 둘이 갈림: server gate가 re-exposure를 trigger → client Play가 re-exposure mode로 render. FD-4 "Play의 re-exposure mode flag"의 정확한 메커니즘.
- 나머지 9개 행은 Trigger=Render (단일 layer).

**Mapping note:** Foundry는 본 lifecycle의 일부가 아니라 **analysis surface** (별도 navigation). FORCED_RESET이 활성일 때 Foundry 접근 차단 여부는 §5.4 참조.

---

## 3. Commander Frozen Decisions (v1 lock)

본 결정값은 v1에서 고정. 변경 시 v2 문서 필요. (v1.1에서 변경 없음.)

| ID | Decision | Lock value |
|---|---|---|
| **FD-1** | ACTION_DECISION_ACTIVE의 home surface | **Play** (Resolve 아님) |
| **FD-2** | ACTION_REQUIRED의 home surface | **Resolve** as execution gateway |
| **FD-3** | ACTION_SUBMITTED / AWAITING_VERIFICATION | **Resolve locked state** (별도 surface 아님) |
| **FD-4** | REEXPOSURE_DUE의 surface | **Play의 re-exposure mode** (overlay 아님, mode flag). server trigger / client render — §2 참조. |
| **FD-5** | FORCED_RESET_PENDING | **Center hard interrupt** (modal 아님, full redirect) |
| **FD-6** | Resolve semantic identity | **Action Gate**, not feedback screen. 이름은 Resolve 유지하되 의미 잠금. |

---

## 4. Lock / Unlock 규칙

### 4.1 Lock 등급

| 등급 | 의미 | 영향 범위 |
|---|---|---|
| **unlocked** | 유저 progression 가능 | 해당 surface 내 CTA 활성 |
| **LOCKED** | 진행 제한, 단 다른 surface 이동 가능 | Resolve 안에서 wait, 다른 화면 진입은 허용 |
| **HARD LOCKED** | 다른 surface 이동도 차단 | Center 외 모든 surface 접근 금지 (FORCED_RESET 한정) |

### 4.2 Lock 시각 언어 (UI spec lock)

| Lock 등급 | 시각 표현 | 압박 수준 |
|---|---|---|
| unlocked | 일반 CTA, hover/focus 정상 | 0 |
| LOCKED | CTA disabled + 상태 메시지 ("Action required to proceed" / "Awaiting verification") | medium |
| HARD LOCKED | 다른 navigation 자체 제거. Center surface가 full-screen에 노출. back button 차단. | high |

**금지:** LOCKED 상태에서 "skip" / "continue anyway" / "next" 류 우회 CTA. progression은 state transition을 통해서만.

### 4.3 Transition trigger

| From | To | Trigger |
|---|---|---|
| PRIMARY_CHOICE_ACTIVE | TRADEOFF_ACTIVE | choice 선택 |
| TRADEOFF_ACTIVE | ACTION_DECISION_ACTIVE | tradeoff 확정 |
| ACTION_DECISION_ACTIVE | ACTION_REQUIRED | decision 제출 (server binding) |
| ACTION_REQUIRED | ACTION_SUBMITTED | QR 활성화 + actor 실행 |
| ACTION_SUBMITTED | AWAITING_VERIFICATION | actor 제출 |
| AWAITING_VERIFICATION | (approve 분기) | approver 평가 |
| (validation) | REEXPOSURE_DUE | no_change / reinforcement 판정 |
| (validation 결과 → le_activation_log/le_verification_log 기록 → computeAIR → evaluateForcedReset) | FORCED_RESET_PENDING (파생 label) | AIR 등 forced reset 평가 조건 충족 시. validation이 직접 전이시키지 않음 — /air route·cron에서 비동기 평가 |
| FORCED_RESET_PENDING | (forced reset 종료) | compliance task 완료 시 current_stage→Stage1, forced_reset_triggered_at=null. NEXT_SCENARIO_READY로의 전이가 아님 (GET 미발행) |
| NEXT_SCENARIO_READY | PRIMARY_CHOICE_ACTIVE | next scenario enter |

> **Note:** 본 표의 라벨은 저장 상태가 아닌 GET 파생 snapshot label이며, 행은 우선순위 게이트 관계를 요약한다 — 선형 state transition이 아니다.

---

## 5. Surface 정체성 정의 (semantic lock)

### 5.1 Lobby
- **역할:** scenario entry point. NEXT_SCENARIO_READY / ARENA_SCENARIO_READY 표시.
- **금지:** in-scenario state (PRIMARY_CHOICE_ACTIVE 등) 렌더링.

### 5.2 Play
- **역할:** in-scenario interaction. PRIMARY_CHOICE → TRADEOFF → ACTION_DECISION 3-state container.
- **추가 mode:** REEXPOSURE_DUE 시 re-exposure mode flag로 동일 surface 재사용. server gate가 trigger, Play가 render (§2 참조).
- **금지:** ACTION_REQUIRED 이후 상태 렌더링 (Resolve 영역).

### 5.3 Resolve — **Action Gate (FD-6)**
- **역할:** ACTION_REQUIRED / SUBMITTED / AWAITING_VERIFICATION 3-state container. **execution gateway**.
- **포함:** QR 생성, contract bind, action submission, approver evaluation, XP 발행.
- **금지:**
  - "결과 요약" / "score reveal" 류 feedback UI 우선 배치
  - choice 재선택 CTA
  - LOCKED 상태에서 skip / bypass CTA
- **포함 가능:** action 완료 후 micro-feedback (LOCKED 해제 시점에 한해).

### 5.4 Foundry
- **역할:** analysis surface (pattern, trend, AIR, leadership engine).
- **lifecycle 외부:** runtime label 집합과 독립. 개별 runtime snapshot label을 직접 render하지 않음. 다만 FORCED_RESET_PENDING 시 접근 차단 (HARD LOCKED 규칙의 secondary block).
- **금지:** in-scenario interaction (Play/Resolve 영역).

### 5.5 Center — **recovery surface (default) + FORCED_RESET override sub-mode**

**v1.1.1 정정:** v1.1 원문은 Center 전체를 "interrupt surface (FD-5)"로 framing했으나, 4개 FINAL LOCKED 문서 + 라이브 제품의 일관된 product loop과 충돌함. v1.1.1은 Center를 default recovery surface + FORCED_RESET override sub-mode 2-mode 구조로 재정의. FD-5 자체는 변경 없음 — sub-mode 활성 시에만 적용됨이 명확화됨.

#### 5.5.1 기본 mode (default — recovery surface)

- **역할:** product loop의 회복 layer. "행동 유도 → 분석 → 회복" 공간 구조의 회복 phase.
- **포함:** Safe Mirror (1-2줄 reflection 입력), Small Wins Tile, Self-esteem Check (0-100 slider), Tiny Recovery Curve, Healing Phase Tracker, Dear Me letters.
- **접근 경로:** 사용자 자발 navigation 허용 (top-nav `/center` entry, HubTopNav, BottomNav). Foundry/Arena와 sibling.
- **톤:** calm, warm, structured, non-judgmental. "safe", "쉼", "회복", "재정비" 어휘 허용.
- **금지 (default mode):** 별도 §8 위반 사항 없음. §5.5.2 sub-mode override가 아닌 한 self-reflection navigation은 정상.
- **근거 (4-doc consensus):**
  - `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` §1.4 (Center block table: One Liner "You are safe here." / Safe Mirror / Small Wins Tile / Self-esteem Indicator / Tiny Recovery Curve) + §1.5 Screens 9-13 (Center Entry / Safe Mirror / Small Wins Capture / Self-esteem Check / Center Mini Recovery) + §1.6 Flow (Center Entry → Safe Mirror / Small Wins → Mini Recovery → Back to Arena) + §3 톤 (Center: Calm, Warm — 정서 안정 — Warm pastels). 본 문서가 default recovery surface 정체성의 1차 근거.
  - `BTY_CURSOR_MASTER_PROMPT.md` Layer table ("Recovery — protection") + Feel ("Recovery — structured reset, not failure") + Recovery section ("calm structured reset, not shame; short prompt: pressure pattern → what must reset → re-entry commitment"). Recovery layer의 tone과 protection 의도를 정의.
  - `BTY_MASTER_BUILD_V1.md` §1 Product Definition ("Recovery — Protection") + §2 Core Loop (Arena → Reflection → Recovery (if needed) → My Page → next Arena cycle) + §6 Screen Roles ("Recovery — Pressure reset, short re-entry fields, return to Growth / Arena"). Recovery를 4 product area 중 protection layer로 명시.
  - `LEADERSHIP_ENGINE_SPEC.md` §5 Reset 강제 조건 (Module 3) — Stage4 forced reset은 deterministic 강제 sub-mode임을 engine layer에서 정의. Stage1~3는 일반 stage로 default recovery layer가 정상 작동. Stage4만 sub-mode가 override.

- **Route lineage note (v1.1.1 추가, per Commander):** 초기 spec (`BTY_CURSOR_MASTER_PROMPT.md`, `BTY_MASTER_BUILD_V1.md`)은 Recovery를 `/[locale]/growth/recovery`에 배치했으나, 라이브 제품이 Recovery + Dear-Me를 `/[locale]/center`로 통합 (`bty-app/src/middleware.ts:133-146`의 `/[locale]/dear-me` → `/[locale]/center` 301 alias). **`/center`가 canonical recovery route.** 위 두 문서의 `/growth/recovery` 참조는 historical — 라이브 제품과의 route 불일치는 spec lineage 흔적이며 v1.1.1에서 사실관계로 기록됨 (별도 v2 정정 대상 아님; 4-doc은 모두 tone/purpose 일관, route만 통합 이전 표기).

#### 5.5.2 FORCED_RESET_PENDING sub-mode (override — system friction, FD-5)

- **활성 조건:** server gate가 Stage4 forced reset을 trigger (per `LEADERSHIP_ENGINE_SPEC.md` §5 — `stage3_selected_count >= 2`, AIR_7d < 0.80 2주 연속, `no_qr_verification_days >= 7`, TSP 추세 2주 연속 음수 중 2개 이상). `user.current_stage = Stage4` AND `forced_reset_triggered_at != null`.
- **역할:** **system friction** — execution gateway가 아닌 system interrupt. default recovery surface는 가려지고 hard-interrupt sub-mode가 활성.
- **FD-5 (full redirect, modal 아님):** server gate 강제 redirect. 자발 navigation 불가. `bty-app/src/middleware.ts` enforcement (Stage 2 step 4 sub-phase 2C 작업 대상).
- **HARD LOCKED (§8-7):** Center 외 surface (Arena / Foundry / 기타) 접근 차단. top-nav sibling Links suppress, browser back 차단.
- **포함 (compliance task surface):**
  - reset 사유 명시 (어떤 pattern_family / 어떤 axis)
  - compliance task 명시 (reset activation weight = 2.0 per `LEADERSHIP_ENGINE_SPEC.md` §4)
  - 48h lockout window (countdown UI)
  - completion verification surface (activation completed + verified per `LEADERSHIP_ENGINE_SPEC.md` §5)
- **금지 (sub-mode):**
  - default recovery surface UI (Safe Mirror / Small Wins / Self-esteem Check / Healing Phase Tracker / Dear Me letters) — sub-mode 중 숨김
  - "괜찮아요" / "쉬어가세요" 류 emotional safe-room 톤 — system friction에 맞지 않음
  - skip / dismiss / "compliance task 회피" 류 CTA (§8-8)
  - 다른 surface navigation (§8-7 — HARD LOCKED)
- **종료 조건:** activation completed + verified → `current_stage = Stage1`, `forced_reset_triggered_at = null` → default recovery surface 복귀.
- **§6 (Center interrupt 조건 상세)는 본 sub-mode에만 적용** (§6 top-level scope clarifier 참조).

### 5.6 Hub
- **역할:** scenario 간 transition surface. NEXT_SCENARIO_READY CTA 노출.
- **Lobby와의 차이:** Lobby는 첫 entry (ARENA_SCENARIO_READY), Hub는 scenario 완료 후 transition (NEXT_SCENARIO_READY). temporal 구분.
- **D1 open:** Lobby와 Hub 통합 여부는 §9-D1 deferred. Stage 2 Lobby 코드화 시 결정.

---

## 6. Center FORCED_RESET sub-mode 상세 (FD-5)

**Scope clarifier (v1.1.1):** §6 전체는 §5.5 의 FORCED_RESET sub-mode 에 적용. Default recovery mode 는 §6 prohibition 대상이 아님 — Safe Mirror / Small Wins / Self-esteem Check / Healing Phase Tracker / Dear Me letters 등 default mode UI는 정상이며 calm·warm tone + 자발 navigation 허용 (§5.5.1 참조).

### 6.1 Trigger 조건

FORCED_RESET sub-mode 활성 (server gate가 Stage4 forced reset trigger)되는 server-side 조건:

- AIR threshold 미달 (<80%, integrity slip flag)
- ACTION_REQUIRED 미실행 48h 경과
- 동일 pattern_family 반복 (no_change 누적)
- (TBD) reinforcement 패턴 cap 초과

(상세 engine 조건은 `LEADERSHIP_ENGINE_SPEC.md` §5 참조 — `stage3_selected_count >= 2`, AIR_7d high 밴드 미만 2주 연속, `no_qr_verification_days >= 7`, TSP 추세 2주 연속 음수 중 2개 이상.)

### 6.2 FORCED_RESET sub-mode 내 UI 금지 사항

- "괜찮아요" / "쉬어가세요" 류 emotional safe room 톤 — sub-mode는 system friction
- skip / dismiss 버튼
- 다른 surface로의 일반 navigation (§8-7 HARD LOCKED bypass와 일치)
- compliance task 회피 경로
- default recovery surface UI (Safe Mirror / Small Wins / Self-esteem / Healing Phase / Dear Me) — sub-mode 중에는 가려져야 함

### 6.3 FORCED_RESET sub-mode 내 UI 필수 사항

- 현재 reset 사유 명시 (어떤 pattern / 어떤 axis)
- compliance task 명시 (reset activation weight = 2.0 per `LEADERSHIP_ENGINE_SPEC.md` §4)
- 완료 검증 surface (activation completed + verified per `LEADERSHIP_ENGINE_SPEC.md` §5)
- (선택) 48h lockout timer (countdown UI)

---

## 7. Re-exposure surface 위치 (FD-4 상세)

### 7.1 구조

REEXPOSURE_DUE는 별도 surface 아닌 **Play surface의 mode flag**:

```
Play surface
├─ mode: "primary"     → PRIMARY_CHOICE_ACTIVE
├─ mode: "tradeoff"    → TRADEOFF_ACTIVE
├─ mode: "action"      → ACTION_DECISION_ACTIVE
└─ mode: "re-exposure" → REEXPOSURE_DUE
```

**Authority (v1.1 명시):** server gate가 REEXPOSURE_DUE를 trigger → Play surface가 re-exposure mode로 render. §2 행 7의 Trigger/Render 분리가 이것.

### 7.2 Re-exposure mode 시 차이

- scenario header에 "다시 한 번" 류 표식 (단, "다시 시도"는 금지 — choice 재선택 frame이 됨)
- 이전 선택 컨텍스트 노출 (어떤 axis / pattern_family에서 변화 측정 중인지)
- 같은 surface 구조 재사용, primary choice cards 재제시
- validation state (`changed` / `unstable` / `no_change`)는 이 turn에서 평가 대상

### 7.3 금지

- re-exposure 전용 별도 surface
- "skip this re-exposure" CTA
- 이전 선택 직접 노출 (스포일러 방지) — 컨텍스트만 추상화해서 표시

---

## 8. Cursor 코드화 전 금지 조건

본 표 lock 이후 코드화 진입 시 다음 위반 자동 reject:

1. **Authority violation:** server gate state를 client가 override하는 코드
2. **Surface invariant violation:** Play에 Resolve state 렌더링, 그 역
3. **Lock bypass:** LOCKED 상태에서 progression CTA 활성화
4. **FD-6 violation:** Resolve를 feedback screen / score reveal로 표현
5. **FD-5 violation (sub-mode scope, v1.1.1 정정):** FORCED_RESET sub-mode 활성 시 Center를 일반 menu / dashboard / safe-room 톤으로 표현 — sub-mode는 system friction. (Default recovery mode 에는 §5.5.1 에 따라 menu/dashboard pattern + calm·warm 톤이 허용됨 — 이는 v1.1.1 violation 아님.)
6. **FD-4 violation:** REEXPOSURE_DUE를 별도 surface로 분리 (server trigger / client Play render 모델 위반 포함)
7. **HARD LOCKED bypass:** FORCED_RESET_PENDING 시 Center 외 surface 접근 가능
8. **Skip CTA:** "skip" / "continue anyway" / "next" 류 LOCKED 우회 CTA 도입

---

## 9. 미해결 항목 (deferred to v2)

본 문서에서 잠그지 않은 항목 — 코드화 중 결정 가능, 단 결정 시 v2 업데이트:

| # | Deferred item | 결정 시점 |
|---|---|---|
| D1 | Lobby ↔ Hub 통합 여부 | **Stage 2 Lobby surface 코드화 시** (C-A3 통일 기준) |
| D2 | Foundry FORCED_RESET 접근 차단 UI 표현 | Center 코드화 시 |
| D3 | Resolve 내 micro-feedback 허용 범위 (XP 표시 등) | Resolve 코드화 시 |
| D4 | Re-exposure mode header 정확한 문구 | Play 코드화 시 |
| D5 | 48h lockout timer UI 표현 | Center 코드화 시 |
| D6 | Approver scan flow의 Resolve 내 위치 | Resolve 코드화 시 |

---

## 10. Stage 1 진입 조건

본 문서 lock 후 Stage 1 (Figma Frame ID 매핑) 진입 시:

- 6개 Claude design surface (Lobby / Play / Resolve / Foundry / Center / Hub-candidate)는 design-tool 산출물 — 코드 파일 아님. Stage 1 = standalone 매핑 문서.
- 매핑 문서는 §2 매핑을 frame별로 명시 (table + per-surface detail).
- ios-frame.jsx 등 공통 wrapper는 codebase에 아직 없음 — Stage 2 구현 제약으로 기록.
- **Hub 정체(D1)는 Stage 1에서 결정하지 않음** — flag만 표기. 결정은 Stage 2 Lobby 코드화 시 (C-A3).

## 11. Stage 2 진입 조건

- Stage 1 frame mapping 완료
- Cursor dispatch 시 본 표 §8 금지 조건 8개를 lint rule로 명시
- **코드화 순서 — LOCKED (C-A4, Commander 확정):**
  **Lobby → Resolve → Play → Center → Foundry → Hub**
  근거: Lobby가 entry reference point를 고정, Resolve가 lock-invariant 위반 위험이 가장 높아 조기 검증.
  (이전 참조: `BTY_ARENA_FIGMA_CODE_MAPPING.md §13`의 순서는 본 LOCKED 순서로 대체됨.)

---

## 12. Memory 반영 요청 사항

본 문서 closure 시 Anthropic conversational memory 갱신 권장 (이미 memory #19 반영됨 — v1.1 정정 사항 추가 권장):

```
[semantic_locking_v1] v1.1 정정 2026-05-13: §2 Authority 2-layer 분리
(Trigger/Render), D1 timing을 Stage 2 Lobby 코드화로 통일, Stage 2 순서
LOCKED 확정, self-location outer 경로로 수정. FD-1~6 변경 없음.

[semantic_locking_v1] v1.1.1 정정 2026-05-14: §5.5/§8-5 scope 정확화 —
Center = recovery surface (default, §5.5.1) + FORCED_RESET override sub-mode
(§5.5.2). §6 prohibitions/requirements는 sub-mode scope로 한정 (§6.2/§6.3
header reframe + §6 top-level scope clarifier). §2 row 8 / §3 FD-5 / §8-7
변경 없음. 4-doc consensus (VISUAL_BEHAVIOR_SPEC §1.4-§1.5 Screens 9-13,
CURSOR_MASTER_PROMPT Recovery layer, MASTER_BUILD_V1 §6, LEADERSHIP_ENGINE_SPEC
§5) + 라이브 제품(/center route)과의 reconciliation. /dear-me → /center
301 alias로 인한 route lineage 명시 (`bty-app/src/middleware.ts:133-146`).
FD-1~6 변경 없음.
```

---

**문서 위치:** `docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md` (outer repo)
**이전 버전:** `docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.md` (outer commit 6fc83bf) — v1.1로 supersede
**참조:** `BTY_ARENA_FIGMA_CODE_MAPPING.md`, `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`, `BTY_Arena_-_QR_Action_System_Product_Spec_v1`
**다음 단계:** Stage 1 — Figma Frame ID Mapping (매핑 문서 authoring)
**작성자:** Commander (Hanbit) + C1 (Anthropic conversational memory)
**Status:** v1.1.1 frozen (Center §5.5/§8-5/§6 scope 정확화, 2026-05-14, Stage 2 step 4 sub-phase 2B).
