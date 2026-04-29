/**
 * ## Elite runtime identity (single source of truth)
 *
 * - **`arena_runs.scenario_id`**, binding **`db_scenario_id`**, and session-router **`scenario.scenarioId`**
 *   for the OWN-RE vertical slice use the **literal string** {@link VERTICAL_SLICE_CANONICAL_SCENARIO_ID}.
 * - There is **no** hidden mapping from `OWN-RE-02-R1` → `core_*` in runtime loaders.
 * - Post-login **fresh entry** defaults to {@link ELITE_CANONICAL_ENTRY_SCENARIO_ID} (`core_01_training_system`).
 *   Set **`BTY_ARENA_VERTICAL_SLICE_ENTRY_SCENARIO_ID=OWN-RE-02-R1`** (proof/staging) to pin fresh entry to the slice id — see {@link selectNextScenario} in `scenario-selector.service.ts`.
 *
 * @see ELITE_CANONICAL_RUNTIME_SCENARIO_IDS — all ids accepted by {@link isEliteCanonicalRuntimeScenarioId}
 */

import {
  ELITE_CANONICAL_ENTRY_SCENARIO_ID,
  ELITE_CHAIN_SCENARIO_IDS,
  isEliteChainScenarioId,
} from "@/lib/bty/arena/postLoginEliteEntry";

/** Proof scenario for OWN-RE-02-R1 vertical slice — same string everywhere (DB, JSON, binding). */
export const VERTICAL_SLICE_CANONICAL_SCENARIO_ID = "OWN-RE-02-R1" as const;

export { ELITE_CANONICAL_ENTRY_SCENARIO_ID, ELITE_CHAIN_SCENARIO_IDS };

/** Alias: “chain” in the old name meant chain-workspace-only; runtime includes slice ids. */
export const ELITE_CANONICAL_RUNTIME_SCENARIO_IDS = ELITE_CHAIN_SCENARIO_IDS;

export function isEliteCanonicalRuntimeScenarioId(id: string): boolean {
  return isEliteChainScenarioId(id);
}
