/**
 * Parses `ArenaScenario.description` from an unknown value (e.g. JSON).
 * Accepts string arrays only: each element trimmed to non-empty, bounded per line and by count.
 * **At least one line** is required (lobby/play copy must exist).
 * Distinct caps from `arenaInterpretationLinesFromUnknown` (resolve copy).
 */

export const ARENA_SCENARIO_DESCRIPTION_MAX_LINES = 64;
export const ARENA_SCENARIO_DESCRIPTION_LINE_MAX_LENGTH = 4096;

export function arenaScenarioDescriptionLinesFromUnknown(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0 || value.length > ARENA_SCENARIO_DESCRIPTION_MAX_LINES) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const line = item.trim();
    if (!line) return null;
    if (line.length > ARENA_SCENARIO_DESCRIPTION_LINE_MAX_LENGTH) return null;
    out.push(line);
  }
  return out;
}
