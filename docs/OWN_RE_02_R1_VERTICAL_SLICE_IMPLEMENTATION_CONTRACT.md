# OWN-RE-02-R1 — Live Vertical Slice (Implementation Contract)

**Doc role:** C2 lock — single handoff for C3/C4/C5. **Not** philosophy; **contracts, gaps, and verification**.

**Canonical narrative example:** `OWN-RE-02-R1` (“성과 리뷰 왜곡 이슈”) as defined in `bty-app/docs/BTY Arena — 최종 3-Choice 시나리오 템플릿.md` (JSON block: `scenarioId` `core_ownership_01`, primary **A/B**, tradeoff under **A** as **X/Y**, `action_decision` **ACT/DEFER**).

---

## 1. Scope

| In scope | Out of scope (this doc) |
|----------|---------------------------|
| Binding-layer flow: Primary → Tradeoff → Action Decision → server snapshot + `arena_events` | Center healing UX beyond **FORCED_RESET_PENDING** routing rule |
| `POST /api/arena/choice` for `binding_phase`: `primary` \| `tradeoff` \| `action_decision` | Full rewrite of `GET /api/arena/n/session` merge logic (reference only) |
| Runtime snapshot types in `arenaRuntimeSnapshot.types.ts` | Validator 0.7 confidence (unrelated to AIR bands) |
| Action-contract **blocking** states that gate Arena (`ACTION_*`) | My Page UI layout details |

**Product chain (frozen wording):**

`Scenario` → `Primary` → `Tradeoff` → `Action Decision` → (`Action Required` **or** `Next Scenario Ready`) → `Action` (off–Arena surfaces) → `Re-exposure` → `Validation`

---

## 2. Canonical Flow (OWN-RE-02-R1 only)

All IDs below come from the template JSON for **branch A** (primary **A** → tradeoff **X/Y** → action decision **ACT/DEFER**).

| Step | User action | Client `binding_phase` | Server `arena_events.event_type` | `arena_events.step` | Notes |
|------|-------------|-------------------------|-----------------------------------|----------------------|--------|
| 1 | Load scenario / start run | — | — | — | Run created with `arena_runs.scenario_id` = **must match `db_scenario_id` for all POSTs** (see §7 gap). |
| 2 | Primary pick **A** | `primary` | `CHOICE_CONFIRMED` | **2** | XP via `evaluateChoice` (same as legacy `CHOICE_CONFIRMED`). |
| 3 | Tradeoff pick **Y** | `tradeoff` (or legacy `second`) | `BINDING_V1_SECOND` | **4** | XP **0**. Requires prior primary recorded; branch resolved via `arena_runs.meta` (`escalation_branch_key` / `primary_choice_id`) — **must verify** meta is set (today: typically `POST /api/arena/run/step` step 3 before tradeoff, or meta from prior flow). |
| 4a | Action Decision **ACT** | `action_decision` | `BINDING_V1_ACTION_DECISION` | **5** | XP **0**. Writes `meta.action_decision_choice_id`, `action_decision_recorded_at`. |
| 4b | Action Decision **DEFER** | `action_decision` | `BINDING_V1_ACTION_DECISION` | **5** | Same event shape; **product rule:** not neutral — must accrue **no_change** / avoidance signal (**must verify** — see §9). |

**Semantic locks (product):**

- **`ACTION_DECISION_ACTIVE`**: user is choosing whether to commit to real action (third meaningful choice) — **not** yet `ACTION_REQUIRED`.
- **`ACTION_REQUIRED`**: user **already committed**; action contract / QR / execution path is mandatory — **routes to My Page** action-contract surfaces, **not** Center.
- **`FORCED_RESET_PENDING`**: leadership-engine forced reset — **routes to Center**, not My Page contract flow.

---

## 3. Runtime State Contract

**Authoritative type:** `ArenaRuntimeStateId` in `src/lib/bty/arena/arenaRuntimeSnapshot.types.ts`.

