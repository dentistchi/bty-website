# BTY SPRINT PLAN

멀티 Cursor 스프린트의 **단일 진실(single source of truth)** 문서.

---

## 다른 Cursor가 할 일을 어디서 보나 (필독)

| 우선 | 문서 | 보는 법 |
|------|------|---------|
| **1** | **`docs/CURSOR_TASK_BOARD.md`** | **"이번 런"** = **SPRINT 64** — First **C5 Gate 64** · 전 행 `[ ]`. |
| **2** | **본 파일 `SPRINT 270`** | 보드 **64**과 동기. |
| **작업 없다고 할 때** | 보드 **전부 [x]**면 | **SPRINT 65** + 본 문서 271. |

*이전에는 251만 닫고 252에 빈 칸을 안 넣어서, SPRINT_PLAN만 보던 Cursor는 "큐 없음"으로 보였음.*

---

## 범위

- 기능 백로그(Q3·Q4). **배포·Gate는 배포 시 1회.**
- 참조: `MVP_DEPLOYMENT_READINESS` + `bty-release-gate.mdc` A~F + `BTY_RELEASE_GATE_CHECK.md`.

---

## SPRINT 270 — **active (보드 SPRINT 64)**

- **First Task = C5 Gate 64.** S63 **C5 [x]** · C1·C4·C3·C6 → **S64**.

| 워커 | S64 |
|------|-----|
| **C5** | **1·6** `[ ]` |
| **C1** | **2·3·5·7** `[ ]` |
| **C4** | **4** `[ ]` |
| **C3** | **8·9** `[ ]` |
| **C6** | **10** `[x]` |

### C5 — UI ENGINEER (270)

- [ ] **TASK 1** [VERIFY] Release Gate A~F Foundry **64차**.
- [ ] **TASK 6** [VERIFY] 엘리트 3차 체크리스트 · §3.

### C3 — DOMAIN ENGINEER (270)

- [ ] **TASK 8** — Arena domain (S63 잔여).
- [ ] **TASK 9** — Arena API route (S63 잔여).

### C6 — TESTFIX ENGINEER (270)

- [x] **TASK 10** — q237-smoke **7/7** · **284 / 2131** · Build ✓ · `SPRINT_LOG`.

---

## SPRINT 269 — closed (보드 SPRINT 63)

- **284 / 2131** · Gate **63** ✓ · C5 **1·6 [x]** · C1·C4·C3·C6 → **64**.

| 워커 | (63) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C1** | → **64** |
| **C4** | → **64** |
| **C3** | → **64** |
| **C6** | **10** `[x]` *(S64 실행)* |

### C5 — UI ENGINEER (269) — closed

- [x] **TASK 1** Gate **63차** — **284 / 2131** ✓ · `arenaRunState.edges.test.ts` tsc.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C6 — TESTFIX ENGINEER (269) — closed

- [x] **TASK 10** — S64에서 실행 · q237 **7/7** · **284 / 2131** · Build ✓.

### C1·C4·C3 — S63 잔여 → S64

- TASK **2·3·4·5·7·8·9** 동일 행.

---

## SPRINT 268 — closed (보드 SPRINT 62)

- **284 / 2131** · **C3** 8·9 **[x]** · C5·C1·C4·C6 → **63**.

| 워커 | (62) |
|------|------|
| **C3** | **8·9** **[x]** |
| **C5** | → **63** |
| **C1** | → **63** |
| **C4** | → **63** |
| **C6** | **10** `[x]` *(S63 실행)* |

### C3 — DOMAIN ENGINEER (268) — closed

- [x] **TASK 8** `arenaRunState.edges.test.ts`.
- [x] **TASK 9** `POST /api/arena/lab/complete` **401**·**400**.

### C6 — TESTFIX ENGINEER (268) — closed

- [x] **TASK 10** — S63에서 실행 · q237 **7/7** · **284 / 2131** · Build ✓.

---

## SPRINT 267 — closed (보드 SPRINT 61)

- **282 / 2125** · Gate 61 ✓ · C5 **1·6 [x]** · C1·C4·C3·C6 → **62**.

| 워커 | (61) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | → **62** |
| **C4** | → **62** |
| **C3** | → **62** |
| **C6** | → **62** |

