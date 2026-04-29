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
 * Accepts a value typically from `JSON.parse`. Returns null if required choice ids are missing, not strings, or **empty after trim**.
 * `decidedAt` defaults to "" when absent or non-string (legacy payloads); string values are **trimmed** only (internal spaces kept).
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
  const sId = scenarioId.trim();
  const pId = selectedPrimaryId.trim();
  const rId = selectedReinforcementId.trim();
  if (sId === "" || pId === "" || rId === "") return null;
  const decidedAt = o.decidedAt;
  return {
    scenarioId: sId,
    selectedPrimaryId: pId,
    selectedReinforcementId: rId,
    decidedAt: typeof decidedAt === "string" ? decidedAt.trim() : "",
  };
}
