# BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1

> **Superseded:** 본 문서는 BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md (v1.1.1 정정 corpus)로 supersede됨. 현행 권위는 v1.1.

**Status:** Stage 0 산출물. Cursor 코드화 진입 전 semantic gate.
**Authority precedence:** Server `ArenaRuntimeStateId` > Client `jsonFlow.state` > UI surface.
**Frozen decisions:** Commander 결정값 6개 (본 문서 §3). 변경 시 v2 필요.
**Source files:** `arenaRuntimeSnapshot.types.ts:9` (server gate), `data/scenario/index.ts:500` (client UI state).

---

## 1. Core Principle

BTY UI는 flow UX가 아닌 **interruption UX**다. 핵심 invariant:

- **No Action → No Progression** — progression button은 state gate가 unlock한 경우에만 활성화.
- **Two-layer state authority** — server gate가 client UI state를 override할 수 있으나, 역은 불가.
- **Resolve ≠ feedback screen** — Resolve는 **execution gateway**. 결과 확인이 아니라 행동 진입.
- **Center ≠ menu** — Center는 **system interrupt surface**. navigation이 아닌 forced redirect 대상.

---

## 2. Runtime State ↔ Surface Mapping

| # | Runtime State | Authority | Surface | UI Mode | Lock | Progression CTA |
|---|---|---|---|---|---|---|
| 1 | `PRIMARY_CHOICE_ACTIVE` | client (`jsonFlow.state`) | **Play** | choice cards 활성 | unlocked | choice 선택 → Tradeoff |
| 2 | `TRADEOFF_ACTIVE` | client | **Play** | tradeoff panel | unlocked | tradeoff 확정 → Action Decision |
| 3 | `ACTION_DECISION_ACTIVE` | client | **Play** | action decision panel (AD2 포함) | unlocked | decision 제출 → ACTION_REQUIRED 전이 |
| 4 | `ACTION_REQUIRED` | **server gate** | **Resolve** | execution gateway (QR/contract entry) | **LOCKED** | QR 생성 / contract bind 외 진행 불가 |
| 5 | `ACTION_SUBMITTED` | server gate | **Resolve** | "executed, awaiting verification" | **LOCKED** | approver 대기, 유저 행동 없음 |
| 6 | `AWAITING_VERIFICATION` | server gate | **Resolve** | approver scan/eval surface | **LOCKED** | approver 외 유저는 wait |
| 7 | `REEXPOSURE_DUE` | server gate | **Play (re-exposure mode)** | scenario re-fires, primary choice 재제시 | unlocked | 새 primary choice |
| 8 | `FORCED_RESET_PENDING` | server gate | **Center** | hard interrupt, 다른 surface 접근 차단 | **HARD LOCKED** | compliance task 완료만 unlock |
| 9 | `NEXT_SCENARIO_READY` | server gate | **Lobby** or **Hub** | next scenario CTA | unlocked | enter → 새 Play |
| 10 | `ARENA_SCENARIO_READY` | server gate | **Lobby** | first scenario CTA | unlocked | enter → Play |

**Mapping note:** Foundry는 본 lifecycle의 일부가 아니라 **analysis surface** (별도 navigation). FORCED_RESET이 활성일 때 Foundry 접근 차단 여부는 §5.3 참조.

---

## 3. Commander Frozen Decisions (v1 lock)

본 결정값은 v1에서 고정. 변경 시 v2 문서 필요.

| ID | Decision | Lock value |
|---|---|---|
| **FD-1** | ACTION_DECISION_ACTIVE의 home surface | **Play** (Resolve 아님) |
| **FD-2** | ACTION_REQUIRED의 home surface | **Resolve** as execution gateway |
| **FD-3** | ACTION_SUBMITTED / AWAITING_VERIFICATION | **Resolve locked state** (별도 surface 아님) |
| **FD-4** | REEXPOSURE_DUE의 surface | **Play의 re-exposure mode** (overlay 아님, mode flag) |
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
| (validation) | FORCED_RESET_PENDING | integrity slip threshold 초과 |
| FORCED_RESET_PENDING | NEXT_SCENARIO_READY | compliance task 완료 |
| NEXT_SCENARIO_READY | PRIMARY_CHOICE_ACTIVE | next scenario enter |

---

## 5. Surface 정체성 정의 (semantic lock)

### 5.1 Lobby
- **역할:** scenario entry point. NEXT_SCENARIO_READY / ARENA_SCENARIO_READY 표시.
- **금지:** in-scenario state (PRIMARY_CHOICE_ACTIVE 등) 렌더링.

### 5.2 Play
- **역할:** in-scenario interaction. PRIMARY_CHOICE → TRADEOFF → ACTION_DECISION 3-state container.
- **추가 mode:** REEXPOSURE_DUE 시 re-exposure mode flag로 동일 surface 재사용.
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
- **lifecycle 외부:** runtime state machine과 독립. 다만 FORCED_RESET_PENDING 시 접근 차단 (HARD LOCKED 규칙).
- **금지:** in-scenario interaction (Play/Resolve 영역).

