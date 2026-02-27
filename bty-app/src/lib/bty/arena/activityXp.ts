import type { SupabaseClient } from "@supabase/supabase-js";
import { applySeasonalXpToCore } from "./applyCoreXp";

const DAILY_CAP = 1200;

export type ActivityType = "MENTOR_MESSAGE" | "CHAT_MESSAGE";

const ACTIVITY_XP: Record<ActivityType, number> = {
  MENTOR_MESSAGE: 5,
  CHAT_MESSAGE: 5,
};

/**
 * Record Dojo/Dear Me activity XP: apply daily cap (Arena + activity), insert event, update weekly_xp, apply to Core.
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

  const { data: arenaEvs } = await supabase
    .from("arena_events")
    .select("xp")
    .eq("user_id", userId)
    .gte("created_at", startOfDayISO);
  const arenaToday = (arenaEvs ?? []).reduce((s, r) => s + (typeof r.xp === "number" ? r.xp : 0), 0);

  const { data: activityEvs } = await supabase
    .from("activity_xp_events")
    .select("xp")
    .eq("user_id", userId)
    .gte("created_at", startOfDayISO);
  const activityToday = (activityEvs ?? []).reduce((s, r) => s + (typeof r.xp === "number" ? r.xp : 0), 0);

  const todayTotal = arenaToday + activityToday;
  const deltaCapped = Math.max(0, Math.min(xp, DAILY_CAP - todayTotal));
  if (deltaCapped <= 0) return { ok: true, xp: 0 };

  const { error: insErr } = await supabase.from("activity_xp_events").insert({
    user_id: userId,
    activity_type: activityType,
    xp: deltaCapped,
  });
  if (insErr) return { ok: false, error: insErr.message };

  await supabase.rpc("ensure_arena_profile");

  const { data: wxRow, error: rowErr } = await supabase
    .from("weekly_xp")
    .select("id, xp_total")
    .eq("user_id", userId)
    .is("league_id", null)
    .maybeSingle();
  if (rowErr) return { ok: false, error: rowErr.message };

  if (!wxRow) {
    const { error: insWx } = await supabase.from("weekly_xp").insert({
      user_id: userId,
      league_id: null,
      xp_total: deltaCapped,
    });
    if (insWx) return { ok: false, error: insWx.message };
  } else {
    const nextTotal = (typeof (wxRow as { xp_total?: number }).xp_total === "number" ? (wxRow as { xp_total: number }).xp_total : 0) + deltaCapped;
    const { error: uErr } = await supabase.from("weekly_xp").update({ xp_total: nextTotal }).eq("id", (wxRow as { id: number }).id);
    if (uErr) return { ok: false, error: uErr.message };
  }

  const coreResult = await applySeasonalXpToCore(supabase, userId, deltaCapped);
  if ("error" in coreResult) return { ok: false, error: coreResult.error };

  return { ok: true, xp: deltaCapped };
}