| `runtime_state` | Meaning in slice | Typical gates (`next_allowed` / `choice_allowed` / `qr_allowed`) |
|-----------------|------------------|-------------------------------------------------------------------|
| `ARENA_SCENARIO_READY` | In-scenario play allowed | `true` / `true` / `false` (from `gatesForScenarioReady`) |
| `ACTION_DECISION_ACTIVE` | Third choice surface (ACT/DEFER) | `false` / `true` / `false` (`snapshotForActionDecisionActive`) |
| `ACTION_REQUIRED` | Contract execution required | `false` / `false` / `true` (blocked contract snapshot) |
| `ACTION_SUBMITTED` / `ACTION_AWAITING_VERIFICATION` | Contract pipeline | blocking |
| `NEXT_SCENARIO_READY` | May fetch next scenario / continue loop | `true` / `false` / `false` |
| `FORCED_RESET_PENDING` | Center path | all `false` |
| `REEXPOSURE_DUE` | Recall / re-exposure | all `false` |

**UI rule (code):** `snapshotAllowsArenaScenarioPlaySurface` — in-scenario UI only when not action-blocking and state is `ARENA_SCENARIO_READY` or `ACTION_DECISION_ACTIVE` (and not `FORCED_RESET_PENDING` / `REEXPOSURE_DUE` / `NEXT_SCENARIO_READY` for main play surface).

**Client rule (product):** Render from **server snapshot** (`runtime_state` + `gates`); **do not** infer step from local-only state for gating.

---

## 4. JSON Contract (OWN-RE-02-R1)

**Source of narrative structure:** `BTY Arena — 최종 3-Choice 시나리오 템플릿.md` — example `OWN-RE-02-R1` block.

**Required shape (conceptual):**

- `scenarioId` (JSON id): e.g. `core_ownership_01`
- `dbScenarioId`: `OWN-RE-02-R1`
- `choices[]`: primary options; each `choiceId` + `dbChoiceId` (`OWN-RE-02-R1_primary_A` …)
- `escalationBranches[primaryKey].escalation_text`
- `escalationBranches[primaryKey].second_choices[]`: `id`, `label`, `dbChoiceId` (`OWN-RE-02-R1_tradeoff_*`)
- `escalationBranches[primaryKey].action_decision.context` + `action_decision.choices[]` with `choiceId` ACT/DEFER and `dbChoiceId` (`OWN-RE-02-R1_action_*`)

**Elite engine alignment:** Server-side validation for binding uses **`eliteScenarioToScenario(getEliteScenarioById(db_scenario_id))`** for `choices` / `escalationBranches` / `action_decision` (`src/app/api/arena/choice/route.ts`).  
→ **Fixed in principle:** structure must exist on the **canonical EliteScenario** for the **`db_scenario_id` passed on the wire**.

**Gap (must implement / verify):** Template uses `dbScenarioId: "OWN-RE-02-R1"`, but `isEliteChainScenarioId` only allows `core_01_training_system`, `core_06_lead_assistant`, `core_11_staffing_collapse`. **`POST /api/arena/choice` returns `400` `binding_only_elite_chain_scenarios` if `db_scenario_id` is literally `OWN-RE-02-R1` unless code changes.**  
**Options for C3:** (a) add `OWN-RE-02-R1` to allowed binding IDs with same payload loader, or (b) keep `arena_runs.scenario_id` = e.g. `core_01_training_system` and treat OWN-RE-02-R1 as content alias in DB/JSON only — **pick one and update this doc + route**.

---

## 5. DB Contract (Supabase)

| Artifact | Requirement for slice |
|----------|-------------------------|
| `arena_runs` | Row for user: `run_id`, `scenario_id` **must equal** `db_scenario_id` on every `POST /api/arena/choice` (else `409` `db_scenario_mismatch`). |
| `arena_runs.meta` | For `tradeoff` / `action_decision`: server reads `escalation_branch_key` or `primary_choice_id`; for `action_decision`: requires `second_choice_id` in meta (`409` `action_decision_requires_tradeoff_meta` if missing). **Must verify:** how meta is populated for elite binding-only path (often `POST /api/arena/run/step` step 3/4 vs binding-only). |
| `arena_events` | Rows as in §2; `meta.binding` = `v1`, `binding_phase` recorded. |
| `scenarios` (catalog) | If production uses DB mirror: row must exist for active `scenario_id` in router; **elite canonical** is chain-projected — align with §4 gap. |
| Pattern / no_change | **No dedicated `pattern_shift_results` persistence** — accrual of DEFER as `no_change` risk is **not proven in `arena_events` alone** — **must verify** (engine hook vs new column/event). |

