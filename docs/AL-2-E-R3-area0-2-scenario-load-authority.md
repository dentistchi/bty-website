# AL-2-E R3 — Area 0.2: Scenario Load Authority

**Sprint**: AL-2-E R3 Phase 1 (Authority & Distribution Inventory)
**Mode**: read-only semantic inventory

## §1 scenarioRegistry — internal organize layer

[E.R3.A0.2.1] declaration_file: `bty-app/src/data/scenario/index.ts`
[E.R3.A0.2.2] declaration_lines: 379–413 (`export const scenarioRegistry = { ... } as const`)
[E.R3.A0.2.3] organization: incident-scoped; 3 incidents × 9 scenarios per incident = 27
[E.R3.A0.2.4] incidents_enumerated:
- `incident_01_small_compromise_to_trust_repair` → core_01–core_09
- `incident_02_authority_integrity_breakdown` → core_01–core_09 (mapped to core_10–core_18)
- `incident_03_culture_adoption_toxic_environment_breakdown` → core_01–core_09 (mapped to core_19–core_27)

[E.R3.A0.2.5] sample_5_bindings:
| registry key | folder path | files |
|---|---|---|
| `incident_01.core_01` | `core_01_training_system_exposure/` | `{base, en, ko}.json` |
| `incident_01.core_03` | `core_03_training_failure_hidden_as_performance_issue/` | `{base, en, ko}.json` |
| `incident_02.core_01` (→core_10) | `core_10_integrity_favoritism_signal/` | `{base, en, ko}.json` |
| `incident_02.core_06` (→core_15) | `core_15_system_exposure/` | `{base, en, ko}.json` |
| `incident_03.core_09` (→core_27) | `core_27_identity_repair_commitment/` | `{base, en, ko}.json` |

[E.R3.A0.2.6] import_pattern: 81 static named imports (27 scenarios × 3 files: base + en + ko) at `index.ts:16-96`
[E.R3.A0.2.7] dynamic_import_count: 0 (all static)
[E.R3.A0.2.8] export_surface: `scenarioRegistry`, `scenarioList`, `getScenarioById`, `getScenarioByDbId`, `getIncident`, `getScenarioBundle`, `allScenarioBundles`, `scenarioById`, `scenarioIncidents`
[E.R3.A0.2.9] memory17_invariant_status: **PRESERVED** — scenarioRegistry is internal organize layer, NOT a 4th runtime path; it serves Path 1 only

## §2 v2 JSON build artifact

[E.R3.A0.2.10] v2_artifact_path: `bty-app/src/data/bty_elite_scenarios_v2.json`
[E.R3.A0.2.11] non_v2_mirror: `bty-app/src/data/bty_elite_scenarios.json`
[E.R3.A0.2.12] build_script: `bty-app/scripts/sync-elite-from-chain-workspace.ts:1-29`
[E.R3.A0.2.13] npm_invocation: `npm run sync:elite-from-chain` (defined in `package.json`)
[E.R3.A0.2.14] runtime_import_count: **0** — no `import` / `require` of `bty_elite_scenarios_v2.json` exists in `src/`
[E.R3.A0.2.15] runtime_authority_status: **NOT used at runtime** (build artifact only)
[E.R3.A0.2.16] documentation_references (comments only):
- `chainWorkspaceToEliteScenario.server.ts:5` — "Target shape: same contract as `bty_elite_scenarios_v2.json`"
- `eliteScenariosCanonical.server.ts:5` — "Runtime narrative never comes from `bty_elite_scenarios_v2.json` (build/sync artifact)"

[E.R3.A0.2.17] memory14_invariant_status: **CONFIRMED** — v2 JSON exclusion holds; runtime computes via in-memory `buildEliteScenarioFromChainWorkspace()` + `buildOwnRe02R1EliteScenario()`

## §3 Loader code path summary

[E.R3.A0.2.18] loader_sites_table:

