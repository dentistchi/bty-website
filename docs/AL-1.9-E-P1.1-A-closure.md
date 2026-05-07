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