### C5 — UI ENGINEER (267) — closed

- [x] **TASK 1** Gate **61차** — **282 / 2125** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C1·C4·C3·C6 — S61 잔여 → S62

- TASK **2·3·4·5·7·8·9·10** 동일 행.

---

## SPRINT 266 — closed (보드 SPRINT 60)

- **280 / 2119** · Gate 60 ✓ · C5·C6 **[x]** · C1·C4·C3 **8·9** → **S61**.

| 워커 | (60) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **61** |
| **C4** | → **61** |
| **C3** | **8·9** → **61** |

### C5 — UI ENGINEER (266) — closed

- [x] **TASK 1** Gate **60차** — **280 / 2119** · q237 **7/7** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C6 — TESTFIX ENGINEER (266) — closed

- [x] **TASK 10** q237-smoke **7/7** · **280/2119** ✓.

### C1·C4·C3 — S60 잔여 → S61

- TASK **2·3·4·5·7·8·9** 동일 행.

---

## SPRINT 265 — closed (보드 SPRINT 59)

- **280 / 2119** · Gate 59 ✓ · C5 **1·6 [x]** · C1·C4·C3·C6 → **60**.

| 워커 | (59) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | → **60** |
| **C4** | → **60** |
| **C3** | → **60** |
| **C6** | → **60** |

### C5 — UI ENGINEER (265) — closed

- [x] **TASK 1** Gate **59차** — **280 / 2119** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C1·C4·C3·C6 — S59 잔여 → S60

- TASK **2·3·4·5·7·8·9·10** 동일 행.

---

## SPRINT 264 — closed (보드 SPRINT 58)

- **280 / 2119** · Gate 58 ✓ · C5·C6 [x] · C1·C4·C3 → **59**.

| 워커 | (58) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **59** |
| **C4** | → **59** |
| **C3** | → **59** |

### C5 — UI ENGINEER (264) — closed

- [x] **TASK 1** Gate **58차** — **280 / 2119** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C6 — TESTFIX ENGINEER (264) — closed

- [x] **TASK 10** q237 + CI **280/2119** ✓.

### C1·C4·C3 — S58 잔여 → S59

- TASK **2·3·4·5·7·8·9** 동일 행.

---

## SPRINT 263 — closed (보드 SPRINT 57)

- **280 / 2119** · Gate 57 ✓ · C5·C3·C6 **[x]** · C1·C4 → **58**.

| 워커 | (57) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **58** |
| **C4** | → **58** |

### C5 — UI ENGINEER (263) — closed

- [x] **TASK 1** Gate **57차** — **279 / 2115** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 — DOMAIN ENGINEER (263) — closed

- [x] **TASK 8** `arenaRunCompletion.edges.test.ts`.
- [x] **TASK 9** `POST /api/arena/event` **401**·**400**.

### C6 — TESTFIX ENGINEER (263) — closed

- [x] **TASK 10** q237 + CI **280/2119** ✓.

---

## SPRINT 262 — closed (보드 SPRINT 56)

- **279 / 2115** · Gate 56 ✓ · C5·C3·C6 [x] · C1·C4 → **57**.

| 워커 | (56) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **57** |
| **C1** | → **57** |
| **C4** | → **57** |

### C5 — UI ENGINEER (262) — closed

- [x] **TASK 1** Gate **56차** ✓.
- [x] **TASK 6** 엘리트 **PASS** ✓.

### C3 — DOMAIN ENGINEER (262) — closed

- [x] **TASK 8** — `reflectTextBounds.edges.test.ts`.
- [x] **TASK 9** — `GET /api/arena/weekly-stats` **401**·**200**.

### C6 — TESTFIX ENGINEER (262) — closed

- [x] **TASK 10** — q237-smoke + CI **279/2115** ✓.

---

## SPRINT 261 — closed (보드 SPRINT 55)

- **277 / 2108** · Gate 55 ✓ · C5·C3·C6 [x] · C1·C4 → **56**.

| 워커 | (55) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **56** |
| **C4** | → **56** |

### C5 — UI ENGINEER (261) — closed

- [x] **TASK 1** Gate **55차** — **277 / 2108** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 — DOMAIN ENGINEER (261) — closed

