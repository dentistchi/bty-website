# AL-1.9-E-P1.1 + P1.2 — Router Caller Inventory & Pipeline N Path Closure

**Sprint**: AL-1.9-E-P1.1 (router caller inventory) + AL-1.9-E-P1.2 (Pipeline N path inventory)
**Date**: 2026-05-06
**Status**: INVENTORY COMPLETE (코드 변경 0) — verify pass, closure
**Predecessor**: AL-1.9-E-P1 fix (closed; `arena_runs.status` filter expanded to `[DONE, IN_PROGRESS, ABANDONED]` + 24h window in `arenaSessionNextCore.ts:103-109`)
**Successor**: AL-1.9-E-P1.1-A fix sprint (scope 확정, 본 closure 후 진입)

---

## Sprint Scope + Entry Trigger

P1 fix 가 `arenaSessionNextCore.ts` 한 spot 만 cover. **다른 router caller 가 동일 selector 를 호출할 때 served suppression 이 작동하는가** 가 inventory 질문.

- **P1.1**: production 에서 `getNextScenarioForSession` / `selectNextScenario` 를 호출하는 caller 전수 식별 + `servedArenaScenarioIds` option 전달 여부 점검.
- **P1.2**: Pipeline N runtime 에서 user 가 1 scenario 완료 후 next scenario 받는 경로 (entry → step → terminal → next routing) trace + P1 suppression coverage 결론.

Entry trigger:
- P1.1 → P1 fix 의 **suppression scope question** (다른 caller path 도 P1 의 servedIds 받는지 단일 signal 만으로 판정 불가)
- P1.2 → Pipeline N 에서 별도 next-scenario routing path 가 있는지 (P1 fix 의 cover 범위 밖에 있는지)

---

## P1.1 Inventory Result — `confirmed_partial`

### Production router callers (4)

