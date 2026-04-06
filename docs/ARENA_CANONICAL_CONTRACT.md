# Arena canonical contract (baseline)

**Purpose:** 고정 **계정 불변 baseline**과 허용 차이의 경계를 문서화한다. 구현 세부는 `bty-app` 코드 및 `SCENARIO_ROTATION_CONTRACT.md`가 정본이며, 본 문서는 **C2/C3 명세 반영**용이다. **코드 변경을 의미하지 않는다.**

**Related:** `docs/SCENARIO_ROTATION_CONTRACT.md` — catalog / mirror / perspective-switch **mod-3** 및 mirror 슬롯 조건.

---

## 1. Account-Invariant Baseline

- **동일 문서화 프로필** + **동일 서버 상태**(동일 DB 스냅샷: 프로필, 이젝션, 멤버십, 플레이 이력 길이·내용) → **동일 Arena baseline** (동일 `session/next` 라우트 결과 전제: 동일 입력·동일 환경).
- **단일 엔진 계약 (server-backed):** 시나리오 라우팅·회전·카탈로그 필터 규칙은 **서버**(예: `getNextScenarioForSession`, `selectNextScenario`)에서만 결정한다.
- **UI는 표시만:** XP/리그/시즌/회전 규칙을 UI에서 재계산하거나 **계정별 임시 분기(ad-hoc per-account)** 하지 않는다. API·엔진이 준 값을 렌더만 한다.

---

## 2. 허용 차이 (5종)

| 구분 | 허용 조건 | 금지 |
|------|-----------|------|
| **입문 경로** | `requiresBeginnerPath` (**GET `/api/arena/core-xp`** 등 문서화된 API) 기준만 | UI에서 XP 숫자만 보고 임의 분기 |
| **Center 이젝션** | 문서화된 **403**·메시지·코드 (`user_ejected_from_arena` 등) | 동일 서버 규칙인데 **계정마다 다른 라우트**로 우회 |
| **Arena 멤버십** | 미승인 → 문서화된 제한(접근·기능) | 문서 없는 **숨은 풀/시나리오** |
| **로케일** | KO/EN **표현·카탈로그 로케일 메타** 차이만 | 동일 프로필인데 **계정별로 다른 풀 규칙** |
| **누적 플레이 / DB** | 데이터가 다르면 결과가 달라지는 것은 **파생 결과** | 동일 DB·동일 규칙인데 **계정별로 다른 엔진 규칙** |

---

## 3. 참조 계정

- **참조 이메일:** `ikendo1@gmail.com`
- **문서화 프로필(기준):** 입문 완료 · 비이젝트 · 멤버십 허용 · **KO 로케일**
- **Baseline 규칙:** 다른 계정이 위와 **동일 프로필**(동일 입문/이젝션/멤버십/로케일 전제)이면 **동일 Arena baseline**을 기대한다. (플레이 이력이 다르면 시나리오 ID·mirror 풀 내용 등은 달라질 수 있음 — §2「누적 플레이」참조.)

---

## 4. Mirror 불변 조건

- **슬롯:** `rotationCount % 3 === 1` **且** mirror 풀 길이 ≥ 1 (`getMirrorScenarios`). 구현·표: `SCENARIO_ROTATION_CONTRACT.md` §1–§2.
- **회전 카운트 (`fetchArenaRotationPlayCount`):**
  1. **`user_scenario_history.played_scenario_ids`** 가 비어 있지 않으면 → 그 배열의 유효 문자열 개수.
  2. **비어 있거나 행 없음** → **`user_scenario_choice_history`** 에 대한 **건수(count)** 보조( `fetchPlayedScenarioIds` 백필과 정렬된 동작 — 집계만 늦은 계정이 catalog 슬롯에 고정되지 않도록 함).
- **계정 간 불변:** 동일 `rotationCount` · 동일 mirror 풀 결과 · 동일 `admin` 가용 → 동일 mirror **발생 여부**(슬롯·풀 조건 동일).
- **금지:** UI/클라이언트가 mirror를 임의로 켜거나 `session/next`를 건너뛰는 **비문서화 활성화**.

---

## 5. 금지 패턴

- 이메일 **하드코딩**·**비문서화** 분기
- 계정별 다른 CTA 라벨·**라우팅** (동일 제품 규칙 위반)
- 계정별 다른 **시나리오 풀 규칙** (엔진은 userId 기반 DB 상태만 참조; **동일 상태면 동일 규칙**)
- UI에서 XP/내부 플래그로 **임의 분기** (표시 외 결정 금지)

---

## 6. Action Contract Invariant

- Every **`RUN_COMPLETED_APPLIED`** row in **`arena_events`** for a run **must** have a matching row in **`public.bty_action_contracts`** for the same **`user_id`** and **`session_id` = `arena_runs.run_id`** (logical key **`arena:run:<runId>`**; stored as **`session_id`**, not a separate `action_id` column).
- **Invalid state:** `RUN_COMPLETED_APPLIED` exists **and** no **`bty_action_contracts`** row for that **`(user_id, session_id)`** → **must be recovered** (operator or client retry).
- **Recovery:** **`POST /api/admin/recover-contract`** with **`{ userId, runId, scenarioId }`** (admin-only). Example: `userId` `38ce28d2-79e4-4de5-b554-c10404714d9f`, `runId` `908cfb24-4280-4cce-aa87-4e5ce844b1f3`, `scenarioId` `pswitch_ps_peer_1`.
- **Idempotent path guarantee:** **`POST /api/arena/run/complete`** always invokes **`ensureActionContractForArenaRun`** when the run is already applied (`idempotent: true`), so a missing contract row is **repaired** on retry when **`SUPABASE_SERVICE_ROLE_KEY`** is configured.

---

## 7. Release Criteria

1. 본 계약과 **`docs/SCENARIO_ROTATION_CONTRACT.md`** 가 **충돌 없음** (회전·mirror 정의 일치).
2. **ikendo1** 기준 프로필은 본 문서 §3에 **고정** (회귀·스모크 기준).
3. 동일 프로필 **시드**로 회귀 테스트 반영(가능 시).
4. 이메일/내부 플래그 **비문서화 분기 없음** (코드 리뷰·감사 항목).
5. §6 Action Contract invariant: **`run/complete`** 멱등 경로가 **`ensureActionContractForArenaRun`** 를 호출함 (부분 실패 복구).

---

## 8. Cross-Account 검증 상태

| 항목 | 상태 |
|------|------|
| **Vitest (repo)** | 2877 PASS (보고 시점 기준; CI는 `npm test` / 파이프라인 확인) |
| **런타임 다계정 동일 프로필 비교** | **NOT PROVEN** — 스테이징·시드 계정에서 수동 확인 필요 |
| **담당** | C3/C4 수동 스모크 (시드 계정 접근 가능 시) |

---

*본 문서는 제품/코드 계약을 단독으로 변경하지 않는다. 구현과 불일치 시 **코드 또는 본 문서** 중 하나를 의도에 맞게 갱신한다.*