- [x] **TASK 8** `eliteMentorRequest.edges.test.ts`.
- [x] **TASK 9** `GET /api/arena/membership-request` 401·200.

### C6 — TESTFIX ENGINEER (261) — closed

- [x] **TASK 10** q237 **7/7** · CI **277/2108** ✓.

---

## SPRINT 260 — closed (보드 SPRINT 54)

- **275 / 2102** · Gate 54 ✓ · C5 [x] · C1·C4·C3·C6 → **55**.

| 워커 | (54) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C1** | → **55** |
| **C4** | → **55** |
| **C3** | → **55** |
| **C6** | → **55** |

### C5 — UI ENGINEER (260) — closed

- [x] **TASK 1** Gate **54차** — **275 / 2102** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 / C6 — S54 잔여 → S55

- TASK **8·9·10** 미완 → **55** 동일 행.

---

## SPRINT 259 — closed (보드 SPRINT 53)

- **275 / 2102** · Gate 53 ✓ · C5·C3·C6 [x] · C1·C4 → **54**.

| 워커 | (53) |
|------|-----|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **54** |
| **C4** | → **54** |

### C5 — UI ENGINEER (259) — closed

- [x] **TASK 1** Gate **53차** — **275 / 2102** ✓.
- [x] **TASK 6** 엘리트 3차 **PASS** ✓.

### C3 — DOMAIN ENGINEER (259) — closed

- [x] **TASK 8** `xpAwardDedup.edges.test.ts`.
- [x] **TASK 9** `GET /api/arena/weekly-xp` 401·200.

### C6 — TESTFIX ENGINEER (259) — closed

- [x] **TASK 10** q237-smoke + CI **275/2102** ✓.

---

## SPRINT 258 — closed (보드 SPRINT 52)

- **273 / 2097** · Gate 52 ✓ · C5·C3·C6 [x] · C1·C4 → **53**.

| 워커 | (52) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **53** |
| **C4** | → **53** |

---

## SPRINT 257 — closed (보드 SPRINT 51)

- **271 / 2091** · Gate 51 ✓ · 엘리트 §3 PASS · 잔여 C1·C3·C4·C6 → **52**.

---

## SPRINT 256 — closed (보드 SPRINT 50)

- **271 / 2091**·Build ✓·`eslint.ignoreDuringBuilds`·`NODE_OPTIONS 4096`·`outputFileTracingRoot`. C5·C3·C6 [x] · C1·C4 → **S51** (큐 보충).

| 워커 | (50) |
|------|------|
| **C5** | **1·6** **[x]** |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |
| **C1** | → **51** |
| **C4** | → **51** |

---

## SPRINT 255 — closed (보드 SPRINT 49)

- **종료 (2026-03-17):** 큐 보충으로 **S50** 오픈. Gate 49 **269/2086** 등 아카이브는 보드 S49 절 참고.

| 워커 | (49 최종) |
|------|-----------|
| **C5** | **1·6** **[x]** |
| **C1** | **2·3·5·7** → **50** |
| **C3** | **8·9** **[x]** |
| **C4** | **4** **[x]** — `/bty` 허브 region |
| **C6** | **10** **[x]** |

---

## SPRINT 254 — closed (보드 SPRINT 48)

- **종료 (2026-03-29):** C5·C3·C4·C6 전행 [x] · C1 **2·3·5·7** 미처리 → **S49** 흡수. **268 files / 2082 tests** (Gate 48).

| 워커 | (48 최종) |
|------|-----------|
| **C5** | TASK **1**·**6** **[x]** |
| **C1** | **2·3·5·7** → **49** |
| **C4** | TASK **4** **[x]** — My Page 개요 aria |
| **C3** | **8·9** **[x]** |
| **C6** | **10** **[x]** |

---

## SPRINT 253 — closed (보드 SPRINT 47)

- **종료 (2026-03-26):** 47에서 C3·C4·C5 **`[ ]` 없음** → **48 오픈**으로 병렬 큐 복구.

| 워커 | (47 최종) |
|------|-----------|
| **C5** | TASK **1**·**6** **[x]** |
| **C1** | TASK **2·3·5·7·10** 일부 → **48**에 흡수 |
| **C4** | TASK **4** **[x]** |
| **C3** | TASK **8·9** **[x]** |
| **C2** | **[x]** Gate 동기 |
| **C6** | 회귀 기록 **[x]** |

