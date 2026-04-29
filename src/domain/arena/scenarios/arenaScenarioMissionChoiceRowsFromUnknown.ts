import {
  arenaPrimaryChoiceFromUnknown,
  arenaReinforcementChoiceFromUnknown,
} from "./arenaMissionChoiceShapeFromUnknown";
import type { PrimaryChoice, ReinforcementChoice } from "./types";

const REQUIRED_PRIMARY_IDS: readonly string[] = ["A", "B", "C"];
const REQUIRED_REINFORCEMENT_IDS: readonly string[] = ["X", "Y"];

export type ArenaScenarioMissionChoiceRows = {
  primaryChoices: PrimaryChoice[];
  reinforcementChoices: ReinforcementChoice[];
};

/**
 * Parses `primaryChoices` for `ArenaScenario`: length **3**, no duplicate ids,
 * and ids cover **A·B·C** exactly (order preserved from JSON).
 */
export function arenaScenarioPrimaryChoicesRowFromUnknown(value: unknown): PrimaryChoice[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const out: PrimaryChoice[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const p = arenaPrimaryChoiceFromUnknown(item);
    if (p === null || seen.has(p.id)) return null;
    seen.add(p.id);
    out.push(p);
  }
  for (const id of REQUIRED_PRIMARY_IDS) {
    if (!seen.has(id)) return null;
  }
  return out;
}

/**
 * Parses `reinforcementChoices` for `ArenaScenario`: length **2**, no duplicate ids,
 * and ids cover **X·Y** exactly (order preserved from JSON).
 */
export function arenaScenarioReinforcementChoicesRowFromUnknown(
  value: unknown,
): ReinforcementChoice[] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const out: ReinforcementChoice[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const r = arenaReinforcementChoiceFromUnknown(item);
    if (r === null || seen.has(r.id)) return null;
    seen.add(r.id);
    out.push(r);
  }
  for (const id of REQUIRED_REINFORCEMENT_IDS) {
    if (!seen.has(id)) return null;
  }
  return out;
}

/**
 * Parses both mission choice arrays from an untrusted object (e.g. JSON fragment of `ArenaScenario`).
 * Requires **primaryChoices** and **reinforcementChoices** keys; each must satisfy the row rules above.
 * Root value must be a plain object; **`Symbol`**, **`bigint`**, arrays, and **`null`** → **`null`**.
 */
export function arenaScenarioMissionChoiceRowsFromUnknown(
  value: unknown,
): ArenaScenarioMissionChoiceRows | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const primaryChoices = arenaScenarioPrimaryChoicesRowFromUnknown(o.primaryChoices);
  const reinforcementChoices = arenaScenarioReinforcementChoicesRowFromUnknown(o.reinforcementChoices);
  if (primaryChoices === null || reinforcementChoices === null) return null;
  return { primaryChoices, reinforcementChoices };
}
