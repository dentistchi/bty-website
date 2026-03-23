/**
 * Leadership Engine — TII calculator: team AIR/MWD/TSP → TII, persist to `team_integrity_index`.
 * Domain formula: `computeTIIWithComponents` (AIR/MWD normalized + TSP 1..5 → 0..1).
 *
 * Call `onTeamAirWrite` after a team member AIR snapshot is written; use `getTeamTII` for latest row.
 */

import type { TIIResult } from "@/domain/leadership-engine";

/** Latest `team_integrity_index` row including `calculated_at` (service role). */
export type TeamTIISnapshotRow = TIIResult & { calculated_at: string };
import { compute_team_tii } from "@/lib/bty/leadership-engine/tii-service";
import { buildRolling7dGetTeamTIIInputs } from "@/lib/bty/leadership-engine/tii-weekly-inputs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Recompute TII from rolling 7d activations (all members’ AIR/MWD + default TSP), persist, return result.
 */
export async function onTeamAirWrite(teamId: string): Promise<TIIResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("onTeamAirWrite: Supabase service role not configured");
  }
  const getInputs = buildRolling7dGetTeamTIIInputs(admin, new Date());
  const result = await compute_team_tii(teamId, getInputs);
  const calculatedAt = new Date().toISOString();
  const { error } = await admin.from("team_integrity_index").insert({
    team_id: teamId,
    tii: result.tii,
    avg_air: result.avg_air,
    avg_mwd: result.avg_mwd,
    tsp: result.tsp,
    calculated_at: calculatedAt,
  });
  if (error) throw error;
  return result;
}

/**
 * Latest persisted TII for the team (`team_integrity_index` by `calculated_at` desc).
 * Returns `null` when no row exists.
 */
export async function getTeamTIISnapshot(teamId: string): Promise<TeamTIISnapshotRow | null> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("getTeamTIISnapshot: Supabase service role not configured");
  }
  const { data, error } = await admin
    .from("team_integrity_index")
    .select("tii, avg_air, avg_mwd, tsp, calculated_at")
    .eq("team_id", teamId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as {
    tii: number;
    avg_air: number;
    avg_mwd: number;
    tsp: number;
    calculated_at: string;
  };
  return {
    tii: Number(row.tii),
    avg_air: Number(row.avg_air),
    avg_mwd: Number(row.avg_mwd),
    tsp: Number(row.tsp),
    calculated_at: typeof row.calculated_at === "string" ? row.calculated_at : String(row.calculated_at),
  };
}

/**
 * Latest persisted TII for the team (`team_integrity_index` by `calculated_at` desc).
 */
export async function getTeamTII(teamId: string): Promise<TIIResult> {
  const row = await getTeamTIISnapshot(teamId);
  if (!row) {
    throw new Error(`getTeamTII: no snapshot for team ${teamId}`);
  }
  return { tii: row.tii, avg_air: row.avg_air, avg_mwd: row.avg_mwd, tsp: row.tsp };
}

export class TIICalculatorService {
  onTeamAirWrite(teamId: string): Promise<TIIResult> {
    return onTeamAirWrite(teamId);
  }

  getTeamTII(teamId: string): Promise<TIIResult> {
    return getTeamTII(teamId);
  }
}
