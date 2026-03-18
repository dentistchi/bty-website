# BTY SPRINT PLAN

멀티 Cursor 스프린트의 **단일 진실(single source of truth)** 문서.

---

## 범위

- 기능 백로그(Q3·Q4). **배포·Gate는 배포 시 1회.**
- 참조: `MVP_DEPLOYMENT_READINESS` + `bty-release-gate.mdc` A~F + `BTY_RELEASE_GATE_CHECK.md`.

---

## SPRINT

- **Mode:** FOUNDRY
- **Sprint ID:** SPRINT **251**
- **Status:** active
- **Objective:** **250 종료** — C3·C4·C5(2~5)·C6 **[x]**. C2·C5 TASK1 잔여. Q3 **run 완료·core XP**, Q4 **Healing 진행** + 테스트.

---

## GLOBAL RULES

- 완료 `[x]`, 막힘 `BLOCKER:`.
- REFRESH: 로그·게이트·플랜·코드 `[x]` 정합.

---

## C1 — COMMANDER

Planning only. `REFRESH`로 본 문서·로그만 갱신.

---

## C2 — GATEKEEPER

**배치:** SPRINT 251. **다음 origin/main 배포 push** 시 게이트.

**Tasks:**
- [ ] 배포 시 1회: BTY_RELEASE_GATE_CHECK § A~F·MVP_DEPLOYMENT_READINESS → 문서·SPRINT_LOG. **BLOCKER:** **cce5374** 이후 **신규 배포 push 없음**.
- [ ] (선택) self-healing-ci.sh PASS·BTY_RELEASE_GATE_CHECK 동기.

**BLOCKER (CONTINUE 2026-03-18):** `origin/main` HEAD = **cce5374** — 신규 배포 push 없음 → TASK1 Gate 미실행.

**Notes:** **cce5374** 이후 push 없으면 TASK1 보류. **CONTINUE(C2) SPRINT 251:** 배포 push 시 Gate. **2026-03-18 C2 CONTINUE:** HEAD 여전히 cce5374; TASK1 보류, TASK2 미진행(블록 시 중단 규칙).

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

**Notes:** 251 C4: run/complete·core-xp·me/access·healing progress·스펙.
- [1–5] 완료: run/complete 409 `RUN_ABORTED`·core-xp/me/access/healing JSDoc·§4·게이트 251 정합(409=aborted).

---

## C5 — UI ENGINEER

**Allowed:** `src/app/[locale]/`, `src/components/`

**Tasks:**
- [ ] [Q3] Journey·bounce-back — **BLOCKER:** UX/IA 확정 전.
- [x] [Q3] **대시보드:** **LE 진행도** 바·퍼센트 render-only(도메인 캡).
- [x] [Q3] **주간 경쟁:** **스테이지** 라벨 render-only(도메인 키).
- [x] [Q4] **Healing:** **진행 불가** 토스트·인라인 메시지(render-only; 도메인 키).
- [x] [UI] **i18n:** LE 진행·스테이지·Healing 메시지 en/ko.

**Notes:** 루트 `bty-arena/page.tsx` 수정 금지. **251 TASK2–5 [x].** TASK1 BLOCKER.
- **CONTINUE(C5) 2026-03-18:** TASK1 미착수 — **BLOCKER:** Journey·bounce-back UX/IA 미확정(구현·체크 불가).
- **CONTINUE(C5) 2026-03-18 (2):** 동일 — **BLOCKER:** UX/IA 확정 전까지 TASK1 착수 불가.
- [2–5] 완료: `LeStageWidget`+`clampDashboardLeProgressDisplayPercent`; `weeklyCompetitionStageTierBandDisplayLabelKey`+`weeklyCompetitionStageBandCopy`; `ACT_PREREQUISITE`/`COOLDOWN_ACTIVE`+`healingPathProgressBlockedCopy`; i18n.

**Blockers:** TASK1 Journey·bounce-back — UX/IA 확정 전.

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

**Last run:** 2026-03-18 — self-healing-ci.sh · Lint PASS · Test PASS (**264 files** / **2067 tests**) · Build PASS · **Overall PASS** (SPRINT 251 C7 · latest).

---

## BLOCKERS

- C5 TASK1: Journey·bounce-back.
- C2: 배포 push 없음 시 게이트 보류.

---

## 다음 스프린트 (252)

251에서 비-BLOCKER 전부 `[x]`, C2·C5 BLOCKER만 남으면 **252** 생성.

**REFRESH (251, 문서 정합):** **C3·C4·C5 TASK2–5·C6** 본문 표 기준 전부 **[x]**. **잔여 BLOCKER만:** C5 TASK1 Journey·bounce-back(UX/IA), C2 배포 push 시 Gate. → 비-BLOCKER는 251에서 종료; **252**는 C1 splint·REFRESH로 표 갱신.


---

## HANDOFFS

- **REFRESH (C1):** **246→247.** runs cursor·profile 422·elite 캐시·Healing 409·UI 페이지네이션·SLA·공유 스텁.
- **REFRESH (C1):** **247→248.** 리더보드 계약·dashboard·journey·center letter·UI 티어·런 상태·Healing 진행·테스트.
- **REFRESH (C1):** **248→249.** C3·C4·C5(2~5)·C6 [x]. C2·C5 TASK1 BLOCKER만. 249 배치 생성.
- **REFRESH (C1):** **249→250.** run 404·profile·leaderboard 401·center resilience·UI tie·빈추천·레벨·테스트.
- **REFRESH (C1):** **250→251.** run/complete 409·core-xp·me/access·healing progress·LE 캡·스테이지·Healing UI·테스트.
- **REFRESH (C1):** **251** — C3·C4·C5(2–5)·C6 [x]. BLOCKER: C5 TASK1·C2 Gate. **252** 대기(C1 splint).
- **push:** 배포 후 C2 → REFRESH.

---

## 워커별 다음 작업 5건 (251) — **아카이브(계획 시트)**

251 비-BLOCKER 태스크는 상단 C3–C6 본문과 동일하게 **[x]**. **다음 실무 큐 = 252** (C1이 생성·본 표 교체).

| # | **C2** | **C3** | **C4** | **C5** | **C6** |
|---|--------|--------|--------|--------|--------|
| 1 | Gate(배포 시) | 주간 스테이지 키 | run/complete 409 | **BLOCKER** | q237-smoke |
| 2 | self-healing-ci | LE 진행 캡 | core-xp 401 | LE 바 | run/complete 409 test |
| 3 | — | 시나리오 검증 | me/access 401 | 스테이지 라벨 | core-xp 401 test |
| 4 | — | Healing 메시지 키 | healing progress 404 | Healing 토스트 | C3 251 엣지 |
| 5 | — | barrel·251 | SPEC §4·251 | i18n | test·build |

---

## 참고

- docs/CURRENT_TASK.md · docs/CURSOR_TASK_BOARD.md · docs/BTY_RELEASE_GATE_CHECK.md
- docs/BTY_MULTI_CURSOR_DOC_HANDOFF.md · docs/BTY_ARENA_UX_DOC_INDEX.md
- docs/ROADMAP_Q3_Q4.md · docs/MVP_DEPLOYMENT_READINESS.md
