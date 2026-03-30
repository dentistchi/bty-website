# Scenario type rotation contract (Arena)

**Purpose:** Single source of truth for **how** `getNextScenarioForSession` chooses among catalog, mirror, and perspective-switch routes. **Derived only from code** (`bty-app/src/engine/integration/scenario-type-router.ts` as of documentation). **No behavior change** is implied by this file.

**Canonical implementation:** `getNextScenarioForSession` — lines cited below refer to that file.

---

## 0. 선행 분기 (rotation 이전)

아래 중 하나라도 해당하면 **mod-3 rotation은 적용되지 않는다** (rotation 슬롯 표는 §1 참조 전제가 아님).

| 조건 | 코드 위치 | 결과 `route` |
|------|-----------|----------------|
| `options?.foundry_return === true` | L94–L106 | 항상 `catalog` (`selectNextScenario`) |
| `getSupabaseAdmin()` 가 **falsy** (`!admin`) | L108–L116 | 항상 `catalog` (`selectNextScenario`) — mirror / perspective_switch 분기 **미진입** |

**코드 확인 결과:** `fetchArenaRotationPlayCount`·`fetchPlayedScenarioIds`·`sessionSlot`·`getMirrorScenarios`는 **`admin`이 있을 때만** (L118 이후) 실행된다. 로컬 등 **admin 없는 환경**에서는 rotation과 무관하게 **항상 catalog**만 반환된다.

---

## 1. rotation 슬롯 정의 (admin 있음 · foundry 없음)

전제: `admin` 존재, `foundry_return` 아님.

**인덱스:** `sessionSlot = rotationCount % ARENA_SESSION_ROTATION_MOD` — `rotationCount = await fetchArenaRotationPlayCount(userId)` (`scenario-selector.service.ts`).

**`rotationCount` 정의 (우선순위):**

1. `user_scenario_history.played_scenario_ids`가 **비어 있지 않으면** → 유효 문자열 id 개수(배열 길이와 동일).
2. **행 없음 또는 배열 비어 있음** → **`user_scenario_choice_history`** 에 대해 `select(..., { count: "exact", head: true })` 로 구한 **건수**를 보조 사용 — `fetchPlayedScenarioIds`가 집계 없을 때 choice 이력을 쓰는 것과 **정렬**되어, 집계만 늦은 계정이 **슬롯 0(catalog)에 고정**되지 않도록 한다.

`ARENA_SESSION_ROTATION_MOD = 3` — `scenario-type-router.ts`.

**`played` (mirror LRU 등):** `await fetchPlayedScenarioIds(userId)` — catalog 선택 제외·미러 최근성 등에 그대로 사용. 정의는 `fetchPlayedScenarioIds` — DB `user_scenario_history.played_scenario_ids` 또는 백필 `user_scenario_choice_history`.

| `rotationCount % 3` | 의도된 슬롯 | 실제 `route` 및 조건 (코드) |
|---------------------|-------------|-----------------------------|
| 0 | catalog | `sessionSlot === 0` → `catalogFallback()` → **`route: "catalog"`** (L129–L135). 항상. |
| 1 | mirror 우선 | `sessionSlot === 1` 이고 **`mirror` 풀 길이 ≥ 1** (`poolLen >= 1`) → **`route: "mirror"`** (L138–L147). **풀이 비면** `catalogFallback()` → **`route: "catalog"`** (L149–L154). |
| 2 | perspective_switch | `sessionSlot === 2` → `getNextPerspectiveSwitch` + `perspectiveSwitchToScenario` → **`route: "perspective_switch"`** (L157–L164). **이 파일에서는 `sessionSlot === 2`일 때 catalog 폴백 없음** (항상 perspective 경로 호출). |

**주석 불일치:** L157 주석 `// sessionSlot === 2 — perspective third, then mirror, then catalog` 는 **이 함수 본문**에서 mirror→catalog 폴백을 수행하지 않음. mirror 폴백은 **슬롯 1**에서만 (`poolLen < 1`일 때 catalog). §2·§5 참고.

---

## 2. 트리거 조건 (정확)

### mirror 발생 (코드)

다음을 **모두** 만족할 때만 `route: "mirror"` (L138–L147):

1. `getSupabaseAdmin()` 가 truthy (rotation 분기 진입, L118 이후).
2. `foundry_return` 아님 (L94–L106 미통과).
3. `rotationCount % 3 === 1` (`fetchArenaRotationPlayCount`, L122 근처).
4. `poolLen >= 1` — `mirrors = await getMirrorScenarios(userId, admin)` (L124–L125).

### mirror 미발생 (코드)