### C5 — UI ENGINEER (253)

- [x] **TASK 1** [VERIFY] Release Gate A~F Foundry 47차 — Vitest **266 / 2076**·Build ✓·`coreXpDisplay` NaN 표시키·`BTY_RELEASE_GATE_CHECK`·보드·`CURRENT_TASK`.
- [x] **TASK 6** [VERIFY] 엘리트 3차 체크리스트 — §2 6항목 **PASS**·`ELITE_3RD_SPEC_AND_CHECKLIST` §3.

**Notes:** **CONTINUE(C5) 2026-03-23** — C5 **253·보드 47** 행 **전원 [x].**
- **CONTINUE(C5) 2026-03-24:** 동일 — 보드 **SPRINT 47** C5 TASK **1·6 [x]** · **할 `[ ]` 없음** · **중단** (다음 큐 = C1 splint → **SPRINT 48**).
- **CONTINUE(C5) 재호출:** **미체크 없음** · **중단** (C1이 **SPRINT 48**/254 열 때까지 C5 대기).

### C3 — DOMAIN ENGINEER (253)

- [x] **TASK 8** — Arena domain 순수 규칙+테스트: `bty-app/src/domain/rules/coreXpDisplay.edges.test.ts` (음수·초대값 Core XP 표시 키; 주간 랭킹 무관).
- [x] **TASK 9** — Arena API: `GET /api/arena/today-xp` — null·비숫자 `xp` 행 합산 **200** `xpToday`.

**Notes:** **2026-03-23 CONTINUE** — vitest **266 files / 2076 tests** ✓.

### C4 — API ENGINEER (253)

- [x] **TASK 4** [UI] Center/Foundry 접근성 — `/growth` 카드 네비를 **`section role=region`** + **`growthHubMainRegionAria`** (ko/en). render-only. `sprint252-journey-growth-regression.smoke.test.ts` **4** ✓.
- **CONTINUE(C4) 2026-03-24:** C4 **`[ ]` 없음** — C1 문서 행·splint **48**까지 대기.

### C2 — GATEKEEPER (253)

- [x] **C5 TASK1(Gate 47) 후** — `BTY_RELEASE_GATE_CHECK`·`SPRINT_LOG`·self-healing-ci **266 files / 2076 tests**·Build PASS (2026-03-24). 워크스페이스: `arenaHubTitle` 타입·q237 result smoke·wireframe 링크 보정 후 CI 녹색.
- [x] **배포 `6afdfe4`** (`58b8342..6afdfe4` → origin/main, 108 files +5,767/-846) — §A~F·MVP·`SPRINT_LOG`·**277 / 2108**·build PASS.
- [x] **`origin/main` 갱신 `d7d5a24`** (`6afdfe4..d7d5a24`, 배포 **3ca0233** + run 라우트·Worker CI) — §A~F·MVP·`SPRINT_LOG`·**279 / 2117**·build PASS.
- [ ] **다음 `origin/main` push**(**d7d5a24** 초과) 시 §A~F·MVP·커밋 수치 **재1회**.

**CONTINUE(C2):** HEAD **`d7d5a24`**까지 반영 — **다음 push** 전까지 위 `[ ]` **보류.**

### C6 — TESTFIX ENGINEER (253)

- [x] `npm run test:q237-smoke` — **3 files / 7 tests** ✓.
- [x] `self-healing-ci.sh` — Lint ✓ · Test **266 files / 2076 tests** ✓ · Build ✓ · 수치 `SPRINT_LOG` **2026-03-24** 반영.

**Notes:** **CONTINUE(C6) 2026-03-24:** C5 TASK1·6 완료 후 실행. `uxPhase1Stub` 타입에 arena hub·result i18n 키 보강(`tsc` 녹색). **266/2076** PASS.

---

## SPRINT 252 — closed (2026-03-21)

- **Status:** closed — C3·C4·C5·C6·TASK8·9 완료. **C1 splint** → 보드 **SPRINT 47**·**253** 로 이관 (2026-03-23).

### C2 — GATEKEEPER (252) — 아카이브

