import type { ArenaDifficultyLevel } from "./types";

/**
 * Optional field: `undefined` if key absent; `null` if present but invalid.
 */
export function arenaDifficultyLevelFromUnknown(raw: unknown): ArenaDifficultyLevel | null | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  if (raw < 1 || raw > 5) return null;
  return raw as ArenaDifficultyLevel;
}