---

## 6. API Contract — `POST /api/arena/choice`

**Handler:** `src/app/api/arena/choice/route.ts`

### 6.1 Request (all phases)

| Field | Type | Required | Notes |
|-------|------|------------|--------|
| `run_id` | string (UUID) | yes | Must belong to authenticated user. |
| `json_scenario_id` | string | yes | e.g. template `core_ownership_01` or elite id used in JSON. |
| `db_scenario_id` | string | yes | Must match `arena_runs.scenario_id`; must pass `isEliteChainScenarioId` **today** (§4 gap). |
| `json_choice_id` | string | yes | Primary: matches `ScenarioChoice.choiceId`; tradeoff: matches `second_choices[].id`; action_decision: matches `action_decision.choices[].choiceId`. |
| `db_choice_id` | string | yes | Must match bound row’s `dbChoiceId` for validation branch. |
| `binding_phase` | string | yes | `"primary"` \| `"tradeoff"` \| `"second"` (→ tradeoff) \| `"action_decision"` |

### 6.2 Response (canonical)

**200:** JSON = **`ArenaBindingRuntimeSnapshot`** (`ArenaSessionRouterSnapshot` + optional `run_id`, `scenario`, `trigger`, `pattern`, `re_exposure`).

**Core fields:** `mode`, `runtime_state`, `state_priority`, `gates`, `action_contract`.

**Errors (non-exhaustive):** `400` `missing_fields` \| `primary_choice_binding_mismatch` \| `second_choice_binding_mismatch` \| `action_decision_binding_mismatch` \| `binding_only_elite_chain_scenarios` \| `scenario_catalog_unavailable` — `404` `run_not_found_or_forbidden` — `409` `db_scenario_mismatch` \| `action_decision_requires_tradeoff_meta` — `500` event/xp/meta failures.

### 6.3 Phase → typical `runtime_state` (after `buildArenaBindingSnapshotResponse`)

| Phase | Condition | `runtime_state` (as implemented) |
|-------|-------------|-----------------------------------|
| `primary` | success | `ARENA_SCENARIO_READY` |
| `tradeoff` | branch has `action_decision.choices` | `ACTION_DECISION_ACTIVE` |
| `tradeoff` | no action_decision, **no** blocking contract | `ARENA_SCENARIO_READY` |
| `tradeoff` | no action_decision, **has** blocking contract | `ACTION_REQUIRED` / `ACTION_SUBMITTED` / `ACTION_AWAITING_VERIFICATION` (from contract row) |
| `action_decision` | blocking contract exists | contract-derived state |
| `action_decision` | no blocking contract | `ARENA_SCENARIO_READY` |

**Product vs code (must verify):** Binding spec v3 describes DEFER → `NEXT_SCENARIO_READY` + no_change risk; **current** `buildArenaBindingSnapshotResponse` after `action_decision` without blocking returns **`ARENA_SCENARIO_READY`**, not `NEXT_SCENARIO_READY`. Align product QA or adjust `buildArenaBindingSnapshotResponse` for ACT vs DEFER.

**Binding response extras:** `trigger` / `pattern` are **null** in `buildArenaBindingSnapshotResponse` (`bindingExtras`). `re_exposure`: `{ due: false, scenario_id: null }` — **not** live for slice unless extended.

---

## 7. Action Contract Transition Rules

| From | To | Mechanism |
|------|-----|-----------|
| `ACTION_DECISION_ACTIVE` | `ACTION_*` | `fetchBlockingArenaContractForSession` finds open pipeline contract → `runtimeStateFromBlockingContract` |
| In-scenario | `ACTION_REQUIRED` | Contract row exists with blocking status (see `blockingArenaActionContract.ts`) |
| Execution | My Page | **Product rule:** ACTION_* routes to **My Page** contract/QR flows — **not** Center |
| Forced reset | Center | `FORCED_RESET_PENDING` from session router / LE — **not** action-contract UI |

**Arena page:** No standalone action-contract editor (per Elite V2 handoff); slice still uses **blocking** states for “must complete contract before next Arena play.”

---

## 8. Re-exposure / Validation Closure

