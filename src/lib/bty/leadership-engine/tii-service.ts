/**
 * Leadership Engine — TII service.
 * compute_team_tii(team_id) resolves inputs then applies domain computeTII.
 * Single source: docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md §4 P4, docs/LEADERSHIP_ENGINE_SPEC.md §6.
 *
 * Policy: only team score (TII result) is public; individual AIR never exposed.
 * Inputs are provided by caller/Infrastructure (e.g. from activation logs + team membership).
 */

import { computeTIIWithComponents, type TIIInputs, type TIIResult } from "@/domain/leadership-engine";

/**
 * Fetches team-level TII inputs for a given team.
 * Implemented by Infrastructure (DB: team membership, AIR/MWD/TSP aggregates).
 */
export type GetTeamTIIInputs = (teamId: string, weekStart?: string) => Promise<TIIInputs>;

/**
 * Computes Team Integrity Index for a team.
 * Uses provided getInputs to fetch team-level aggregates (avg AIR, avg MWD, TSP);
 * individual AIR is never returned.
 *
 * @param teamId - Team identifier (e.g. league_id or team table PK).
 * @param getInputs - Fetcher for team inputs (Infrastructure responsibility).
 * @param weekStart - Optional week boundary (e.g. "2026-03-10") for weekly snapshot.
 * @returns Public result: tii, avg_air, avg_mwd, tsp (team-level only).
 */
export async function compute_team_tii(
  teamId: string,
  getInputs: GetTeamTIIInputs,
  weekStart?: string
): Promise<TIIResult> {
  const inputs = await getInputs(teamId, weekStart);
  return computeTIIWithComponents(inputs);
}