| # | File:line | Function/Caller | `servedArenaScenarioIds` 전달 | Note |
|---|---|---|---|---|
| 1 | [src/lib/bty/arena/arenaSessionNextCore.ts:121-123](../bty-app/src/lib/bty/arena/arenaSessionNextCore.ts#L121-L123) | `runArenaSessionNextCore` (Pipeline L `/api/arena/session/next` + Pipeline N `/api/arena/n/session` 공유 core) | ✓ 전달 (P1 fix 영역) | servedIds = `arena_runs.status in [DONE, IN_PROGRESS, ABANDONED]` ∩ `started_at >= now − 24h` |
| 2 | [src/engine/integration/post-session-router.ts:84-87](../bty-app/src/engine/integration/post-session-router.ts#L84-L87) | `routePostSession` `outcome.dismissal === "next_scenario"` branch | ✗ 미전달 (gap) | options 에 `preferFlagType` / `forceDifficultyTier` 만; `servedArenaScenarioIds` 필드 자체 없음 |
| 3 | [src/engine/integration/foundry-arena-return.ts:156-159](../bty-app/src/engine/integration/foundry-arena-return.ts#L156-L159) | `handleFoundryCompletion` (post-Foundry routing) | ✗ 미전달 (gap) | options 에 `foundry_return: true` + 선택적 `preferFlagType` 만 |
| 4 | [src/engine/integration/recovery-loop-router.ts:145-147](../bty-app/src/engine/integration/recovery-loop-router.ts#L145-L147) | `routeRecoveryTask` `case "scenario_retry"` branch | ✗ 미전달 (gap, semantics 불확정) | options 에 `preferFlagType: POST_SESSION_INTEGRITY_SLIP_FLAG` 만; **scenario_retry 의 의도된 semantics 가 "동일 scenario 의도된 retry" 인지 "새 scenario 추천" 인지** 별도 inventory 필요 |

### Production direct selector caller — router 우회 (1)

| # | File:line | Function/Caller | Note |
|---|---|---|---|
| 5 | [src/lib/bty/arena/quickModeService.ts:39](../bty-app/src/lib/bty/arena/quickModeService.ts#L39) | `selectAndRecordQuickScenario` | `selectNextScenario(userId, locale)` 직접 호출 (options 빈값). **별 axis** — quickModeService 는 router layer 자체를 우회. servedIds 가 `selectNextScenario` 에 전달되려면 caller 가 명시 필요 |

### Test/smoke helpers (production 무관, 3)

기록은 prior cycle 에서 cover. 이 closure 의 fix scope 에 포함 X.

---

## P1.2 Inventory Result — Pipeline N Path Covered

### Pipeline N entry / step / terminal / next routing trace

| 단계 | Endpoint / Function | File:line | 결과 |
|---|---|---|---|
| Entry | `GET /api/arena/n/session?locale=ko\|en[&runId]` | [src/app/api/arena/n/session/route.ts:12-44](../bty-app/src/app/api/arena/n/session/route.ts#L12-L44) | Pipeline default guard 후 `runArenaSessionNextCore` 호출 (Pipeline L 와 동일 core) |
| Run insert | `POST /api/arena/run` | [src/app/api/arena/run/route.ts:43-47](../bty-app/src/app/api/arena/run/route.ts#L43-L47) | Client 가 entry 응답 받은 후 별도 호출. `arena_runs` insert (status default; 코드상 명시 X) |
| Step events | `POST /api/arena/run/step` step 3 | [src/app/api/arena/run/step/route.ts:240-253](../bty-app/src/app/api/arena/run/step/route.ts#L240-L253) | `ESCALATION_APPLIED` |
| Step events | `POST /api/arena/run/step` step 4 | [src/app/api/arena/run/step/route.ts:359-367](../bty-app/src/app/api/arena/run/step/route.ts#L359-L367) | `SECOND_CHOICE_CONFIRMED` |
| Terminal | `POST /api/arena/run/complete` | [src/app/api/arena/run/complete/route.ts:97-101](../bty-app/src/app/api/arena/run/complete/route.ts#L97-L101) | `arena_runs.status = "DONE"`, `completed_at = nowIso` + `RUN_COMPLETED_APPLIED` (정상 XP) 또는 `RUN_COMPLETE_CONTRACT_QUEUED` (계약 gated) emit |
| Next routing | `useArenaSession.continueNextScenario` | [src/app/[locale]/bty-arena/hooks/useArenaSession.ts:1888-2031](../bty-app/src/app/[locale]/bty-arena/hooks/useArenaSession.ts#L1888-L2031) | 클라이언트가 directly `POST run/complete` → `fetchArenaSessionRouterPack` → `GET /api/arena/n/session` (router 재호출) → `createRun` 으로 새 `arena_runs` 행 |

### Routing path label

**`via_router_caller_X`** = via `useArenaSession.continueNextScenario → fetchArenaSessionRouterPack → GET /api/arena/n/session → arenaSessionNextCore → getNextScenarioForSession`

`/api/arena/run/complete` 는 next scenario body 를 emit 하지 않음. transient `snapshotForNextScenarioReady` 만 반환 (UI hint). **실제 selector 재호출은 client 가 router 를 다시 hit 해서 트리거**.

### P1 suppression coverage 결론

**covered**

근거:
- Pipeline N 의 next routing 은 **arenaSessionNextCore 와 같은 path** 를 다시 통과 (`GET /api/arena/n/session` 재호출).
- arenaSessionNextCore.ts:103-109 의 servedIds query 가 매 호출마다 실행 (`status in [DONE, IN_PROGRESS, ABANDONED]` ∩ `started_at >= now − 24h`).
- [src/engine/scenario/scenario-selector.service.ts:393-411](../bty-app/src/engine/scenario/scenario-selector.service.ts#L393-L411) 의 `selectNextScenario` 가 servedIds 를 `playedSet` 에 union → 후보 풀에서 제외.
- 즉 P1 fix 가 자동으로 Pipeline N 의 next-scenario path 도 cover.

---

## Incidental Findings — 별 Axis 분리

| Axis | 발견 | Risk | Disposition |
|---|---|---|---|
| A | `/api/arena/session/next` (Pipeline L legacy) Pipeline N 모드에서 fail-loud ([src/app/api/arena/session/next/route.ts:9-14](../bty-app/src/app/api/arena/session/next/route.ts#L9-L14) — `Use Pipeline N run/start and run/step APIs.`) | 0 | 의도된 동작. Inventory note only |
| B | Re-exposure / Forced reset / Blocked-contract shells 는 normal selector 호출 자체를 skip ([arenaSessionNextCore.ts:48-101](../bty-app/src/lib/bty/arena/arenaSessionNextCore.ts#L48-L101)). servedIds query 는 실행되지만 결과 미사용 | 0 | shell 상태 → suppression 무관 (의도된 분기) |
| C | `arena_runs.status` DB default 미검증. 만약 default 가 `IN_PROGRESS` 가 아니면 P1 의 IN_PROGRESS branch 가 새 run 을 잡지 못할 수 있음 | low | **defer** — DB schema verification 별 inventory |
| D | `runIdParam` 이 `n/session` query 에서 accept 되지만 `arenaSessionNextCore` 안에서는 logging label 외 사용 흔적 없음 ([src/app/api/arena/n/session/route.ts:29-31](../bty-app/src/app/api/arena/n/session/route.ts#L29-L31)) | low | **defer** — dead param cleanup 후보 |

---

## Fix Scope 권고 — AL-1.9-E-P1.1-A

### Approach

Helper function 도입:

```ts
// 새 파일 (lib layer): fetchRecentServedScenarioIds.ts
export async function fetchRecentServedScenarioIds(
  supabase: SupabaseClient,
  userId: string,
  windowHours: number = 24,
): Promise<string[]>
```

(arenaSessionNextCore.ts:103-109 의 query 를 helper 로 추출 → 모든 router caller 가 동일 source 사용)

### Caller updates

| Caller | Update | Risk |
|---|---|---|
| `arenaSessionNextCore.ts:103-109` | inline query → helper 로 교체 | covered (suppression axis, P1 fix 영역). P1.1-A 에서 helper extraction refactor 대상 (refactor axis) |
| `post-session-router.ts:84` | options 에 `servedArenaScenarioIds: await helper()` 추가 | low |
| `foundry-arena-return.ts:156` | options 에 `servedArenaScenarioIds: await helper()` 추가 | low |
| `recovery-loop-router.ts:145` (scenario_retry) | **포함** — options 에 `servedArenaScenarioIds: await helper()` 추가 (per [AL-1.9-E-P1.3-inventory.md](AL-1.9-E-P1.3-inventory.md), `scenario_retry` = different_scenario_required) | low |

### Suppression coverage axis (P1 fix scope)

3 router caller 에 `servedArenaScenarioIds` 전달 추가:
- `post-session-router.ts:84`
- `foundry-arena-return.ts:156`
- `recovery-loop-router.ts:145`

근거: [AL-1.9-E-P1.3-inventory.md](AL-1.9-E-P1.3-inventory.md) — `scenario_retry` = different_scenario_required

### Helper unification axis (refactor scope, P1.1-A 통합)

4 caller helper 호출 통일:
- 위 3 caller
- `arenaSessionNextCore.ts:103-109` (inline query → helper extraction)

근거: single point of update for future suppression rule changes

### Out of scope

- `quickModeService.ts:39` (router-bypass, 별 axis, 별 sprint)

### Mutation budget

- 1 new helper file (`src/lib/bty/arena/fetchRecentServedScenarioIds.ts` or 인접 위치)
- 2-3 caller edits (위 표 기준)
- Test 추가 (helper unit test + router caller integration test)

---

## Defer Items

| Item | Owner / Sprint |
|---|---|
| `recovery-loop-router.scenario_retry` semantics 확정 | **resolved** — see [AL-1.9-E-P1.3-inventory.md](AL-1.9-E-P1.3-inventory.md) (2026-05-06) |
| `quickModeService` router-bypass axis (selector 직접 호출) 처리 | 별 axis — Quick Mode 의 served suppression 정책 결정 후 |
| `arena_runs.status` DB default 검증 (Incidental C) | DB schema audit sprint |
| `runIdParam` cleanup (Incidental D) | 별 cleanup sprint (low priority) |

---

## Verify-then-Closure 결과

5 spot-check + P1.1 router caller claim re-verify 모두 일치. claim 불일치 0.

| Target | Verified |
|---|---|
| `arenaSessionNextCore.ts:103-109` (suppression query) | ✓ |
| `useArenaSession.ts:1888-2031` (continueNextScenario) | ✓ |
| `n/session/route.ts:12-44` (Pipeline N entry) | ✓ |
| `scenario-type-router.ts:111+131` (`getNextScenarioForSession` + `selectNextScenario` call) | ✓ — line 131 `selectNextScenario(userId, locale, { ...options, _debugOut })` 가 caller options 를 forward |
| `complete/route.ts:42-274` (DONE transition + RUN_COMPLETED_APPLIED) | ✓ |
| P1.1 router caller claims (4 + 1) | ✓ — 본 문서 P1.1 표 항목 별 line confirmation |

---

## References

- Predecessor: `docs/AL-1.9-E-P1-inventory.md` (P1 fix 영역)
- Engine spec: `docs/ENGINE_ARCHITECTURE_V1.md` §6.3 (Pipeline N), §6.6 (Pipeline L deprecated)
- Selector: `src/engine/scenario/scenario-selector.service.ts` (`selectNextScenario`, `SelectNextScenarioOptions.servedArenaScenarioIds`)
