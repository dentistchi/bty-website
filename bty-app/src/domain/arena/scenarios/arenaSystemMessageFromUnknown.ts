/**
 * Parses `ResolveOutcome.systemMessage` from an unknown value (e.g. JSON).
 * Trimmed non-empty string bounded by `ARENA_SYSTEM_MESSAGE_MAX_LENGTH`.
 */

export const ARENA_SYSTEM_MESSAGE_MAX_LENGTH = 4096;

export function arenaSystemMessageFromUnknown(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (s.length > ARENA_SYSTEM_MESSAGE_MAX_LENGTH) return null;
  return s;
}
