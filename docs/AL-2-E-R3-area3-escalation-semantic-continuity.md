# AL-2-E R3 — Area 3: Escalation Semantic Continuity

**Sprint**: AL-2-E R3 Phase 1
**Mode**: read-only

## §1 7-step canonical state machine

[E.R3.A3.1] canonical_7_step_definition (per memory #6):
```
1. Scenario
2. Primary Choice
3. Tradeoff (Escalation)
4. Action Decision
5. Action (QR/Contract)
6. Re-exposure
7. Behavior Change Validation
```

## §2 Server runtime state enum

[E.R3.A3.2] server_state_enum_file: `bty-app/src/lib/bty/arena/arenaRuntimeSnapshot.types.ts:9-23`
[E.R3.A3.3] server_state_enum_name: `ArenaRuntimeStateId`
[E.R3.A3.4] server_state_values_count: 9

[E.R3.A3.5] server_state_values:

| state | line | semantic |
|---|---:|---|
| `ACTION_REQUIRED` | 10 | Contract pending (user must complete QR/verification) |
| `ACTION_SUBMITTED` | 11 | Contract submitted, awaiting review |
| `ACTION_AWAITING_VERIFICATION` | 12 | Contract approved, verification in progress |
| `ARENA_SCENARIO_READY` | 13 | Scenario ready (primary choice available) |
| `TRADEOFF_ACTIVE` | 15 | Tradeoff (second choice) active after primary binding |
| `ACTION_DECISION_ACTIVE` | 17 | Action Decision tier active |
| `NEXT_SCENARIO_READY` | 19 | Post-run; next session fetch allowed |
| `FORCED_RESET_PENDING` | 21 | Leadership Engine Stage 4 forced reset blocking |
| `REEXPOSURE_DUE` | 23 | Delayed outcome (re-exposure/recall) queue non-empty |

## §3 Client runtime state enum

[E.R3.A3.6] client_state_enum_file: `bty-app/src/data/scenario/types.ts:102-108`
[E.R3.A3.7] client_state_enum_name: `RuntimeFlowState`
[E.R3.A3.8] client_state_values_count: 6

[E.R3.A3.9] client_state_values:

| state | line | mirrors server |
|---|---:|---|
| `SCENARIO_READY` | 103 | ARENA_SCENARIO_READY |
| `PRIMARY_CHOICE_ACTIVE` | 104 | (implicit; ARENA_SCENARIO_READY before binding) |
| `TRADEOFF_ACTIVE` | 105 | TRADEOFF_ACTIVE |
| `ACTION_DECISION_ACTIVE` | 106 | ACTION_DECISION_ACTIVE |
| `ACTION_REQUIRED` | 107 | ACTION_REQUIRED |
| `NEXT_SCENARIO_READY` | 108 | NEXT_SCENARIO_READY |

[E.R3.A3.10] client_state_alignment: client `RuntimeFlowState` is derived rendering state hydrated from server `ArenaRuntimeStateId`; types are aligned at the API boundary. Server has 3 additional states (ACTION_SUBMITTED / ACTION_AWAITING_VERIFICATION / FORCED_RESET_PENDING / REEXPOSURE_DUE — 4 total) that client does NOT directly enumerate (handled via different UI surfaces).

## §4 scenario JSON escalationBranches structure

[E.R3.A3.11] base_json_structure_field: `structure.primary[A-D] / structure.tradeoff[A-D].[X,Y] / structure.action_decision[A_X..D_Y].[AD1, AD2]`
[E.R3.A3.12] en_ko_escalationBranches_field: `escalationBranches[A-D].{escalation_text, second_choices[X,Y], action_decision: { prompt, choices: [AD1, AD2] }}`

[E.R3.A3.13] sample_scenario_audit (core_03 / core_04 / core_27):
- All 3 sampled have all 7 step JSON representations
- `incident.previousScenarioId` + `incident.nextScenarioId` provide state transition (Scenario → Scenario chain)
- `escalationBranches[*].action_decision.prompt = "Not interpretation — what will you do next?"` (consistent across samples)
- `escalationBranches[*].action_decision.choices[*].meaning.is_action_commitment` (boolean) distinguishes commitment vs deferral

## §5 7-step mapping table (full wiring)

[E.R3.A3.14] seven_step_mapping:

| step | scenario JSON field(s) | server runtime state | client jsonFlow.state | wiring code (file:line) |
|---|---|---|---|---|
| **1. Scenario** | `incident.stage`, `incident.axisGroup`, en/ko `title`, `pressure` | (context only — emitted as ARENA_SCENARIO_READY) | SCENARIO_READY | `bty-app/src/lib/bty/arena/arenaSessionNextCore.ts:116-118`, `:140` |
| **2. Primary Choice** | en/ko `choices[A-D]` + per-choice `pattern_family`, `direction`; base `structure.primary[].dbChoiceId` | ARENA_SCENARIO_READY | SCENARIO_READY (PRIMARY_CHOICE_ACTIVE implicit) | `bty-app/src/app/api/arena/choice/route.ts:481-498`; binding builder `bty-app/src/lib/bty/arena/binding/buildArenaBindingSnapshotResponse.server.ts:62` |
| **3. Tradeoff (Escalation)** | en/ko `escalationBranches[A-D].escalation_text` + `second_choices[X,Y]` | TRADEOFF_ACTIVE | TRADEOFF_ACTIVE | `route.ts:504-574`; snapshot builder `:72-79` |
| **4. Action Decision** | en/ko `escalationBranches[A-D].action_decision.choices[AD1, AD2]`; base `structure.action_decision[A_X..D_Y][].dbChoiceId` | ACTION_DECISION_ACTIVE | ACTION_DECISION_ACTIVE | `route.ts:576-711`; snapshot builder `:99-157` |
| **5. Action (QR/Contract)** | en/ko `action_decision.choices[*].meaning.is_action_commitment`; `action_contract` block | ACTION_REQUIRED → ACTION_SUBMITTED → ACTION_AWAITING_VERIFICATION | ACTION_REQUIRED (mirror) | `route.ts:713-756`; `bty-app/src/lib/bty/arena/blockingArenaActionContract.ts` |
| **6. Re-exposure** | base `incident.propagation.reExposureNote` (semantic metadata only); runtime trigger via accrual | REEXPOSURE_DUE | (mirror) | `route.ts:684-710, 843-879`; `bty-app/src/lib/bty/arena/noChangeRisk.server.ts:117` |
| **7. Behavior Change Validation** | en/ko `action_decision.choices[*].meaning.{is_action_commitment, direction, pattern_family}` | (consumed by validation engine) | NEXT_SCENARIO_READY (avoidance) or loop-back ACTION_REQUIRED (commitment awaiting verification) | `bty-app/src/app/api/arena/re-exposure/validate/route.ts:160-320`; `bty-app/src/lib/bty/arena/reexposureValidation.server.ts` |

## §6 State transition wiring details

[E.R3.A3.15] wiring_file_summary:
- **`bty-app/src/app/api/arena/choice/route.ts`** — POST handler for primary/tradeoff/action_decision binding (lines 481-756)
- **`bty-app/src/lib/bty/arena/arenaSessionNextCore.ts`** — GET handler for session state (lines 39-189)
- **`bty-app/src/lib/bty/arena/binding/buildArenaBindingSnapshotResponse.server.ts`** — phase-by-phase state emission (lines 62-157)
- **`bty-app/src/lib/bty/arena/noChangeRisk.server.ts`** — re-exposure accrual (line 117)
- **`bty-app/src/app/api/arena/re-exposure/validate/route.ts`** — validation handler (lines 160-320)

[E.R3.A3.16] state_emission_truth_table:

| phase | trigger | server state emitted |
|---|---|---|
| primary binding (after primary choice POST) | always | TRADEOFF_ACTIVE (snapshot:62) |
| tradeoff binding (with action_decision branch) | `tradeoffLeadsToActionDecision === true` | ACTION_DECISION_ACTIVE (snapshot:73) |
| tradeoff binding (legacy, no action_decision) | otherwise | ACTION_REQUIRED \| SCENARIO_READY (snapshot:81-96) |
| action_decision (avoidance) | `actionDecisionOutcome === "avoidance_wrap_up"` | NEXT_SCENARIO_READY (snapshot:101) |
| action_decision (commitment) | open contract row exists | ACTION_REQUIRED (snapshot:109-146) |
| action_decision (commitment, no contract) | `status: pending` absent | NEXT_SCENARIO_READY (snapshot:109-146) |
| session GET — blocking contract present | `bty_action_contracts.status = pending/submitted/approved` | ACTION_* per status (arenaSessionNextCore:39-73) |
| session GET — Stage 4 reset | `leadership_engine_state.currentStage === STAGE_4 && forcedResetTriggeredAt != null` | FORCED_RESET_PENDING (arenaSessionNextCore:84-95) |
| session GET — pending re-exposure | `fetchFirstDueNoChangeReexposureMeta(...)` non-null | REEXPOSURE_DUE (arenaSessionNextCore:129-189) |
| session GET — default | otherwise | ARENA_SCENARIO_READY (arenaSessionNextCore:140) |

## §7 24h hit scenario (core_04) trace

[E.R3.A3.17] core_04_signal: 1 row at 2026-05-09T13:58:26Z (T+9h41m post-AL-2-D-P0)
[E.R3.A3.18] core_04_user: ee9d2075-f4ae-4949-9392-38865c2cab22
[E.R3.A3.19] core_04_seven_step_wiring_check:

| step | wired? | evidence |
|---|:---:|---|
| 1. Scenario | ✓ | `incident.stage = 4`, `axisGroup = "Truth"`, title, pressure |
| 2. Primary Choice | ✓ | `choices[A-D]` (4 choices: stay neutral / name pattern / support privately / delegate) with `pattern_family`, `direction` |
| 3. Tradeoff | ✓ | `escalationBranches[A-D].escalation_text` + `second_choices[X,Y]` per branch |
| 4. Action Decision | ✓ | All 4 branches → `action_decision.choices[AD1,AD2]` with `is_action_commitment` boolean |
| 5. Action | ✓ | `action_contract` + `is_action_commitment` distinguishes commitment from deferral |
| 6. Re-exposure | ✓ | `incident.propagation.reExposureNote: "If the user exits here, the same silence will reappear..."` (metadata); runtime trigger via `noChangeRisk.server.ts:117` |
| 7. Validation | ✓ | `action_decision.meaning.{direction, pattern_family}` enables shift detection |

[E.R3.A3.20] core_04_completeness_score: **7/7 wired** — no fallbacks, no missing steps
[E.R3.A3.21] core_04_signal_progression_observed: 1 arena_signal write at T+9h41m did NOT (a) increment any user_pattern_signatures row, (b) trigger lock supersede, (c) emit pending_outcome → so signal stopped at primary-choice level OR was completed/avoidance-wrapped without triggering re-exposure threshold (axisTotal/riskCount < 2). Cannot pinpoint exact step from arena_signals alone (signal-level granularity).

## §8 Re-exposure gate (AL-1.8-D filter)

[E.R3.A3.22] al_1_8_d_filter_location: NOT a literally named filter; **implicit threshold check** at `bty-app/src/lib/bty/arena/noChangeRisk.server.ts:117`

[E.R3.A3.23] al_1_8_d_filter_logic:
```
const reExposureDueCandidate = axisTotal >= 2 || riskCount >= 2;
```
Where:
- `axisTotal` = sum of `risk_count` from `arena_no_change_risks` rows for current `(incident_id, axis_group)` tuple
- `riskCount` = incremented counter for current `(incident, axis, pattern_family, action_choice)` tuple

[E.R3.A3.24] al_1_8_d_purpose: prevents single-avoidance over-triggering re-exposure; only on cumulative ≥ 2 (per axis) OR ≥ 2 (per choice tuple) does state emit REEXPOSURE_DUE

[E.R3.A3.25] al_1_8_d_invocation: called inside `accrueNoChangeRisk()` from `route.ts:686-710` (during action_decision phase POST); pending_outcome creation at `route.ts:843-879`; consumption at `arenaSessionNextCore.ts:133-189`

## §9 Findings

[E.R3.A3.26] state_machine_completeness: full (9 server states / 6 client states / 7-step canonical = wired with no missing steps)
[E.R3.A3.27] json_runtime_alignment: tight — runtime is JSON-driven via `base.structure` and `escalationBranches` reads; no hardcoded transitions bypass JSON
[E.R3.A3.28] semantic_drift_count: **0** [SEMANTIC_DRIFT_DETECTED] in this Area
[E.R3.A3.29] phase2_deferred_count: 0
[E.R3.A3.30] outstanding_questions:
- Whether `reExposureNote` text in base.json is consumed at runtime or is purely audit metadata. Inspection: `noChangeRisk.server.ts` does NOT read `reExposureNote` text (uses cumulative risk math instead). reExposureNote is **author-facing semantic only**, not runtime input. <C5 inventory에서 확인> if Phase 2 audit requires confirmation of all reExposureNote consumers.
- Whether `incident.propagation.{exitEffect, entryEffect}` are consumed at runtime. Same status — likely audit-only metadata. <C5 inventory에서 확인>.
