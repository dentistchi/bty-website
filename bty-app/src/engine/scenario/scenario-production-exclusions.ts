/**
 * Scenarios that must never be served by Arena / production selection (E2E placeholders, synthetic smoke rows).
 */

export const E2E_SMOKE_SCENARIO_ID = "e2e_smoke_minimal" as const;

export const ARENA_EXCLUDED_SCENARIO_IDS = new Set<string>([E2E_SMOKE_SCENARIO_ID]);

export function isExcludedFromArenaProduction(
  scenarioId: string,
  scenarioType?: string | null,
): boolean {
  if (ARENA_EXCLUDED_SCENARIO_IDS.has(scenarioId)) return true;
  const t = scenarioType?.trim().toLowerCase();
  if (t === "smoke_synthetic") return true;
  return false;
}