| Topic | Status |
|-------|--------|
| `REEXPOSURE_DUE` on GET session | Implemented type + snapshot helper; **binding POST** does not set real `re_exposure` payload |
| Delayed outcome / recall queue | **Must verify** against `arenaSessionNextCore` + DB for slice |
| Pattern Shift validation | Domain `patternShift.ts` exists; **persistence/API** for re-exposure results **pending** |
| DEFER → `no_change` accrual | **Must implement or verify** — not automatic from `BINDING_V1_ACTION_DECISION` alone in reviewed code |

---

## 9. Forbidden Transitional Behaviors

1. **Inferring** `runtime_state` or gates from **localStorage step** alone without merging server snapshot (`useArenaSession` must treat POST response as authority where wired).
2. **Sending** `db_scenario_id` that does not match `arena_runs.scenario_id` (409).
3. **Skipping** `binding_phase` order (e.g. `action_decision` without `second_choice_id` in meta → 409).
4. **Routing** `ACTION_REQUIRED` / contract execution to **Center** (product violation).
5. **Routing** `FORCED_RESET_PENDING` to **My Page** contract flow (product violation).
6. **Treating** action-decision **DEFER** as a neutral “continue” without **no_change** / avoidance accounting — **forbidden** by product; **must verify** enforcement.
7. **Random fallback** scenario or partial play when binding errors (per Binding Layer spec).
8. **Assuming** `OWN-RE-02-R1` works on wire **without** resolving §4 allowlist gap.

---

## 10. Implementation Checklist (by role)

### C3 — Domain / API / DB

| # | Task | Status |
|---|------|--------|
| C3-1 | Resolve **§4 gap**: allow `db_scenario_id` `OWN-RE-02-R1` **or** map slice to `core_01_*` with stable id strategy | **must implement** |
| C3-2 | Ensure `arena_runs.meta` has `escalation_branch_key` / `second_choice_id` before tradeoff/action_decision POSTs | **must verify** |
| C3-3 | Align `buildArenaBindingSnapshotResponse` **ACT vs DEFER** with product (`NEXT_SCENARIO_READY` + no_change signal) | **must verify** |
| C3-4 | Wire DEFER (or ACT) to pattern / no_change accrual per product | **must verify** |
| C3-5 | `arena_events` + XP sync parity for primary (`increment_arena_xp`) | **implemented** in `choice/route.ts` |

### C4 — UI

| # | Task | Status |
|---|------|--------|
| C4-1 | Render gating from **`runtime_state` + `gates`** after binding POST merge | **must verify** (partial in `useArenaSession`) |
| C4-2 | OWN-RE-02-R1 copy: Primary → Tradeoff → Action Decision surfaces per JSON | **must implement** |
| C4-3 | Do not show Center for ACTION_*; route per product to My Page | **must verify** |
| C4-4 | FORCED_RESET → Center entry | **must verify** (router/session) |

### C5 — Integration

| # | Task | Status |
|---|------|--------|
| C5-1 | E2E or manual: full OWN-RE-02-R1 path with three POST phases + snapshot assertions | **must verify** |
| C5-2 | Vitest/route tests for `binding_phase` errors and snapshot shape | **partial** (extend for slice) |
| C5-3 | Document release gate if auth/session/router touched | if applicable |

---

## 11. File map (reference)

| File | Role |
|------|------|
| `src/app/api/arena/choice/route.ts` | POST contract, events, meta update |
| `src/lib/bty/arena/binding/buildArenaBindingSnapshotResponse.server.ts` | Snapshot after each phase |
| `src/lib/bty/arena/arenaRuntimeSnapshot.types.ts` | `ArenaRuntimeStateId`, `ArenaBindingRuntimeSnapshot` |
| `src/lib/bty/arena/arenaRuntimeSnapshot.server.ts` | Snapshot builders / gates |
| `src/lib/bty/arena/postLoginEliteEntry.ts` | `ELITE_CHAIN_SCENARIO_IDS` — **blocker for literal OWN-RE-02-R1** |
| `src/app/[locale]/bty-arena/hooks/useArenaSession.ts` | Client merge with binding snapshot |
| `docs/BTY Arena — 최종 3-Choice 시나리오 템플릿.md` | OWN-RE-02-R1 JSON example |

---

**End of contract.** Update this file when §4 gap is resolved or snapshot semantics for DEFER are finalized.
