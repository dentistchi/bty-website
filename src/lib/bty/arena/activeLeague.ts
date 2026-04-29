/**
 * B-MVP: Active League (30-day window).
 * Returns the league where now() is between start_at and end_at; creates one if none.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const PERIOD_DAYS = 30;
const EPOCH = new Date("2026-01-25T00:00:00.000Z").getTime();
const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;

export type ActiveLeague = {
  league_id: string;
  start_at: string;
  end_at: string;
  name?: string;
};

function getCurrentWindow(): { start: Date; end: Date } {
  const now = Date.now();
  const index = Math.floor((now - EPOCH) / PERIOD_MS);
  const start = new Date(EPOCH + index * PERIOD_MS);
  const end = new Date(EPOCH + (index + 1) * PERIOD_MS - 1);
  return { start, end };
}

/**
 * Find active league (now between start_at and end_at). With anon client only.
 */
export async function findActiveLeague(
  supabase: SupabaseClient
): Promise<ActiveLeague | null> {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("arena_leagues")
    .select("league_id, start_at, end_at, name")
    .not("start_at", "is", null)
    .not("end_at", "is", null)
    .lte("start_at", now)
    .gte("end_at", now)
    .order("end_at", { ascending: false })
    .limit(1);

  if (error || !rows?.length) return null;
  const r = rows[0] as { league_id: string; start_at: string; end_at: string; name?: string };
  return { league_id: r.league_id, start_at: r.start_at, end_at: r.end_at, name: r.name };
}

/**
 * Get active league; create if none (uses admin client for insert).
 */
export async function getActiveLeague(
  supabaseAnon: SupabaseClient,
  supabaseAdmin: SupabaseClient | null
): Promise<ActiveLeague | null> {
  const existing = await findActiveLeague(supabaseAnon);
  if (existing) return existing;

  if (!supabaseAdmin) return null;

  // Spec: at season end, 10% Seasonal XP carryover before new league starts.
  await supabaseAdmin.rpc("run_season_carryover").then(() => {});

  const { start, end } = getCurrentWindow();
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const name = `Season ${startStr.slice(0, 10)}`;

  const { data: inserted, error } = await supabaseAdmin
    .from("arena_leagues")
    .insert({
      name,
      start_at: startStr,
      end_at: endStr,
      min_lifetime_xp: 0,
    })
    .select("league_id, start_at, end_at, name")
    .single();

  if (error || !inserted) return null;
  const r = inserted as { league_id: string; start_at: string; end_at: string; name?: string };
  return { league_id: r.league_id, start_at: r.start_at, end_at: r.end_at, name: r.name };
}
