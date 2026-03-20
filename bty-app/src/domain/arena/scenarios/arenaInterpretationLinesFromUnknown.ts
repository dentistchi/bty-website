/**
 * Parses `ResolveOutcome.interpretation` from an unknown value (e.g. JSON).
 * Accepts only string arrays: each element must be a string; trimmed lines must be non-empty
 * and within `ARENA_INTERPRETATION_LINE_MAX_LENGTH`. At most `ARENA_INTERPRETATION_MAX_LINES` entries.
 */

export const ARENA_INTERPRETATION_MAX_LINES = 32;
export const ARENA_INTERPRETATION_LINE_MAX_LENGTH = 2048;

export function arenaInterpretationLinesFromUnknown(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > ARENA_INTERPRETATION_MAX_LINES) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const line = item.trim();
    if (!line) return null;
    if (line.length > ARENA_INTERPRETATION_LINE_MAX_LENGTH) return null;
    out.push(line);
  }
  return out;
}
