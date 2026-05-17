# BTY Arena UI Authority Contract v1

**Framing.** This document exists for **runtime authority preservation**. The UI is the
*subject*; the *protected target* is deterministic runtime authority. The contract is a
**freeze of measured existing behavior** — it introduces **zero new semantics**. Every
claim cites a code coordinate corroborated by the UI Authority Clarification Lane STEP 0
(read-only corroboration) and STEP 0.1 (read-only behavioral characterization). Nothing
here changes runtime code, hooks, routes, snapshot precedence, or queue semantics.

Repo baseline at authoring: outer `da9600c` / inner `35cba550`.

---

## §1 Authority Map

**The server is the sole runtime authority owner.** All 9 `ArenaRuntimeStateId` values
(`bty-app/src/lib/bty/arena/arenaRuntimeSnapshot.types.ts:9-23`) are server-derived from
the database — `bty_action_contracts`, `leadership_engine_state`, `arena_pending_outcomes`.
No runtime state is authored by the client.

The 9 states: `ACTION_REQUIRED`, `ACTION_SUBMITTED`, `ACTION_AWAITING_VERIFICATION`,
`ARENA_SCENARIO_READY`, `TRADEOFF_ACTIVE`, `ACTION_DECISION_ACTIVE`,
`NEXT_SCENARIO_READY`, `FORCED_RESET_PENDING`, `REEXPOSURE_DUE`.

### §1.1 Shell-gate decision sites (measured)

| Runtime state | Server decision site |
|---|---|
| REEXPOSURE_DUE | `arenaSessionNextCore.ts:133-140` (`fetchFirstDueNoChangeReexposureMeta`) |
| ACTION_REQUIRED | `arenaSessionNextCore.ts:39-66` + `arenaRuntimeSnapshot.server.ts:36-41` |
| ACTION_SUBMITTED | `arenaRuntimeSnapshot.server.ts:39` (`runtimeStateFromBlockingContract`) |
| ACTION_AWAITING_VERIFICATION | `arenaRuntimeSnapshot.server.ts:38` |
| FORCED_RESET_PENDING | `arenaSessionNextCore.ts:84-96` (`getLeadershipEngineState`) |
| NEXT_SCENARIO_READY | `arenaSessionNextCore.ts:107-115`; POST `run/complete` `route.ts:135,260` |
| ARENA_SCENARIO_READY | `arenaSessionNextCore.ts:140` (default when no re-exposure) |
| TRADEOFF_ACTIVE | `buildArenaBindingSnapshotResponse.server.ts:61-68` |
| ACTION_DECISION_ACTIVE | `buildArenaBindingSnapshotResponse.server.ts:71-79,99-146` |

### §1.2 Snapshot precedence

Server entry-shell states deterministically override any client snapshot (see §5). One
**explicit server override site** is recorded: `enforceActionRequiredContractInvariant`
(`bty-app/src/app/api/arena/choice/route.ts:21-44`) forces `runtime_state: "ERROR"` with
locked gates if an `ACTION_REQUIRED` snapshot lacks a backing contract row. For other
states precedence is enforced implicitly via `gates.{choice,next,qr}_allowed`
(`gatesForReexposureDue()` `arenaRuntimeSnapshot.server.ts:91-92` → all gates `false`)
and `statePriorityForRuntime` (`arenaRuntimeSnapshot.server.ts:11-34`).

---

## §2 Surface Taxonomy

| Surface | Authority source |
|---|---|
| Arena interactive (play) | server-derived — gated by `effectiveArenaSnapshot.gates` / `arenaPlaySurfaceAllowed` |
| Blocked | render-only from snapshot authority — `ArenaBlockedSurface.tsx:65-104` ("render-only blocked surface from snapshot authority — no local step logic") |
| Re-exposure | server-derived — exclusive gate (`gatesForReexposureDue()` all-false; §3) |
| Center recovery | server-derived, isolated — `ejection-recovery-router.ts`, zero runtime-snapshot imports |
| Foundry mentor | server-derived (program state); see §3 measured gap |
| Leaderboard | render-only, isolated — `leaderboardService.ts` / `api/arena/leaderboard/route.ts` depend only on `weekly_xp` + profiles; zero `ArenaRuntimeStateId` imports; no `runtime_state` field |

---

## §3 Precedence Matrix

| Rule | Status | Measured evidence |
|---|---|---|
| Blocked beats local progression | **IMPLEMENTED** | `arenaBindingReducer.ts:54-60` (`choice_allowed:false` → `uiStep:"blocked"`); `ArenaBlockedSurface.tsx:65-104`; test `BtyArenaRunPageClient.snapshot-gates.test.tsx:229-246` |
| Re-exposure is exclusive | **IMPLEMENTED** | `gatesForReexposureDue()` all-false (`arenaRuntimeSnapshot.server.ts:91-92`); `statePriorityForRuntime` REEXPOSURE_DUE=55 (`:21`); `snapshotQualifiesAsReexposureGate` (`arenaSessionRouterClient.ts:76-88`); concurrency test (`snapshot-gates.test.tsx:248-272`) |
| Center overrides Arena | **IMPLEMENTED** | `middleware.ts:364-381` — `userHasForcedResetPending` redirects `/bty-arena/*` + `/bty/foundry/*` to `/center` |
| Foundry cannot self-authorize progression | ⚠️ **NOT IMPLEMENTED** | `api/bty/foundry/program-progress/route.ts:74-78` + `program-completion.service.ts:121-180` accept `action:"select"` with no Arena/Center prerequisite check |

