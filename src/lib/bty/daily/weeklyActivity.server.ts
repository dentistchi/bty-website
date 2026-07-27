import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import { countFirstPublishedRunsInWindow } from "@/domain/daily/yesterdayCreation";

/**
 * Weekly activity — read-only canonical counts for the Me "This week" summary
 * (Slice 3.2C-B3A.2D). The window is the user's last 7 LOCAL BTY days (including
 * today), 05:00 rollover. Fail-soft PER CATEGORY: an unavailable/erroring source
 * yields `undefined` (the UI omits it). Never estimated, never a lifetime total
 * treated as weekly, never one event type approximating another.
 *
 * Canonical sources:
 *   - weeklyPoints        = weekly_xp.xp_total (user, global pool league_id NULL) — the
 *                           current weekly balance (reset weekly; NOT lifetime).
 *   - forgeStage          = arena_profiles.stage (band label, no numerics/reason codes).
 *   - activeDays          = user_day rows in the 7-day window (canonical self-return presence).
 *   - trainingsCompleted  = foundry_event_training_progress.completed_at in window (linked user).
 *   - trainingsCreated    = Programs whose FIRST owned Run was created in window (Run lineage).
 *   - centerReflections   = dear_me_letters in window.
 *   - actionPlansCompleted= bty_action_contracts action_type='field_action' status='approved'
 *                           (the completed/verified state) with reviewed_at in window.
 * Writes nothing.
 */

export type WeeklySummary = {
  weeklyPoints?: number;
  forgeStage?: number;
  activeDays?: number;
  trainingsCompleted?: number;
  trainingsCreated?: number;
  centerReflections?: number;
  actionPlansCompleted?: number;
};

async function safeCount(p: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | undefined> {
  try {
    const { count, error } = await p;
    return error ? undefined : count ?? 0;
  } catch {
    return undefined;
  }
}
async function safeScalar(p: PromiseLike<{ data: unknown; error: unknown }>, col: string): Promise<number | undefined> {
  try {
    const { data, error } = await p;
    if (error || data == null || typeof data !== "object") return undefined;
    const v = (data as Record<string, unknown>)[col];
    return typeof v === "number" ? v : undefined;
  } catch {
    return undefined;
  }
}

const DAY_MS = 24 * 3600 * 1000;

export async function loadWeeklyActivity(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  deviceTz: string | null,
): Promise<WeeklySummary> {
  const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
  const todayStart = userDayStartInstant(now, timezone, 5);
  const startInstant = new Date(todayStart.getTime() - 6 * DAY_MS); // 7 days incl. today
  const startIso = startInstant.toISOString();
  const endIso = new Date(todayStart.getTime() + DAY_MS).toISOString();
  const win = (table: string, col = "created_at") =>
    admin.from(table).select("*", { count: "exact", head: true }).gte(col, startIso).lt(col, endIso);

  const runsCreated = (async () => {
    try {
      const { data, error } = await admin.from("foundry_events").select("program_id, created_at").eq("owner_user_id", userId).not("program_id", "is", null);
      if (error) return undefined;
      const runs = (data ?? []).filter((r) => r.program_id).map((r) => ({ programId: r.program_id as string, createdAtMs: Date.parse(r.created_at as string) }));
      return countFirstPublishedRunsInWindow(runs, startInstant.getTime(), todayStart.getTime() + DAY_MS);
    } catch {
      return undefined;
    }
  })();

  const [weeklyPoints, forgeStage, activeDays, trainingsCompleted, trainingsCreated, centerReflections, actionPlansCompleted] = await Promise.all([
    safeScalar(admin.from("weekly_xp").select("xp_total").eq("user_id", userId).is("league_id", null).maybeSingle(), "xp_total"),
    safeScalar(admin.from("arena_profiles").select("stage").eq("user_id", userId).maybeSingle(), "stage"),
    safeCount(win("user_day").eq("user_id", userId)),
    safeCount(win("foundry_event_training_progress", "completed_at").eq("linked_user_id", userId)),
    runsCreated,
    safeCount(win("dear_me_letters").eq("user_id", userId)),
    safeCount(win("bty_action_contracts", "reviewed_at").eq("user_id", userId).eq("action_type", "field_action").eq("status", "approved")),
  ]);

  return { weeklyPoints, forgeStage, activeDays, trainingsCompleted, trainingsCreated, centerReflections, actionPlansCompleted };
}