- [x] **배포 `58b8342` 시점** Gate 완료. **다음 C2 일:** **253** — 배포 push 시 §A~F.

### C3 — DOMAIN ENGINEER (252)

**Allowed:** `bty-app/src/domain/center`, `bty-app/src/domain/foundry` 등 **해당 시스템 domain만** (Arena domain은 `rules/`·`leadership-engine/` 등 기존 경로; `lib`/`app` import 금지).

- [x] **Foundry:** `docs/CURSOR_TASK_BOARD.md` SPRINT 46 **TASK 8** — Center/Foundry **미커버 경계** `*.test.ts` 1건 → `npm test` 녹색. **`healing.edges.test.ts`** (celebration 키·액트 스킵·3 선행 위반).
- [x] **Foundry:** 동 보드 **TASK 9** — Center/Foundry **route** 테스트 1건 → 녹색. **`POST /api/journey/entries`** 잘못된 JSON → `day` 기본 1 upsert.
- [x] (선택) TASK8·9 완료 — C1 스킵 정리 불필요.

**Notes (252 C3):** **2026-03-21 CONTINUE** — 보드 SPRINT 46 TASK8·9 [x] 동기·vitest **265 files / 2073 tests** ✓.

### C4 — API ENGINEER (252)

**Allowed:** `src/app/api/`, `src/middleware.ts`

- [x] **`POST /api/journey/bounce-back`**(및 Journey 관련 GET) **회귀** — `ARENA_DOMAIN_SPEC` §4-11b·vitest 녹색. *(252: bounce-back·profile·entries 34 tests ✓.)*
- [x] API 변경 시 **handler → service만**·§4 JSDoc 1블록 갱신. *(252: 본 회귀 구간 API 변경 없음·해당 없음.)*
- **CONTINUE(C4) 2026-03-23:** C4 **미체크 없음** — C1 splint·**253**·보드 이번 런까지 API 큐 대기.

### C5 — UI ENGINEER (252)

**Allowed:** `src/app/[locale]/`, `src/components/`

- [x] Journey·Comeback·Growth 서브네비 **회귀 1건** — `growth/sprint252-journey-growth-regression.smoke.test.ts` (i18n en/ko·Growth RSC·Journey href·Arena 정책).
- [x] 루트 **`bty-arena/page.tsx` 수정 금지** 재확인 — 동 스모크 `growth\/journey`·`JourneyBoard` 미포함 assert.

**Notes (252 C5):** **CONTINUE(C5) 2026-03-21** — 위 2건 완료.
- **CONTINUE(C5) 2026-03-22:** C5 **252 미체크 없음** — C1 splint·보드 **253**까지 UI 큐 대기.
- **CONTINUE(C5) 재호출:** 동일 — **252 C5 `[ ]` 없음**·중단 (`CURSOR_TASK_BOARD` 이번 런 C5행도 확인 시 splint 전 과제 없음).

### C6 — TESTFIX ENGINEER (252)

- [x] `npm run test:q237-smoke`.
- [x] `bty-app/scripts/self-healing-ci.sh` — Lint·Test·Build PASS 후 **수치** `SPRINT_LOG` 또는 §C7에 기록.

**Notes:** **CONTINUE(C6) 2026-03-21:** q237-smoke **3 files / 7 tests** ✓; self-healing-ci **264 files / 2067 tests** · Lint ✓ · Build ✓ — 수치 `SPRINT_LOG` 2026-03-21 반영.

### C1 — COMMANDER (252) — 아카이브

- [x] **보드 SPRINT 47 오픈 (2026-03-23)** — splint 10 역할 대행·10행 `[ ]` 생성.

---

## SPRINT 251 — closed (참고)

- **Mode:** FOUNDRY
- **Sprint ID:** SPRINT **251**
- **Status:** closed
- **Objective (완료):** C3·C4·C5 TASK1–5·C6·C2 Gate **[x]** — Journey·bounce-back·Healing·LE·스테이지·테스트.

---

## GLOBAL RULES

- 완료 `[x]`, 막힘 `BLOCKER:`.
- REFRESH: 로그·게이트·플랜·코드 `[x]` 정합.

---

## C1 — COMMANDER