⚠️ **Measured gap — Foundry self-authorization.** "Foundry cannot self-authorize
progression" is **not implemented** in code. This contract **records** the gap; it does
**not close it**. Closing the gap is a runtime-behavior change outside this
documentation lane and belongs to a separate lane.

---

## §4 Queue Ownership Model

The STEP 0 dispatch's 5-queue premise was corrected by measurement. There are **2 real
queues**, both server-authoritative; the other 3 named items are not queues.

### §4.1 Real queues (2)

| Queue | Authority | Site |
|---|---|---|
| Action-required queue | **SERVER / DB-authoritative** — `bty_action_contracts` `status='pending'` | `bty-app/src/lib/bty/arena/blockingArenaActionContract.ts:17-41` (`fetchBlockingArenaContractForSession`) |
| Re-exposure queue | **SERVER / DB-authoritative** — `arena_pending_outcomes` + `user_memory_trigger_queue` | `bty-app/src/lib/bty/arena/delayed-outcome-trigger.service.ts:652-705` (`fetchFirstDueNoChangeReexposureMeta`) |

### §4.2 Not queues (3) — clarification

- **Runtime "queue"** — no persistent structure; per-request derivation from DB
  (`arenaSessionNextCore.ts:39-140`).
- **Recovery "queue"** — no named queue; cron/interval consumption.
- **Leaderboard "queue"** — no queue; read-time computation from the `weekly_xp` ledger.

---

## §5 Rendering Contract

### §5.1 Precedence invariant (freeze target)

This invariant is the **measured existing behavior** at
`bty-app/src/app/[locale]/bty-arena/hooks/useArenaSession.ts:1054-1067`. The contract
**freezes** it; it is not a change.

> Every server entry-shell runtime state — `ACTION_REQUIRED`, `ACTION_SUBMITTED`,
> `ACTION_AWAITING_VERIFICATION`, `FORCED_RESET_PENDING`, `REEXPOSURE_DUE`,
> `NEXT_SCENARIO_READY` — deterministically overrides any client binding/optimistic
> snapshot. Client optimistic precedence is admissible **only** in the non-entry-shell
> play states: `ARENA_SCENARIO_READY`, `TRADEOFF_ACTIVE`, `ACTION_DECISION_ACTIVE`.

Mechanism (measured): `serverShellPrioritySnapshot`
(`useArenaSession.ts:1054-1057`) selects the server snapshot for any
`isArenaServerEntryShellRuntimeState` value; `bindingSuppressedByExclusiveGate`
(`:1060-1063`) discards the client binding snapshot for any
`isArenaExclusiveGateRuntimeState` value or a pending contract. Set definitions:
`arenaRuntimeSnapshot.types.ts:105-137` — entry-shell set = action-blocking ∪
{FORCED_RESET_PENDING, REEXPOSURE_DUE, NEXT_SCENARIO_READY}; exclusive-gate set = the
entry-shell set minus `NEXT_SCENARIO_READY`.

### §5.2 R7 occurrence classification (frozen result)

STEP 0.1 behaviorally characterized the 6 client-side runtime-adjacent occurrences
flagged in STEP 0 R7. Result: **class A = 0, class F = 0.**

| # | Site | Class | Character |
|---|---|---|---|
| #1 | `useArenaSession.ts:1065-1067` `effectiveArenaSnapshot` | **B** | bounded optimistic UI — precedence resolver; binding window = non-entry-shell states only |
| #2 | `useArenaSession.ts:101-148` (applied `:1581-1588`) `deriveReexposureValidateLocalAssist` | **B** | bounded optimistic UI — `runtime_state` value sourced from the server validate response `j.next_runtime_state` (`:1568-1573`); returns `null` when a server shell is active |
| #3 | `useArenaSession.ts:1087-1139` `playUiSegment` | **C** | render-only view selector; runtime gating is separate (`arenaPlaySurfaceAllowed`, `gates.choice_allowed`) |
| #4 | `useArenaSession.ts:1613-1625` `hasActionDecision` | **B** | bounded optimistic UI — local `step`/`phase` advance from static scenario content; `submitActionDecision` server-gated (`:1637`) |
| #5 | `EliteActionDecisionStep.tsx:70` `meaning.is_action_commitment` | **C** | render-only styling (badge color/text + static trait list) |
| #6 | `useArenaSession.ts:1685-1699` trait derivation | **C** | runtime non-contacting; see §6 |

**class A (true authority violation): 0.** No occurrence has the client decide a runtime
semantic without server override. Distribution: B×3 (#1/#2/#4 — bounded optimistic UI),
C×3 (#3/#5/#6 — render-only / non-contacting derivation).

This classification is the **measured existing behavior**; the contract freezes it and
does not change it.

---

## §6 Out-of-scope: Identity Signal Authority Review

Occurrence #6 — trait derivation at `useArenaSession.ts:1685-1699` — is recorded here so
it is **not silently absorbed** into the runtime rendering contract.

> Class C for runtime authority purposes. Out of scope for UI runtime authority.
> Requires separate Identity Signal Authority Review because client-computed trait
> weight is persisted through `/api/bty/arena/signals` without recomputation.

This is **not a runtime authority violation** and **not a rendering-contract blocker**.
It is registered as a separate review lane target (the signals route
`bty-app/src/app/api/bty/arena/signals/route.ts` calls `saveArenaSignalWithSeed` with the
client-supplied `traits`/`meta`, persisting them without server recomputation). The
Identity Signal Authority Review is the owning lane.

---

*Authored by UI Authority Clarification Lane STEP 1 — documentation-level freeze of
measured behavior. Corroboration: STEP 0 REPORT (R1–R10), STEP 0.1 REPORT (R1–R4).*
