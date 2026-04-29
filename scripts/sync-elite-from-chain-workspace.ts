/**
 * Writes `src/data/bty_elite_scenarios_v2.json` rows for the three chain-synced scenarios
 * using {@link buildEliteScenarioFromChainWorkspace} — same projection as runtime.
 *
 * Run after editing chain workspace JSON: `npx tsx scripts/sync-elite-from-chain-workspace.ts`
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  buildEliteScenarioFromChainWorkspace,
  CHAIN_WORKSPACE_ELITE_IDS,
} from "../src/lib/bty/arena/chainWorkspaceToEliteScenario.server";

const root = process.cwd();
const target = path.join(root, "src/data/bty_elite_scenarios_v2.json");

function main(): void {
  const raw = JSON.parse(readFileSync(target, "utf8")) as { scenarios: Array<{ id: string }> };
  const built = new Map(
    CHAIN_WORKSPACE_ELITE_IDS.map((id) => [id, buildEliteScenarioFromChainWorkspace(id)]),
  );
  raw.scenarios = raw.scenarios.map((s) => built.get(s.id) ?? s);
  writeFileSync(target, JSON.stringify(raw, null, 2) + "\n");
  console.log("[sync-elite-from-chain] updated:", CHAIN_WORKSPACE_ELITE_IDS.join(", "));
}

main();
