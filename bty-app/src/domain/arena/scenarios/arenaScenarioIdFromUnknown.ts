/**
 * Normalizes an Arena scenario id from an untrusted value (query, storage, JSON).
 * Trimmed non-empty string bounded by `ARENA_SCENARIO_ID_MAX_LENGTH`.
 * Non-strings (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */

export const ARENA_SCENARIO_ID_MAX_LENGTH = 128;

export function arenaScenarioIdFromUnknown(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.length > ARENA_SCENARIO_ID_MAX_LENGTH) return null;
  return s;
}
