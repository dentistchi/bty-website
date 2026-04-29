/**
 * Weekly XP reset — ranking pool only (`weekly_xp.xp_total` where `league_id` IS NULL).
 * Core XP and `weekly_xp_ledger` are not modified.
 *
 * Schedule: cron every **Monday 00:00 UTC** should call {@link triggerWeeklyReset}.
 * Denormalized `arena_profiles.weekly_xp` is zeroed for affected users to stay in sync.
 *
 * Canonical store is `public.weekly_xp` (not a `user_xp` table).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Monday 00:00 UTC of the ranking week that just ended (when the job runs at the next Monday). */
export function endedWeekMondayUtc(from: Date): string {
  const d = new Date(from.getTime());
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - daysSinceMonday - 7);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export type SeasonEndedLeaderboardEntry = {
  rank: number;
  userId: string;
  weeklyXp: number;
};

/** Emitted after snapshot + reset; `event` is fixed to `season_ended` per product hook name. */
export type SeasonEndedEventPayload = {
  event: "season_ended";
  seasonId: string | null;
  endedWeekMonday: string;
  snapshotAt: string;
  top10: SeasonEndedLeaderboardEntry[];
};

export type ResetResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  seasonId: string | null;
  endedWeekMonday: string;
  snapshotAt: string;
  usersSnapshotted: number;
  usersReset: number;
  top10: SeasonEndedLeaderboardEntry[];
  error?: string;
};

const seasonEndedListeners = new Set<(payload: SeasonEndedEventPayload) => void>();

/** Subscribe to `season_ended` (after each successful reset). Returns unsubscribe. */
export function onSeasonEnded(listener: (payload: SeasonEndedEventPayload) => void): () => void {
  seasonEndedListeners.add(listener);
  return () => seasonEndedListeners.delete(listener);
}

function emitSeasonEnded(payload: SeasonEndedEventPayload): void {
  for (const fn of seasonEndedListeners) {
    try {
      fn(payload);
    } catch {
      // Listener errors must not abort reset
    }
  }
}

type WeeklyXpGlobalRow = {
  user_id: string;
  xp_total: number | null;
  updated_at: string | null;
};

function sortWeeklyRows(a: WeeklyXpGlobalRow, b: WeeklyXpGlobalRow): number {
  const ax = Number(a.xp_total ?? 0);
  const bx = Number(b.xp_total ?? 0);
  if (bx !== ax) return bx - ax;
  const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
  const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  if (at !== bt) return at - bt;
  return a.user_id.localeCompare(b.user_id);
}

function buildTop10(rows: WeeklyXpGlobalRow[]): SeasonEndedLeaderboardEntry[] {
  const sorted = [...rows].sort(sortWeeklyRows);
  return sorted.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    weeklyXp: Number(r.xp_total ?? 0),
  }));
}

/**
 * Fetches active season (`status = active`, highest `season_number`), or null.
 */
export async function getActiveSeasonId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from("arena_seasons")
    .select("season_id")
    .eq("status", "active")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { season_id: string }).season_id ?? null;
}

/**
 * Snapshot weekly XP to `weekly_xp_history`, reset `weekly_xp` + `arena_profiles.weekly_xp`,
 * emit `season_ended` with top-10 snapshot (same ordering as leaderboard: xp desc, updated_at asc, user_id asc).
 */
export async function triggerWeeklyReset(
  options?: { at?: Date; supabase?: SupabaseClient },
): Promise<ResetResult> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      seasonId: null,
      endedWeekMonday: "",
      snapshotAt: new Date().toISOString(),
      usersSnapshotted: 0,
      usersReset: 0,
      top10: [],
      error: "supabase_admin_not_configured",
    };
  }

  const at = options?.at ?? new Date();
  const endedMon = endedWeekMondayUtc(at);
  const snapshotAt = at.toISOString();

  const { data: existingLog } = await admin
    .from("weekly_reset_log")
    .select("id")
    .eq("ended_week_monday", endedMon)
    .maybeSingle();

  if (existingLog) {
    return {
      ok: true,
      skipped: true,
      reason: "already_reset_for_week",
      seasonId: null,
      endedWeekMonday: endedMon,
      snapshotAt,
      usersSnapshotted: 0,
      usersReset: 0,
      top10: [],
    };
  }

  const seasonId = await getActiveSeasonId(admin);

  const { data: rawRows, error: fetchErr } = await admin
    .from("weekly_xp")
    .select("user_id, xp_total, updated_at")
    .is("league_id", null)
    .gt("xp_total", 0);

  if (fetchErr) {
    return {
      ok: false,
      seasonId,
      endedWeekMonday: endedMon,
      snapshotAt,
      usersSnapshotted: 0,
      usersReset: 0,
      top10: [],
      error: fetchErr.message,
    };
  }

  const rows = (rawRows ?? []) as WeeklyXpGlobalRow[];
  const top10 = buildTop10(rows);

  const historyRows = rows.map((r) => ({
    user_id: r.user_id,
    season_id: seasonId,
    final_xp: Math.floor(Number(r.xp_total ?? 0)),
    snapshot_at: snapshotAt,
    ended_week_monday: endedMon,
  }));

  if (historyRows.length > 0) {
    const { error: histErr } = await admin.from("weekly_xp_history").insert(historyRows);
    if (histErr) {
      const dup =
        histErr.code === "23505" ||
        (typeof histErr.message === "string" && histErr.message.includes("duplicate"));
      if (!dup) {
        return {
          ok: false,
          seasonId,
          endedWeekMonday: endedMon,
          snapshotAt,
          usersSnapshotted: 0,
          usersReset: 0,
          top10,
          error: histErr.message,
        };
      }
      // Snapshot already written for this week (e.g. retry after partial failure); continue with idempotent reset.
    }
  }

  const { error: resetWxErr } = await admin
    .from("weekly_xp")
    .update({ xp_total: 0 })
    .is("league_id", null)
    .gt("xp_total", 0);

  if (resetWxErr) {
    return {
      ok: false,
      seasonId,
      endedWeekMonday: endedMon,
      snapshotAt,
      usersSnapshotted: historyRows.length,
      usersReset: 0,
      top10,
      error: resetWxErr.message,
    };
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length > 0) {
    const { error: profErr } = await admin.from("arena_profiles").update({ weekly_xp: 0 }).in("user_id", userIds);
    if (profErr) {
      return {
        ok: false,
        seasonId,
        endedWeekMonday: endedMon,
        snapshotAt,
        usersSnapshotted: historyRows.length,
        usersReset: rows.length,
        top10,
        error: profErr.message,
      };
    }
  }

  const { error: logErr } = await admin.from("weekly_reset_log").insert({
    ended_week_monday: endedMon,
    season_id: seasonId,
    snapshot_at: snapshotAt,
  });

  if (logErr) {
    return {
      ok: false,
      seasonId,
      endedWeekMonday: endedMon,
      snapshotAt,
      usersSnapshotted: historyRows.length,
      usersReset: rows.length,
      top10,
      error: logErr.message,
    };
  }

  const payload: SeasonEndedEventPayload = {
    event: "season_ended",
    seasonId,
    endedWeekMonday: endedMon,
    snapshotAt,
    top10,
  };
  emitSeasonEnded(payload);

  return {
    ok: true,
    seasonId,
    endedWeekMonday: endedMon,
    snapshotAt,
    usersSnapshotted: historyRows.length,
    usersReset: rows.length,
    top10,
  };
}
