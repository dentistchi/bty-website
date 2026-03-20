/**
 * Normalize optional string from Arena request body (e.g. levelId, scenarioId).
 * Display/reflection only — weekly rank / season unrelated.
 */

/**
 * Returns trimmed string or undefined for null, undefined, non-string, or blank.
 */
export function normalizeOptionalArenaBodyString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s === "" ? undefined : s;
}
