/**
 * Pure parse/normalize for sessionStorage mission JSON (Play → Resolve).
 * No `window` / sessionStorage — used by `readMissionPayload`.
 */

export type NormalizedArenaMissionPayload = {
  scenarioId: string;
  selectedPrimaryId: string;
  selectedReinforcementId: string;
  decidedAt: string;
};

/**
 * Accepts a value typically from `JSON.parse`. Returns null if required choice ids are missing or not strings.
 * `decidedAt` defaults to "" when absent or non-string (legacy payloads).
 */
export function normalizeArenaMissionPayloadFromUnknown(
  value: unknown,
): NormalizedArenaMissionPayload | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const scenarioId = o.scenarioId;
  const selectedPrimaryId = o.selectedPrimaryId;
  const selectedReinforcementId = o.selectedReinforcementId;
  if (
    typeof scenarioId !== "string" ||
    typeof selectedPrimaryId !== "string" ||
    typeof selectedReinforcementId !== "string"
  ) {
    return null;
  }
  const decidedAt = o.decidedAt;
  return {
    scenarioId,
    selectedPrimaryId,
    selectedReinforcementId,
    decidedAt: typeof decidedAt === "string" ? decidedAt : "",
  };
}