Planning only. `REFRESH`로 본 문서·로그만 갱신.

- **Last C1 REFRESH:** **2026-03-17** — **SPRINT 50** — S49 병렬 완료·C1 잔여 → **256**·**10행 `[ ]`**. REFRESH 동기.

---

## C2 — GATEKEEPER

**배치:** SPRINT 251. **배포 `58b8342` Gate 완료.** 다음 배포 push 시 TASK1·2 재오픈(C1 REFRESH 관행).

**Tasks:**
- [x] 배포 시 1회: BTY_RELEASE_GATE_CHECK § A~F·MVP_DEPLOYMENT_READINESS → 문서·SPRINT_LOG. **`58b8342`** (`cce5374..58b8342` → origin/main, 202 files +11,498/-718).
- [x] (선택) self-healing-ci.sh PASS·BTY_RELEASE_GATE_CHECK 동기. **264 files / 2067 tests** · Build PASS.

**Notes:** **2026-03-18** **`58b8342`** Gate PASS·본 문서·SPRINT_LOG 반영. C5 TASK1: Journey/bounce-back IA **잠금 완료** (`JOURNEY_BOUNCEBACK_IA.md`, `JOURNEY_NAV_WIREFRAME.md`) — 구현 착수 가능. **CONTINUE(C2):** TASK1·2 [x] — **미체크 없음·중단.** **CONTINUE(C2) 재호출:** 동일·중단. **CONTINUE(C2) 3:** 동일·중단.

---

## C3 — DOMAIN ENGINEER

**Allowed:** `src/domain/`, `src/lib/bty/arena/`

**Tasks:**
- [x] [Q3] **주간 경쟁:** **스테이지(티어) 표시** 라벨 키 1건(+테스트) — render-only.
- [x] [Q3] **대시보드:** **LE 진행도** 표시 퍼센트 **캡(0–100)** 상수 1건(+테스트).
- [x] [Q3] **Arena:** **시나리오 코드** 형식 검증 순수 함수 1건(+테스트) — 잘못된 ID 거부.
- [x] [Q4] **Healing:** **진행 불가(쿨다운 등)** 사용자 메시지 키 1건(+테스트).
- [x] [DOCS] **251** barrel·`arena-domain-rules` 1줄.

**Notes:** 251 C3 완료: `weeklyCompetitionStageTierBandDisplayLabelKey`; `clampDashboardLeProgressDisplayPercent`; `isValidArenaScenarioCodeId`; `healingPathProgressBlockedUserDisplayKey`·phase 키; §251.

---

## C4 — API ENGINEER

**Allowed:** `src/app/api/`, `src/middleware.ts`

**Tasks:**
- [x] [Q3] **POST arena/run/complete** **409** JSDoc·에러 본문 1블록.
- [x] [Q3] **GET arena/core-xp** **401** JSDoc 1블록.
- [x] [Q3] **GET me/access** **401** JSDoc 1블록.
- [x] [Q4] **GET bty/healing/progress** 또는 **healing/progress** **404** JSDoc 1블록.
- [x] [API] ARENA_DOMAIN_SPEC §4·**251** 정합.

**Notes:** 251 C4: run/complete·core-xp·me/access·healing progress·스펙. **251 C4 [1–5] 완료:** run/complete 409 `RUN_ABORTED`·core-xp/me/access/healing JSDoc·§4·게이트 251 정합(409=aborted).
- **CONTINUE(C4) Journey IA:** `POST /api/journey/bounce-back` `@contract`·§4-11b·Bearer|쿠키 명시(C5 Comeback은 필요 시 `credentials: 'include'` 병행).
- **251 종료 (C4):** 추가 API 태스크 없음. **252** = C1 splint 후 C4 열.

---

## C5 — UI ENGINEER

**Allowed:** `src/app/[locale]/`, `src/components/`

**Tasks:**
- [x] [Q3] Journey·bounce-back — Growth sub-nav (Dojo·Integrity·Guidance·Journey) + `/growth/journey` JourneyBoard; global Comeback → Resume Journey + POST bounce-back; Reflection → dear-me; IA 문서 준수.
- [x] [Q3] **대시보드:** **LE 진행도** 바·퍼센트 render-only(도메인 캡).
- [x] [Q3] **주간 경쟁:** **스테이지** 라벨 render-only(도메인 키).
- [x] [Q4] **Healing:** **진행 불가** 토스트·인라인 메시지(render-only; 도메인 키).
- [x] [UI] **i18n:** LE 진행·스테이지·Healing 메시지 en/ko.