| file:line | import | path served | mechanism |
|---|---|---|---|
| `bty-app/src/data/scenario/index.ts:16-96` | static (81 JSON triplets) | Path 1 | Webpack bundle at build |
| `bty-app/src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts:11-20` | static (chainSourceIndex + 9 chain JSONs) | Path 2 | Webpack bundle at build |
| `bty-app/src/lib/bty/arena/ownRe02R1EliteScenario.server.ts` (entire file) | none (inline TS) | Path 3 | function definition |
| `bty-app/src/lib/bty/arena/eliteScenariosCanonical.server.ts:11` | `getScenarioById` (from index) | Path 1 binding for Path 2/3 | function call |
| `bty-app/src/engine/scenario/scenario-selector.service.ts:11` | `getScenarioById` (from index) | Path 1 | function call |

[E.R3.A0.2.19] dynamic_import_count_total: 0
[E.R3.A0.2.20] static_import_total: ~90 scenario file imports across the codebase

## §4 Loader chain reconstruction — concrete examples

[E.R3.A0.2.21] example_1_core_03_resolve_chain:
1. caller: `scenario-selector.service.ts:131` → `selectNextScenario(...)`
2. import: `scenario-selector.service.ts:11` `import { getScenarioById } from "@/data/scenario"`
3. lookup: `index.ts:467-472` `getScenarioById("core_03_training_failure_hidden_as_performance_issue", "en")`
4. resolve: `scenarioIdToNode.get(...)` ?? `folderIdToNode.get(...)`; populated at `index.ts:425-428`
5. file source: `core_03_training_failure_hidden_as_performance_issue/{base,en,ko}.json`
6. final: `mergeRuntimeScenario(node, "en")` → RuntimeScenario delivered via Path 1

[E.R3.A0.2.22] example_2_core_01_chain_resolve_chain:
1. caller: module init at `eliteScenariosCanonical.server.ts:126` → `assertChainEliteValidAtStartup()`
2. build canonical dataset: `eliteScenariosCanonical.server.ts:64-79` maps `CHAIN_WORKSPACE_ELITE_IDS`
3. project: `chainWorkspaceToEliteScenario.server.ts buildEliteScenarioFromChainWorkspace("core_01_training_system")`
4. read static imports: `s1_01`, `s2_01`, `s3_01` (lines 12-14)
5. binding: `eliteScenariosCanonical.server.ts:196-236` extracts `core_01_*` ordinal → calls `getScenarioById("core_01_training_system_exposure", "en")` (Path 1) → reuses dbChoiceId maps
6. final: EliteScenario with chain narrative + Path 1 db binding

## §5 Path mechanism comparison

[E.R3.A0.2.23] path_mechanism_matrix:

| aspect | Path 1 (Static Index) | Path 2 (Chain Workspace) | Path 3 (Inline) |
|---|---|---|---|
| load timing | module init (`index.ts:379-413`) | module init (`eliteScenariosCanonical.server.ts:126`) | module init (same) |
| JSON source | `core_NN_*/{base,en,ko}.json` (81 files) | `bty_chain_workspace/Chains/Core_NN_*/{S1,S2,S3}.json` (9 files) | none (TS inline) |
| coverage | 27 scenarios | 3 (whitelisted) | 1 (special-case) |
| access control | implicit (always loaded) | explicit whitelist (`CHAIN_WORKSPACE_ELITE_IDS`) | explicit registration |
| runtime caller | `getScenarioById(id)` | `buildEliteScenarioFromChainWorkspace(id)` | `buildOwnRe02R1EliteScenario()` |
| narrative origin | base + locale JSON | synthesized from S1+S2+S3 chain JSONs | hard-coded inline |
| dbChoice binding | author-time JSON | runtime lookup from Path 1 registry | hard-coded (lines 23, 32, 45, ...) |
| v2 JSON sync | n/a | `npm run sync:elite-from-chain` | n/a |
| import style | static | static | none (function) |
