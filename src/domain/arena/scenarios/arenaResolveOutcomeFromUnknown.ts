import { arenaActivatedHiddenStatsFromUnknown } from "./arenaActivatedHiddenStatsFromUnknown";
import { arenaInterpretationLinesFromUnknown } from "./arenaInterpretationLinesFromUnknown";
import { arenaOutcomeMetaFromUnknown } from "./arenaOutcomeMetaFromUnknown";
import { arenaOutcomeTraitsPartialFromUnknown } from "./arenaOutcomeTraitsFromUnknown";
import { arenaSystemMessageFromUnknown } from "./arenaSystemMessageFromUnknown";
import type { ResolveOutcome } from "./types";

/**
 * Builds a `ResolveOutcome` from an untrusted object (e.g. JSON).
 * Required fields use the same rules as the per-field `*FromUnknown` helpers.
 * `traits` / `meta` are omitted when absent; when present they must parse or the whole result is null.
 */
export function arenaResolveOutcomeFromUnknown(value: unknown): ResolveOutcome | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;

  const interpretation = arenaInterpretationLinesFromUnknown(o.interpretation);
  if (interpretation === null || interpretation.length === 0) return null;

  const systemMessage = arenaSystemMessageFromUnknown(o.systemMessage);
  if (systemMessage === null) return null;

  const activatedStats = arenaActivatedHiddenStatsFromUnknown(o.activatedStats);
  if (activatedStats === null) return null;

  const out: ResolveOutcome = {
    interpretation,
    activatedStats,
    systemMessage,
  };

  if ("traits" in o) {
    const traits = arenaOutcomeTraitsPartialFromUnknown(o.traits);
    if (traits === null) return null;
    if (Object.keys(traits).length > 0) out.traits = traits;
  }

  if ("meta" in o && o.meta !== undefined) {
    const meta = arenaOutcomeMetaFromUnknown(o.meta);
    if (meta === null) return null;
    out.meta = meta;
  }

  return out;
}