---

### C5 TASK1 — Journey / Comeback Flow (UI & Navigation)

#### Previous Status

BLOCKED

#### Reason for Blocker

Journey (28-day recovery loop) and bounce-back behavior were not clearly defined at the product IA/UX level.

Specifically, the following were undefined:

- Where Journey should live in the navigation structure
- When and how users enter Journey
- What bounce-back represents (event vs score vs progression)
- Whether comeback affects XP, leaderboard, or season logic
- Whether Journey resets or continues after inactivity

This ambiguity prevented UI and navigation implementation.

---

#### Resolution

The blocker is resolved by locking the Journey and bounce-back IA/UX definition.

See:

- docs/JOURNEY_BOUNCEBACK_IA.md
- docs/JOURNEY_NAV_WIREFRAME.md
- docs/JOURNEY_COMEBACK_UX_SPEC.md

**Key decisions:**

- Journey is part of Growth (not Arena, not My Page, not top-level nav)
- Journey is a recovery loop, not a gameplay or dashboard feature
- Entry via:
  - comeback trigger (3+ days inactivity)
  - Growth menu
  - deep link
- bounce-back is a recovery event only
  - no XP impact
  - no leaderboard impact
  - no season impact
- bounce-back is recorded on "Resume Journey" action only
- default progression = continue from current_day
- no forced reset
- restart is optional and user-initiated only
- Journey UI follows calm, observational tone (no reward/punishment framing)

---

#### Current Status

**READY FOR IMPLEMENTATION** — *SPRINT 251에서 C5 TASK1 구현 완료 `[x]`; 본 절은 해제 근거·스코프 기록(복붙·이관용).*

---

#### Implementation Scope (C5 TASK1)

**Frontend:**

- Comeback modal UI + behavior
- JourneyBoard screen
- Journey step screen
- Growth → Journey entry
- Deep link handling

**Integration:**

- Connect Resume Journey → `POST /api/journey/bounce-back`
- Use `GET /api/journey/profile` for current_day and status

**Constraints:**

- Do not expose bounce_back_count as competitive stat
- Do not connect Journey to XP, leaderboard, or season UI
- Do not introduce forced reset behavior

---

#### Outcome

C5 TASK1 is unblocked and can proceed with UI and navigation implementation based on the locked IA and UX policy.

---

**Notes:** 루트 `bty-arena/page.tsx` 수정 금지. **251 C5 TASK1–5 [x].**
- **CONTINUE(C5) 2026-03-18:** TASK1 완료 — `growth/page` sub-nav·`growth/journey`·`Comeback`(locale layout)·`JourneyBoard variant=growth`·i18n en/ko.
- **CONTINUE(C5):** 미체크 Task 없음 — SPRINT **251** C5 전원 `[x]`; **252**는 C1 splint 후 본 문서 갱신까지 대기.
- **CONTINUE(C5) 재호출:** 동일 — C5 표준 Task `[ ]` 없음·중단.
- [2–5] 완료: `LeStageWidget`+`clampDashboardLeProgressDisplayPercent`; `weeklyCompetitionStageTierBandDisplayLabelKey`+`weeklyCompetitionStageBandCopy`; `ACT_PREREQUISITE`/`COOLDOWN_ACTIVE`+`healingPathProgressBlockedCopy`; i18n.

**Blockers:** —

---

## C6 — TESTFIX ENGINEER

**Tasks:**
- [x] [Q3] **`npm run test:q237-smoke`** 회귀.
- [x] [Q3] **POST arena/run/complete** **409** route.test 1건(짝).
- [x] [TEST] **GET arena/core-xp** **401** route.test 1건.
- [x] [TEST] C3 **251** LE 캡·시나리오·Healing 키 엣지 1건.
- [x] [TEST] npm test·npm run build 녹색·플랜 반영.

