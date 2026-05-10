# AL-2-E R3 — Area 0.1: Runtime Path Distribution Inventory

**Sprint**: AL-2-E R3 Phase 1 (Authority & Distribution Inventory)
**Mode**: read-only semantic inventory
**Inner HEAD**: `50317b8` · **Outer HEAD**: `4f19421` · **Worker**: `e9e179ed-38a7-40ae-8f97-13cfb09191b7`
**Authority cite**: memory #14 (multi-runtime path) + memory #15 (Path 2/3) + memory #17 (scenarioRegistry invariant)

## §1 Path 1 — Legacy Index DEFAULT (27 scenarios)

[E.R3.A0.1.1] source_of_truth_file: `bty-app/src/data/scenario/index.ts`
[E.R3.A0.1.2] export_const: `scenarioList` at lines 120–148
[E.R3.A0.1.3] enumeration_count: 27
[E.R3.A0.1.4] enumeration_full:
```
core_01_training_system_exposure
core_02_new_doctor_reexposure_compromise_loop
core_03_training_failure_hidden_as_performance_issue
core_04_manager_neutrality_as_abandonment
core_05_resignation_signal
core_06_external_exposure
core_07_repair_conversation
core_08_doctor_repair
core_09_identity_shift
core_10_integrity_favoritism_signal
core_11_selective_standard_escalation
core_12_silence_normalization
core_13_assistant_adaptation
core_14_manager_awareness_gap
core_15_system_exposure
core_16_repair_standard_reset
core_17_lead_assistant_repair
core_18_identity_integrity_choice
core_19_authority_signal
core_20_unquestioned_decision
core_21_silence_under_hierarchy
core_22_assistant_truth_block
core_23_manager_truth_block
core_24_external_truth_exposure
core_25_forced_repair_conversation
core_26_doctor_repair_choice
core_27_identity_repair_commitment
```

[E.R3.A0.1.5] import_sites:
- `bty-app/src/lib/bty/scenario/loader.ts:1` — server batch preload
- `bty-app/src/lib/bty/scenario/browserLoader.ts:1` — browser batch preload
- `bty-app/src/lib/bty/arena/eliteScenariosCanonical.server.ts:11` — elite binding lookup
- `bty-app/src/engine/scenario/scenario-selector.service.ts:11` — legacy selector
- `bty-app/src/app/[locale]/bty-arena/BtyArenaRunPageClient.tsx:40` — UI scenario picker
- `bty-app/src/app/[locale]/bty-arena/hooks/useArenaSession.ts:50` — legacy run loading
- `bty-app/src/app/api/arena/choice/route.ts:14` — choice handler
- `bty-app/src/app/api/arena/re-exposure/validate/route.ts:20` — re-exposure validate
- `bty-app/src/lib/bty/arena/scenarioPayloadFromDb.ts:9` — payload resolution

[E.R3.A0.1.6] routing_condition: legacy selector hit when user not in elite chain (id ∉ `ELITE_CHAIN_SCENARIO_IDS`); env override via `BTY_ARENA_VERTICAL_SLICE_ENTRY_SCENARIO_ID` at `scenario-selector.service.ts:22-28`; middleware redirect at `bty-app/src/middleware.ts:251` when `!isPostLoginOnboardingWizardEnabled()`

## §2 Path 2 — Chain Workspace Elite (3 scenarios)

[E.R3.A0.1.7] source_of_truth_file: `bty-app/src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts`
[E.R3.A0.1.8] export_const: `CHAIN_WORKSPACE_ELITE_IDS` at lines 28–32
[E.R3.A0.1.9] enumeration_count: 3
[E.R3.A0.1.10] enumeration_full:
```
core_01_training_system
core_06_lead_assistant
core_11_staffing_collapse
```
[E.R3.A0.1.11] data_source_files: `bty-app/src/data/bty_chain_workspace/Chains/Core_{01,06,11}_*/{S1_anchor,S2_consequence,S3_identity}.json` (3 chains × 3 stages = 9 files)
[E.R3.A0.1.12] import_sites:
- `eliteScenariosCanonical.server.ts:15` — name import
- `eliteScenariosCanonical.server.ts:65` — `buildEliteScenarioFromChainWorkspace(id)` mapped at module init
- `chainWorkspaceToEliteScenario.test.ts:4,9` — test validation

