/**
 * Center Daily Trace — server projection (STEP 1B).
 *
 * READ-ONLY. Sources EXCLUSIVELY from `user_day` (the server-authoritative self-return table).
 * It reads NOTHING from Arena: no /api/arena/*, no arena_runs, no weekly_xp, no bty_action_contracts,
 * no leaderboard, no localStorage, no client counters. User-scoped Supabase client (RLS: user_day
 * SELECTs own rows) — never service-role.
 *
 * Timezone: the day-key rules are NOT duplicated here. We resolve the tz from the user's OWN most
 * recent `user_day.timezone_snapshot` (the tz the write path actually used), falling back to UTC,
 * then compute today's key with the existing {@link userDayKey} (5:00 local rollover). Presence over
 * the recent window → numberless light via {@link buildDailyTrace}. Missing days are 0, not errors.
 *
 * Fail-soft: any read/compute failure degrades to a resting 7-day all-0 series — never throws into Me.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayKey } from "@/domain/daily/userDayKey";
import { isValidIanaTz } from "@/lib/bty/daily/userDay";
import { buildDailyTrace, type DailyTrace } from "@/domain/daily/dailyTrace";

/** How many recent BTY days the trace covers (matches the WeeklyOrb's 7-day rhythm). */
export const DAILY_TRACE_DAYS = 7;

type UserDayRow = { day_key: string; timezone_snapshot: string | null };

/**
 * Project the recent {@link DAILY_TRACE_DAYS}-day self-return trace for a user. `now` is injected
 * (route passes `new Date()`) so this stays deterministic and testable. Never throws.
 */
export async function projectDailyTrace(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
): Promise<DailyTrace> {
  let rows: UserDayRow[] = [];
  try {
    // ONLY user_day is queried. Recent rows (one per day) cover the last window and carry the tz
    // actually used to key them. limit 2× the window is ample (one row per user/day).
    const { data, error } = await supabase
      .from("user_day")
      .select("day_key, timezone_snapshot")
      .eq("user_id", userId)
      .order("day_key", { ascending: false })
      .limit(DAILY_TRACE_DAYS * 2);
    if (!error && Array.isArray(data)) rows = data as UserDayRow[];
  } catch {
    rows = []; // fail-soft: table degraded / unavailable → resting all-0 series
  }

  const snapshotTz = rows.find((r) => isValidIanaTz(r.timezone_snapshot))?.timezone_snapshot;
  const tz = isValidIanaTz(snapshotTz) ? snapshotTz : "UTC";

  let todayKey: string;
  try {
    todayKey = userDayKey(now, tz, 5);
  } catch {
    todayKey = userDayKey(now, "UTC", 5); // UTC is always a valid zone → never throws
  }

  const present = new Set(rows.map((r) => r.day_key));
  return { dailyTrace: buildDailyTrace(todayKey, present, DAILY_TRACE_DAYS) };
}
