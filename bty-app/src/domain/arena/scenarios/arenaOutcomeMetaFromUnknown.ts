import { arenaOutcomeTraitWeightFromUnknown } from "./arenaOutcomeTraitsFromUnknown";
import type { ArenaOutcomeMeta } from "./types";

/**
 * Parses `ResolveOutcome.meta` from an unknown value (e.g. JSON).
 * Requires **relationalBias**, **operationalBias**, **emotionalRegulation** — each a finite number, clamped to [0,1] like trait weights.
 * Unknown object keys are ignored.
 */
export function arenaOutcomeMetaFromUnknown(value: unknown): ArenaOutcomeMeta | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const relationalBias = arenaOutcomeTraitWeightFromUnknown(o.relationalBias);
  const operationalBias = arenaOutcomeTraitWeightFromUnknown(o.operationalBias);
  const emotionalRegulation = arenaOutcomeTraitWeightFromUnknown(o.emotionalRegulation);
  if (relationalBias === null || operationalBias === null || emotionalRegulation === null) return null;
  return { relationalBias, operationalBias, emotionalRegulation };
}