[E.R3.A0.1.13] routing_condition: post-login default = `ELITE_CANONICAL_ENTRY_SCENARIO_ID = core_01_training_system` (`bty-app/src/lib/bty/arena/postLoginEliteEntry.ts:14-20`); membership check via `isEliteChainScenarioId(id)` at `postLoginEliteEntry.ts:27-28`; validation at `eliteScenariosCanonical.server.ts:141-151`

## §3 Path 3 — OWN-RE-02-R1 Special (1 scenario)

[E.R3.A0.1.14] source_of_truth_file: `bty-app/src/lib/bty/arena/ownRe02R1EliteScenario.server.ts`
[E.R3.A0.1.15] sid_const: `SID = "OWN-RE-02-R1"` at line 8
[E.R3.A0.1.16] enumeration_count: 1
[E.R3.A0.1.17] enumeration_full: `OWN-RE-02-R1`
[E.R3.A0.1.18] data_source: inline TypeScript (no JSON import); full build `buildOwnRe02R1EliteScenario()` at lines 107-149
[E.R3.A0.1.19] import_sites:
- `eliteScenariosCanonical.server.ts:18` — function import
- `eliteScenariosCanonical.server.ts:71` — call at module init
- `eliteScenariosCanonical.server.ts:74` — append to canonical dataset

[E.R3.A0.1.20] routing_condition: included in `ELITE_CHAIN_SCENARIO_IDS` literal (`postLoginEliteEntry.ts:14-20`); strict enforcement at `arenaScenarioResolve.server.ts:13-45` rejects non-elite ids

## §4 Cross-path overlap matrix

[E.R3.A0.1.21] overlap_matrix:

| scenario_id | Path 1 | Path 2 | Path 3 | runtime entry |
|---|:---:|:---:|:---:|---|
| `core_01_training_system_exposure` (legacy) | ✓ | — | — | legacy selector |
| `core_01_training_system` (chain) | — | ✓ | — | elite entry default |
| `core_06_external_exposure` (legacy) | ✓ | — | — | legacy selector |
| `core_06_lead_assistant` (chain) | — | ✓ | — | elite (rotated) |
| `core_11_selective_standard_escalation` (legacy) | ✓ | — | — | legacy selector |
| `core_11_staffing_collapse` (chain) | — | ✓ | — | elite (rotated) |
| `core_02 / 04 / 05 / 07 / 08 / 09 / 10 / 12-27` (24 scenarios) | ✓ | — | — | legacy only |
| `OWN-RE-02-R1` | — | — | ✓ | elite (rotated) |

[E.R3.A0.1.22] string_level_overlap: 0 — no scenario_id string appears in two paths simultaneously
[E.R3.A0.1.23] semantic_overlap: 3 — `core_01 / core_06 / core_11` ordinals are bridged by `resolveCanonicalBindingForEliteId()` at `eliteScenariosCanonical.server.ts:196-236` (Path 2 ↔ Path 1 dbChoiceId reuse)
[E.R3.A0.1.24] union_count: **31 unique scenarios** (27 Path 1 + 3 Path 2 + 1 Path 3)
[E.R3.A0.1.25] elite_router_visible_count: 4 (Path 2: 3 chain + Path 3: 1 own_re)
[E.R3.A0.1.26] legacy_selector_visible_count: 27

## §5 Initialization & failure mode

[E.R3.A0.1.27] elite_dataset_build_assert: `assertChainEliteValidAtStartup()` at `eliteScenariosCanonical.server.ts:111-126` halts module load on Path 2 / Path 3 build failure
[E.R3.A0.1.28] elite_payload_no_legacy_leak_assert: `assertCanonicalEliteNoLegacyLeak()` at `eliteScenariosCanonical.server.ts:12` enforces no Path 1 legacy JSON markers leak into elite payload
[E.R3.A0.1.29] path1_init_validation: scenarioList loop at `bty-app/src/data/scenario/index.ts:415-438`; validation errors recorded in `scenarioValidationErrors` map, fallback to raw JSON if marshal fails (lines 367-375)
