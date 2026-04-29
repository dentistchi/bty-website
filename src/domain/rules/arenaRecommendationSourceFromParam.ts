/**
 * Dashboard summary `source` query param (arena|foundry|center).
 * Used by GET /api/arena/dashboard/summary; weekly/season unrelated.
 */

export const ARENA_DASHBOARD_SOURCE_VALUES = ["arena", "foundry", "center"] as const;
export type ArenaDashboardSourceParam =
  (typeof ARENA_DASHBOARD_SOURCE_VALUES)[number] | null;

export function arenaRecommendationSourceFromParam(
  param: string | null | undefined,
): ArenaDashboardSourceParam {
  if (param == null || typeof param !== "string") return null;
  const s = param.trim().toLowerCase();
  if (s === "arena" || s === "foundry" || s === "center") return s;
  return null;
}
