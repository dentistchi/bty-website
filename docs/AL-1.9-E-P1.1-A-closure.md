# AL-1.9-E-P1.1-A — Sprint Closure (3 sub-sprint integration)

**Sprint**: AL-1.9-E-P1.1-A — Suppression coverage helper extraction + caller wiring
**Date**: 2026-05-06
**Status**: COMPLETE — refactor axis ✅ + suppression coverage axis ✅ + test safety net ✅
**Predecessors**: [AL-1.9-E-P1.1+P1.2 inventory](AL-1.9-E-P1.1-P1.2-inventory.md) + [AL-1.9-E-P1.3 closure inventory](AL-1.9-E-P1.3-inventory.md)

---

## Sprint summary

[AL-1.9-E-P1.3 inventory](AL-1.9-E-P1.3-inventory.md) closure 가 fix scope 를 2 axis (refactor + suppression coverage) 로 분리한 것을 받아, 본 sprint 는 3 sub-sprint 로 axis 통합 진행.

- **D-sub1 (refactor axis)** — `arenaSessionNextCore.ts:103-109` 의 inline served-scenario suppression query 를 `fetchRecentServedScenarioIds` helper 로 추출. behavior preserve, single source of truth 확립.
- **D-sub2 (suppression coverage axis)** — 3 router caller (`post-session-router`, `foundry-arena-return`, `recovery-loop-router`) 에 helper wiring 추가. `arenaSessionNextCore` 외 나머지 3 path 도 동일 suppression policy 적용.
- **D-sub3 (closure + test axis)** — 3 router caller integration test 추가 (servedArenaScenarioIds wiring contract 자동 검증) + 본 closure doc.

---

## Commit chain

| Sub-sprint | Axis | Inner | Outer |
|---|---|---|---|
| (cross-ref) | P1.3 closure | — | `824a494` |
| D-sub1 | refactor | `aea73d2` | `affb20f` |
| D-sub2 | suppression coverage | `91ba61a` | `56591f5` |
| D-sub3 | test + closure | `b91d893` | `6a458b0` |
| Deploy | staging worker | working tree (dirty-tree pattern) | worker `964c3911` (2026-05-07) |

---

## Verify gate evidence

### D-sub1 (refactor axis)
- Helper unit test 5/5 ([`fetchRecentServedScenarioIds.test.ts`](../bty-app/src/lib/bty/arena/fetchRecentServedScenarioIds.test.ts)): happy path / non-string filter / null-data silent-error / default 24h query shape / custom windowHours
- arenaSessionNextCore regression 5/5 — 특히 `constructs arena_runs query with .in([DONE,IN_PROGRESS,ABANDONED]) + .gte(24h-ago)` regression 이 helper 추출 후에도 unchanged PASS → **query-shape preservation 직접 증거**
- tsc baseline 14 pre-existing errors in 5 unrelated files, 0 new

### D-sub2 (suppression coverage axis)
- Helper unit test re-run 5/5 (D-sub1 baseline 유지)
- arenaSessionNextCore regression re-run 5/5
- tsc baseline 14 unchanged
- Sanity grep 결과: 3 wider caller (`/api/arena/session/post-session/route.ts:50` API handler, `program-completion.service.ts:72` foundry orchestrator, `slip-recovery.service.ts:151` dynamic import) 모두 internal mutation 에 영향 없음 — 3 router 함수 signature 무변경
- Mutation 3 brace preservation spot-check: [recovery-loop-router.ts](../bty-app/src/engine/integration/recovery-loop-router.ts) L160 case-close `}` + L161 후속 `case "dojo_assessment"` 모두 untouched 확인

### D-sub3 (closure + test axis)
- 3 caller integration test 추가 (`*.served-suppression.test.ts`):
  - [`post-session-router.served-suppression.test.ts`](../bty-app/src/engine/integration/post-session-router.served-suppression.test.ts) — 2 cases (helper returns IDs / helper returns [])
  - [`foundry-arena-return.served-suppression.test.ts`](../bty-app/src/engine/integration/foundry-arena-return.served-suppression.test.ts) — 3 cases (helper returns IDs / helper returns [] / admin null)
  - [`recovery-loop-router.served-suppression.test.ts`](../bty-app/src/engine/integration/recovery-loop-router.served-suppression.test.ts) — 3 cases (helper returns IDs / helper returns [] / admin null)
- 8 cases total all PASS
- tsc baseline 14 unchanged
- D-sub1 + D-sub2 baseline tests 모두 re-run green (helper 5/5 + regression 5/5)
- Mock pattern: `vi.mock` module-level (helper + selector + admin + caller dependencies), `expect.objectContaining({ servedArenaScenarioIds: [...] })` assertion. Reference: `user-scenario-played-append.service.test.ts` caller-layer mock convention.

### Deploy + DB-Verify (post-964c3911, 2026-05-07)

**Deploy**: 2026-05-07T12:56:20Z, worker `964c3911-3610-4bc7-ab2d-b4fe8eda7881` (replaces `5aebbe79-d698-4463-ab89-0d5b511ba4ef`). URL `https://bty-arena-staging.ywamer2022.workers.dev`.

**Build**: `npm run deploy` = prebuild + cf:build + cf:deploy. Bundle 26727.28 KiB / gzip 4089.34 KiB. Worker startup 32 ms. 1 new asset (BUILD_ID).

