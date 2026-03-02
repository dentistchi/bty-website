/**
 * TII weekly job — Infrastructure: team list + GetTeamTIIInputs from Supabase.
 * Single source: docs/TII_WEEKLY_JOB_SPEC.md.
 * Used by /api/cron/tii-weekly only; service_role required.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAIR, type ActivationRecord, type ActivationType } from "@/domain/leadership-engine";
import type { GetTeamTIIInputs } from "./tii-service";
import type { TIIInputs } from "@/domain/leadership-engine";

const TSP_DEFAULT = 3; // 1..5 scale when no TSP data

/** Returns all team_ids (league_id) from arena_leagues for TII snapshot. */
export async function getTeamIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("arena_leagues").select("league_id");
  if (error) return [];
  return (data ?? []).map((r: { league_id: string }) => r.league_id);
}

/**
 * Builds GetTeamTIIInputs that fetches team-level aggregates from activation + verification logs.
 * weekStart ISO date (e.g. "2026-03-10"); 7d window = weekStart .. weekStart+7.
 * Individual AIR is never returned; only team averages.
 */
export function buildGetTeamTIIInputs(
  admin: SupabaseClient,
  weekStart: string
): GetTeamTIIInputs {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start.getTime() + 7 * 86_400_000);

  return async (teamId: string, _weekStart?: string): Promise<TIIInputs> => {
    // Members of this league
    const { data: members } = await admin
      .from("league_memberships")
      .select("user_id")
      .eq("league_id", teamId);
    const userIds = (members ?? []).map((r: { user_id: string }) => r.user_id);
    if (userIds.length === 0) {
      return { avgAIR: 0, avgMWD: 0, tsp: TSP_DEFAULT };
    }

    // Activations in window for these users
    const { data: logs } = await admin
      .from("le_activation_log")
      .select("activation_id, user_id, type, chosen_at, due_at, completed_at")
      .in("user_id", userIds)
      .gte("chosen_at", start.toISOString())
      .lt("chosen_at", end.toISOString());

    if (!logs?.length) {
      return { avgAIR: 0, avgMWD: 0, tsp: TSP_DEFAULT };
    }

    const activationIds = logs.map((r: { activation_id: string }) => r.activation_id);
    const { data: verifications } = await admin
      .from("le_verification_log")
      .select("activation_id, verified")
      .in("activation_id", activationIds)
      .order("verified_at", { ascending: false });

    const verifiedSet = new Set<string>();
    const seen = new Set<string>();
    for (const v of verifications ?? []) {
      const id = (v as { activation_id: string; verified: boolean }).activation_id;
      if (!seen.has(id)) {
        seen.add(id);
        if ((v as { verified: boolean }).verified) verifiedSet.add(id);
      }
    }

    const recordsByUser = new Map<string, ActivationRecord[]>();
    for (const r of logs) {
      const rec: ActivationRecord = {
        activation_id: (r as { activation_id: string }).activation_id,
        user_id: (r as { user_id: string }).user_id,
        type: (r as { type: string }).type as ActivationType,
        chosen_at: new Date((r as { chosen_at: string }).chosen_at),
        due_at: new Date((r as { due_at: string }).due_at),
        completed_at: (r as { completed_at: string | null }).completed_at
          ? new Date((r as { completed_at: string }).completed_at)
          : null,
        verified: verifiedSet.has((r as { activation_id: string }).activation_id),
      };
      const uid = rec.user_id;
      if (!recordsByUser.has(uid)) recordsByUser.set(uid, []);
      recordsByUser.get(uid)!.push(rec);
    }

    const airs: number[] = [];
    const mwds: number[] = [];
    for (const [, recs] of recordsByUser) {
      const airResult = computeAIR(recs, "7d", end);
      airs.push(airResult.air);
      const microWinCompleted = recs.filter(
        (a) => a.type === "micro_win" && a.completed_at !== null && a.verified
      ).length;
      mwds.push(microWinCompleted / 7);
    }

    const avgAIR = airs.length ? airs.reduce((a, b) => a + b, 0) / airs.length : 0;
    const avgMWD = mwds.length ? mwds.reduce((a, b) => a + b, 0) / mwds.length : 0;
    return { avgAIR, avgMWD, tsp: TSP_DEFAULT };
  };
}
