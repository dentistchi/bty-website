import { arenaMissionOutcomeKeyPartsFromUnknown } from "./arenaMissionOutcomeKey";
import { arenaResolveOutcomeFromUnknown } from "./arenaResolveOutcomeFromUnknown";
import type { ResolveOutcome } from "./types";

/**
 * Parses `ArenaScenario.outcomes` from an untrusted object (e.g. JSON).
 * - Plain object only (not array / null). **At least one** entry.
 * - At most `ARENA_SCENARIO_OUTCOMES_MAX_KEYS` entries.
 * - Each key must be a valid mission outcome key (`primary_reinforcement` per `arenaMissionOutcomeKeyPartsFromUnknown`); entries are stored under the **canonical** key `${primaryId}_${reinforcementId}`.
 * - Duplicate canonical keys (e.g. `"A_X"` vs `" A_X"`) → null.
 * - Each value must parse via `arenaResolveOutcomeFromUnknown`.
 */

export const ARENA_SCENARIO_OUTCOMES_MAX_KEYS = 32;

export function arenaScenarioOutcomesFromUnknown(
  value: unknown,
): Record<string, ResolveOutcome> | null {
  if (value == null || typeof value === "bigint" || typeof value === "symbol") return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0 || keys.length > ARENA_SCENARIO_OUTCOMES_MAX_KEYS) return null;

  const out: Record<string, ResolveOutcome> = {};
  for (const rawKey of keys) {
    const parts = arenaMissionOutcomeKeyPartsFromUnknown(rawKey);
    if (parts === null) return null;
    const canon = `${parts.primaryId}_${parts.reinforcementId}`;
    if (Object.hasOwn(out, canon)) return null;

    const resolved = arenaResolveOutcomeFromUnknown(o[rawKey]);
    if (resolved === null) return null;
    out[canon] = resolved;
  }
  return out;
}