**Pre-deploy state**:
- Inner repo HEAD: `aa5cd07` (D-sub1 from prior cycle, by Hanbit)
- Working tree: D-sub2 (3 router callers modified) + D-sub3 (3 test files untracked) + ~108 other WIP files (i18n / avatar / Quick Mode / archetype, mostly already-deployed via prior cycles per single-env dirty-tree pattern)
- Pre-deploy 13/13 tests green (5 D-sub1 helper unit + 8 D-sub3 wiring integration)
- `.env.local` cleanup: skipped per (a-modified) decision — middleware NODE_ENV guard tree-shakes BYPASS_AUTH branch in production build, prior 4 deploys empirical evidence (1ca9f98b/bb1479c6/c79c4432/5aebbe79 all shipped with same .env.local content + functional)

**4-signal verify**:
| # | Signal | Evidence |
|---|---|---|
| 1 | Version ID | `964c3911-3610-4bc7-ab2d-b4fe8eda7881` (wrangler versions list 2026-05-07T12:56:20Z, ywamer2022@gmail.com) |
| 2 | Worker live | HTTP 200 on `/api/version`, JSON response valid (URL responding) |
| 3 | Bundle code | `handler.mjs` 4× `servedArenaScenarioIds` references + 5 chunks contain D-sub2 wiring (helper + 3 caller). Minified sample: `servedArenaScenarioIds:p}` followed by `if(null===q)return{status:403` (arenaSessionNextCore + selector wiring). |
| 4 | DB baseline preservation | Q3 ywamer played_scenario_ids = `["core_02_new_doctor_reexposure_compromise_loop", "core_03_training_failure_hidden_as_performance_issue"]` (count=2) — exact match with memory L484 (`5aebbe79` baseline). P5-A.2 cold-start archive intact, redeploy 무회귀. |

**Signal 5 (runtime trace) deferred**: Q1 (test user 38ce28d2 arena_runs) shows 0 post-deploy activity (all 20 rows from 2026-05-04, in_window=false). Q2 corrected (arena_events post-deploy timestamp filter) returned 0 rows. **Expected** — fresh deploy, no organic user activity yet. P1.1-A 3 router caller path runtime verify pending natural user trigger or manual smoke. Not deploy gate (P1.1-A is coverage extension of already-verified main mechanism — Pipeline N rotation engine via P1+P5-A+P5-A.2 from `5aebbe79`).

**Q2 schema-drift incidental**: R3 inventory Section 8 의 Q2 SQL draft 가 `arena_events.payload->>'scenario_id'` 사용했으나 actual schema 는 `scenario_id` 직접 column ([20260222_000001_arena_core.sql:46](../bty-app/supabase/migrations/20260222_000001_arena_core.sql)). Single-signal violation case 추가 — `feedback_execution_claim_observable_artifact.md` invariant 의 data layer 적용. Memory 갱신 시 invariant 강화 항목.

**P1.1-A operational closure verdict**: Deploy + 4-signal verify confirmed. AL-1.9-E sprint family closure status (memory L470-552 lock) maintained + extended to 3 router caller path coverage. Cycle natural closure 가능 frame.

---

## Defer items closure (cross-link)

| Item (P1.2 inventory origin) | Status |
|---|---|
| `recovery-loop-router scenario_retry` semantics 확정 | **resolved** — [AL-1.9-E-P1.3-inventory.md](AL-1.9-E-P1.3-inventory.md) `different_scenario_required` convergence (outer `824a494`) |
| `arena_runs.status` DB default 검증 (Incidental C) | deferred — DB schema audit sprint |
| `runIdParam` cleanup (Incidental D) | deferred — cleanup sprint |
| `quickModeService` router-bypass axis | deferred — Quick Mode suppression policy sprint |

---

## Out of scope (re-confirm per P1.3 inventory)

- ❌ `quickModeService.ts:39` (router-bypass, 별 axis)
- ❌ `scenario_retry` task type rename (breaking change)
- ❌ `slip_recovery_tasks` schema 변경

---

## Deploy gate evaluation

본 sprint mutation 은 router-internal helper extraction + wiring + test 만 — auth / reset / leaderboard / API surface 변경 0. [BTY_RELEASE_GATE_CHECK.md](BTY_RELEASE_GATE_CHECK.md) 의 명시 트리거 항목엔 해당 안 됨.

Production scenario rotation behavior 변경은 의도된 결과 (P1.3 inventory `scenario_retry = different_scenario_required` 와 부합) 이며 user-perceivable 측면 있어 staging soak 권고. release gate 강제 갱신은 미해당.

---

## Next entry candidates

1. **quickModeService router-bypass axis** (medium priority) — Quick Mode 의 served suppression 정책 결정 + `selectNextScenario` 직접 호출 path 의 servedIds 처리
2. **AL-1.9-B (UX completion 분석)** — Arena run completion rate dominant 차단 (AL-1.9-A audit reframe)
3. **DB schema audit sprint** — `arena_runs.status` DB default 검증 + `runIdParam` cleanup (P1.2 Incidental C+D)
4. **Defer backlog** — `scenario_retry` rename / `BTY_DEPLOY_VERSION` wrangler stale / `NEXT_PUBLIC_BTY_AI_URL` inline

---

## References

- Predecessor inventories: [AL-1.9-E-P1-inventory.md](AL-1.9-E-P1-inventory.md), [AL-1.9-E-P1.1-P1.2-inventory.md](AL-1.9-E-P1.1-P1.2-inventory.md), [AL-1.9-E-P1.3-inventory.md](AL-1.9-E-P1.3-inventory.md)
- Helper: [bty-app/src/lib/bty/arena/fetchRecentServedScenarioIds.ts](../bty-app/src/lib/bty/arena/fetchRecentServedScenarioIds.ts)
- Engine spec: [bty-app/docs/ENGINE_ARCHITECTURE_V1.md](../bty-app/docs/ENGINE_ARCHITECTURE_V1.md) §6.3 (Routing logic under Pipeline N), §6.6 (`/api/arena/session/next` deprecation, Pipeline L)