- `!admin` → **항상 catalog** (L108–L116) — mirror 분기 미도달.
- `foundry_return` → catalog (L94–L106).
- `rotationCount % 3 !== 1` → mirror 분기 아님.
- `rotationCount % 3 === 1` 이지만 `poolLen < 1` → **catalog** (L149–L154).

### perspective_switch 발생 (코드)

- `admin` 있음, `foundry_return` 아님, `rotationCount % 3 === 2` → L157–L164 호출, **`route: "perspective_switch"`**.

`getNextPerspectiveSwitch` 내부에서 DB/풀 예외 처리는 `perspective-switch.service.ts` — 이 계약서 범위 밖에서 throw 시 **API 500 등** 가능. **상세 에러 계약은 코드 확인 필요.**

---

## 3. admin 의존성

| 기능 | 코드 기준 |
|------|-----------|
| **전체 rotation (mod-3)** | `admin` 없으면 L108–L116에서 **종료** — catalog만. mirror·perspective_switch **불가**. |
| **mirror** | rotation 분기 안에서만 존재 → **실질적으로 `admin` 필요** (L118 이후). |
| **perspective_switch** | `getNextPerspectiveSwitch(userId, admin)` (L158) — `admin` 전달. rotation 분기 밖에서는 호출되지 않음 → **admin 필요**. |

**이전 문서에서 “mirror는 admin 무관”으로 적을 경우:** 현재 `scenario-type-router`는 **`!admin`이면 mirror 경로 자체가 실행되지 않는다.** 진실은 **코드**이며, 본 문서가 정본이다.

---

## 4. 세션 상태 · rotation vs 선택 이력

- **`rotationCount`:** 집계(`played_scenario_ids`)가 있으면 그 길이; **없으면** `user_scenario_choice_history` **행 수** 보조 (`fetchArenaRotationPlayCount`).
- **`fetchPlayedScenarioIds`:** 집계 우선, 없으면 choice_history에서 시나리오 id 목록 백필 — catalog·mirror LRU 등에 사용.
- **정렬:** 집계가 비어 있을 때 rotation과 played 목록이 **서로 다른 소스만** 보는 상황을 줄이기 위해 rotation에도 choice_history **count** 보조가 들어감 (`docs/ARENA_CANONICAL_CONTRACT.md` §4 참조).
- **브라우저 세션·탭 재시작**은 DB 길이를 바꾸지 않음 (인메모리 카운터 아님).

---

## 5. 기존 문서 불일치 항목

- **“n=2 → catalog” 같은 슬롯 표**가 본 코드와 다르면 **코드가 우선**이다. 본 문서 §1 표가 **정본**.
- **L157 주석** `perspective third, then mirror, then catalog` 는 **같은 함수 내**의 실제 제어 흐름과 **mirror→catalog 폴백**을 설명하지 않음(슬롯 2는 perspective만 호출). 주석은 **문서/주석 불일치**로 남을 수 있음 — **동작은 코드**.

---

## 6. 파일럿 운영 주의사항

- **Supabase `admin` 미설정** (`getSupabaseAdmin()` null): **rotation 미적용** — 항상 catalog. mirror·perspective_switch **관측 불가**.
- **mirror 관측:** `admin` + `rotationCount % 3 === 1` + mirror 풀 ≥ 1 필요. 집계가 비어 있어도 **choice 이력이 있으면** `rotationCount`가 0이 아닐 수 있음 → 슬롯이 catalog에만 고정되지 않음.
- **집계 반영 후** `user_scenario_history.played_scenario_ids`가 쌓이면 rotationCount는 **집계 길이**가 우선된다.
- **첫 시나리오 완료 후** `appendPlayedScenarioId` 등으로 집계가 쌓이면 `rotationCount`가 증가 → 다음 `session/next`에서 슬롯 전환 → mirror 가능(슬롯·풀 조건 충족 시).
- **foundry_return** 경로는 rotation **무시** — catalog만.

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| `docs/ARENA_CANONICAL_CONTRACT.md` | 계정 불변 baseline · 허용 차이 · mirror 불변(요약) |
| `bty-app/src/engine/integration/scenario-type-router.ts` | rotation·`route` 결정 |
| `bty-app/src/engine/scenario/scenario-selector.service.ts` | `fetchArenaRotationPlayCount`, `fetchPlayedScenarioIds`, `selectNextScenario` (catalog) |
| `bty-app/src/engine/perspective-switch/mirror-scenario.service.ts` | mirror 풀 |
| `bty-app/src/engine/scenario/perspective-switch.service.ts` | perspective 풀·`getNextPerspectiveSwitch` |
| `bty-app/src/app/api/arena/session/next/route.ts` | `getNextScenarioForSession` 호출 |

---

*This document is descriptive only; it does not change product or code contracts.*
