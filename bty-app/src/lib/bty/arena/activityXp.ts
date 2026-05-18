import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveLeague } from "./activeLeague";
import { applySeasonalXpToCore } from "./applyCoreXp";

/** Arena daily XP cap (run complete + activity). Single source for run/complete route and recordActivityXp. */
export const ARENA_DAILY_XP_CAP = 1200;

/**
 * Returns the sum of arena_events xp for the given user since start of today (UTC).
 * Used by run/complete and recordActivityXp for daily cap.
 */
export async function getArenaTodayTotal(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const now = new Date();
  const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfDayISO = startOfDayUTC.toISOString();
  const { data: evs } = await supabase
    .from("arena_events")
    .select("xp")
    .eq("user_id", userId)
    .gte("created_at", startOfDayISO);
  return (evs ?? []).reduce((s, r) => s + (typeof r.xp === "number" ? r.xp : 0), 0);
}

/**
 * Cap a run/activity delta by the arena daily cap. Pure.
 * Second arg: total XP already counted toward the cap (arena-only for run/complete; arena+activity for recordActivityXp).
 */
export function capArenaDailyDelta(delta: number, todayTotalTowardCap: number): number {
  return Math.max(0, Math.min(delta, ARENA_DAILY_XP_CAP - todayTotalTowardCap));
}

export type ActivityType = "MENTOR_MESSAGE" | "CHAT_MESSAGE" | "QUICK_MODE_COMPLETE";

const ACTIVITY_XP: Record<ActivityType, number> = {
  MENTOR_MESSAGE: 5,
  CHAT_MESSAGE: 5,
  QUICK_MODE_COMPLETE: 5,
};

/**
 * Record Foundry/Center activity XP: apply daily cap (Arena + activity), insert event, update weekly_xp (active league), apply to Core.
 * Call after a successful mentor or chat message. No-op if not authenticated or cap would be exceeded.
 */
export async function recordActivityXp(
  supabase: SupabaseClient,
  userId: string,
  activityType: ActivityType
): Promise<{ ok: true; xp: number } | { ok: false; error: string }> {
  const xp = ACTIVITY_XP[activityType] ?? 0;
  if (xp <= 0) return { ok: true, xp: 0 };

  const now = new Date();
  const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfDayISO = startOfDayUTC.toISOString();

  const arenaToday = await getArenaTodayTotal(supabase, userId);
  const { data: activityEvs } = await supabase
    .from("activity_xp_events")
    .select("xp")
    .eq("user_id", userId)
    .gte("created_at", startOfDayISO);
  const activityToday = (activityEvs ?? []).reduce((s, r) => s + (typeof r.xp === "number" ? r.xp : 0), 0);

  const todayTotal = arenaToday + activityToday;
  const deltaCapped = capArenaDailyDelta(xp, todayTotal);
  if (deltaCapped <= 0) return { ok: true, xp: 0 };

  const { error: insErr } = await supabase.from("activity_xp_events").insert({
    user_id: userId,
    activity_type: activityType,
    xp: deltaCapped,
  });
  if (insErr) return { ok: false, error: insErr.message };

  await supabase.rpc("ensure_arena_profile");

  const league = await getActiveLeague(supabase, getSupabaseAdmin());
  const leagueId: string | null = league?.league_id ?? null;

  // Atomic weekly_xp increment (UPSERT) — prevents read-modify-write lost writes.
  const { error: wxErr } = await supabase.rpc("increment_weekly_xp", {
    p_user_id: userId,
    p_league_id: leagueId,
    p_delta: deltaCapped,
  });
  if (wxErr) return { ok: false, error: wxErr.message };

  const coreResult = await applySeasonalXpToCore(supabase, userId, deltaCapped);
  if ("error" in coreResult) return { ok: false, error: coreResult.error };

  return { ok: true, xp: deltaCapped };
}