**Notes:** 251 C6 완료: q237-smoke; run/complete `meta.aborted_at`→409 RUN_ABORTED+401 짝; core-xp 연속 401; barrel 251 LE 하한·시나리오 빈문자 거부; test+build PASS.

---

## C7 — INTEGRATOR

도구: `./scripts/self-healing-ci.sh` (bty-app)

- **lint:** PASS
- **test:** PASS
- **build:** PASS
- **overall:** PASS
- **Owner to fix:** —

**Last run:** 2026-03-18 — self-healing-ci.sh · Lint PASS · Test PASS (**284 files** / **2131 tests**) · Build PASS · **Overall PASS** (SPRINT 270 C7 · S64).

*C2 문서 게이트:* `cce5374`·`BTY_RELEASE_GATE_CHECK`. *이전 배포 풀 스위트 참고:* `58b8342` 264 files.*

---

## BLOCKERS

- *(없음 — C5 TASK1 Journey·bounce-back 구현 완료.)*

---

## 다음 스프린트 (253)

**252** 진행 중 — 상단 **SPRINT 252** `[ ]` 완료 후 C1 splint로 **253**·보드 이번 런 10행 생성.

**REFRESH (252→253):** splint 후 First Task(통상 C5 Release Gate 또는 C2 배포 Gate)부터 표 잠금.

**REFRESH 명령(운영)**: **refresh** 요청 시 `docs/agent-runtime/REFRESH_PROCEDURE.md` — 이번 태스크 점검 → **C2~C6 각 작업 5개** 인라인 → 각 Cursor가 서류 확인 후 해당 열만 진행.


---

## HANDOFFS

- **REFRESH (C1):** **246→247.** runs cursor·profile 422·elite 캐시·Healing 409·UI 페이지네이션·SLA·공유 스텁.
- **REFRESH (C1):** **247→248.** 리더보드 계약·dashboard·journey·center letter·UI 티어·런 상태·Healing 진행·테스트.
- **REFRESH (C1):** **248→249.** C3·C4·C5(2~5)·C6 [x]. C2·C5 TASK1 BLOCKER만. 249 배치 생성.
- **REFRESH (C1):** **249→250.** run 404·profile·leaderboard 401·center resilience·UI tie·빈추천·레벨·테스트.
- **REFRESH (C1):** **250→251.** run/complete 409·core-xp·me/access·healing progress·LE 캡·스테이지·Healing UI·테스트.
- **REFRESH (C1):** **251** — C3·C4·C5(2–5)·C6·C2 Gate [x]. C5 TASK1 IA 잠금·구현 진행. **252** 대기(C1 splint).
- **push:** 배포 후 C2 → REFRESH.

---

## 워커별 다음 작업 5건 (251) — **아카이브(계획 시트)**

251 비-BLOCKER 태스크는 상단 C3–C6 본문과 동일하게 **[x]**. **다음 실무 큐 = 252** (C1이 생성·본 표 교체).

| # | **C2** | **C3** | **C4** | **C5** | **C6** |
|---|--------|--------|--------|--------|--------|
| 1 | Gate(배포 시) | 주간 스테이지 키 | run/complete 409 | Journey·Growth·IA (`JOURNEY_*`) | q237-smoke |
| 2 | self-healing-ci | LE 진행 캡 | core-xp 401 | LE 바 | run/complete 409 test |
| 3 | — | 시나리오 검증 | me/access 401 | 스테이지 라벨 | core-xp 401 test |
| 4 | — | Healing 메시지 키 | healing progress 404 | Healing 토스트 | C3 251 엣지 |
| 5 | — | barrel·251 | SPEC §4·251 | i18n | test·build |

---

## 참고

- docs/JOURNEY_BOUNCEBACK_IA.md · docs/JOURNEY_NAV_WIREFRAME.md · docs/JOURNEY_COMEBACK_UX_SPEC.md (Journey·comeback)
- docs/CURRENT_TASK.md · docs/CURSOR_TASK_BOARD.md · docs/BTY_RELEASE_GATE_CHECK.md
- docs/BTY_MULTI_CURSOR_DOC_HANDOFF.md · docs/BTY_ARENA_UX_DOC_INDEX.md
- docs/ROADMAP_Q3_Q4.md · docs/MVP_DEPLOYMENT_READINESS.md