### 5.5 Center — **interrupt surface (FD-5)**
- **역할:** FORCED_RESET_PENDING 시 full redirect. compliance task surface.
- **접근 경로:** server gate 강제 (유저 자발 navigation 아님).
- **포함:** reset weight task (2x), 48h lockout window, compliance verification.
- **금지:** Center를 일반 menu / recovery dashboard로 표현. **"safe room"이 아닌 "system friction"**.

### 5.6 Hub
- **역할:** scenario 간 transition surface. NEXT_SCENARIO_READY CTA 노출.
- **Lobby와의 차이:** Lobby는 첫 entry, Hub는 scenario 완료 후 transition. 통합 검토 가능 (별도 결정).

---

## 6. Center interrupt 조건 (FD-5 상세)

### 6.1 Trigger 조건

Center로 forced redirect되는 server-side trigger:

- AIR threshold 미달 (<80%, integrity slip flag)
- ACTION_REQUIRED 미실행 48h 경과
- 동일 pattern_family 반복 (no_change 누적)
- (TBD) reinforcement 패턴 cap 초과

### 6.2 Center 내 UI 금지 사항

- "괜찮아요" / "쉬어가세요" 류 emotional safe room 톤
- skip / dismiss 버튼
- 다른 surface로의 일반 navigation
- compliance task 회피 경로

### 6.3 Center 내 UI 필수 사항

- 현재 reset 사유 명시 (어떤 pattern / 어떤 axis)
- compliance task 명시 (2x weight)
- 완료 검증 surface
- (선택) 48h lockout timer

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

본 표 v1 lock 이후 코드화 진입 시 다음 위반 자동 reject:

1. **Authority violation:** server gate state를 client가 override하는 코드
2. **Surface invariant violation:** Play에 Resolve state 렌더링, 그 역
3. **Lock bypass:** LOCKED 상태에서 progression CTA 활성화
4. **FD-6 violation:** Resolve를 feedback screen / score reveal로 표현
5. **FD-5 violation:** Center를 일반 menu / dashboard로 표현
6. **FD-4 violation:** REEXPOSURE_DUE를 별도 surface로 분리
7. **HARD LOCKED bypass:** FORCED_RESET_PENDING 시 Center 외 surface 접근 가능
8. **Skip CTA:** "skip" / "continue anyway" / "next" 류 LOCKED 우회 CTA 도입

---

## 9. v1 미해결 항목 (deferred to v2)

본 v1에서 잠그지 않은 항목 — 코드화 중 결정 가능, 단 결정 시 v2 업데이트:

| # | Deferred item | 결정 시점 |
|---|---|---|
| D1 | Lobby ↔ Hub 통합 여부 | Lobby surface 코드화 시 |
| D2 | Foundry FORCED_RESET 접근 차단 UI 표현 | Center 코드화 시 |
| D3 | Resolve 내 micro-feedback 허용 범위 (XP 표시 등) | Resolve 코드화 시 |
| D4 | Re-exposure mode header 정확한 문구 | Play 코드화 시 |
| D5 | 48h lockout timer UI 표현 | Center 코드화 시 |
| D6 | Approver scan flow의 Resolve 내 위치 | Resolve 코드화 시 |

---

## 10. Stage 1 진입 조건

본 v1 lock 후 Stage 1 (Figma Frame ID 매핑) 진입 시:

- 각 Figma frame (Lobby / Play / Resolve / Foundry / Center / Hub) 상단에 본 표 §2 매핑을 주석으로 명시
- ios-frame.jsx 같은 공통 컴포넌트는 어느 surface state에서 사용되는지 명시
- Hub surface가 Lobby와 통합되는지 별도 유지되는지 D1 결정

## 11. Stage 2 진입 조건

- Stage 1 frame mapping 완료
- Cursor dispatch 시 본 표 §8 금지 조건 8개를 lint rule로 명시
- 코드화 순서: BTY_ARENA_FIGMA_CODE_MAPPING.md §13 (Lobby → Play+Resolve → Foundry → Center → Chat → Error/A11y)
- 단, §13 순서 수정 가능: **Lobby → Resolve (execution gateway, 가장 위험) → Play → Center → Foundry → Hub** 권장 — Resolve가 lock invariant 위반 위험이 가장 높으므로 일찍 검증.

---

## 12. Memory 반영 요청 사항

본 v1 closure 시 Anthropic conversational memory에 추가 권장:

```
[semantic_locking_v1] BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1 frozen 2026-05-13.
6 Commander decisions locked (FD-1~FD-6). Resolve = Action Gate (not feedback).
Center = system interrupt (not safe room). REEXPOSURE_DUE = Play mode flag.
10 runtime states mapped to 6 surfaces with 3 lock grades.
8 prohibitions for Stage 2 code dispatch.
6 deferred items (D1-D6) for v2.
Source: arenaRuntimeSnapshot.types.ts:9 + data/scenario/index.ts:500.
```

---

**문서 위치:** `bty-app/docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.md` (권장 outer repo 이관 경로)
**참조:** `BTY_ARENA_FIGMA_CODE_MAPPING.md`, `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`, `BTY_Arena_-_QR_Action_System_Product_Spec_v1`
**다음 단계:** Stage 1 — Figma Frame ID Mapping
**작성자:** Commander (Hanbit) + C1 (Anthropic conversational memory)
**Status:** v1 frozen, awaiting Stage 1 dispatch
