import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import type { YesterdayCounts } from "@/domain/daily/yesterdaySummary";
import { countFirstPublishedRunsInWindow } from "@/domain/daily/yesterdayCreation";

/**
 * Yesterday activity — read-only canonical counts for the Today "Yesterday" section
 * (Slice 3.2C-B3A.2B, sources corrected in R1). Computed over the user's LOCAL BTY
 * day (05:00 rollover), NEVER the UTC calendar date. Fail-soft PER CATEGORY: a
 * source that errors yields `undefined` (the copy layer OMITS it) — never estimated.
 *
 * Canonical sources (R1):
 *   - trainingsCompleted = foundry_event_training_progress with a completed_at in
 *     the window, for THIS user (linked). One row per (event, participant); a
 *     reopen/review does not change completed_at → no inflation. XP-INDEPENDENT.
 *   - trainingsCreated   = a Program whose FIRST published Run (earliest
 *     foundry_events row for that program_id, owned by the user) was created in the
 *     window — derived from Run lineage, NOT foundry_programs.created_at. A later
 *     V2/V3 Run, or an idempotent publish retry, adds nothing.
 *   - centerReflections  = dear_me_letters (BROAD: every Center write — keeps,
 *     day reflections, letters). No narrower "check-in" subtype is claimed.
 *   - presence           = a user_day row exists for yesterday, by `opened_at` (canonical
 *     presence stamp; `user_day` carries no `created_at`).
 * Writes nothing (tz resolution reuses the shared helper's existing behavior).
 */

async function safeCount(p: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | undefined> {
  try {
    const { count, error } = await p;
    return error ? undefined : count ?? 0;
  } catch {
    return undefined; // fail-soft → category omitted, never estimated
  }
}

/** Correction 2: count Programs whose FIRST owned Run was created in-window (epoch-safe). */
async function loadTrainingsCreated(
  admin: SupabaseClient,
  userId: string,
  startMs: number,
  endMs: number,
): Promise<number | undefined> {
  try {
    const { data, error } = await admin
      .from("foundry_events")
      .select("program_id, created_at")
      .eq("owner_user_id", userId)
      .not("program_id", "is", null);
    if (error) return undefined;
    const runs = (data ?? [])
      .filter((r) => r.program_id)
      .map((r) => ({ programId: r.program_id as string, createdAtMs: Date.parse(r.created_at as string) }));
    return countFirstPublishedRunsInWindow(runs, startMs, endMs);
  } catch {
    return undefined;
  }
}

export async function loadYesterdayActivity(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  deviceTz: string | null,
): Promise<YesterdayCounts> {
  const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
  const todayStart = userDayStartInstant(now, timezone, 5);
  const startInstant = userDayStartInstant(new Date(todayStart.getTime() - 1000), timezone, 5);
  const startIso = startInstant.toISOString();
  const endIso = todayStart.toISOString();

  const [trainingsCompleted, trainingsCreated, centerReflections, presenceCount] = await Promise.all([
    // Correction 1: canonical completion fact = a completed_at inside the window.
    safeCount(
      admin
        .from("foundry_event_training_progress")
        .select("*", { count: "exact", head: true })
        .eq("linked_user_id", userId)
        .gte("completed_at", startIso)
        .lt("completed_at", endIso),
    ),
    loadTrainingsCreated(admin, userId, startInstant.getTime(), todayStart.getTime()),
    safeCount(
      admin.from("dear_me_letters").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startIso).lt("created_at", endIso),
    ),
    /*
      PRESENCE IS STAMPED BY `opened_at`, AND `user_day` HAS NO `created_at` AT ALL.

      This read asked for `created_at` and PostgREST answered 42703 every time — so presence has
      reported FALSE for every learner since 2026-07-26, silently. `safeCount` turns the refusal
      into `undefined`, which is exactly the shape of "this source is unavailable", so the surface
      degraded honestly and nothing ever surfaced the cause.
      `weeklyActivity.server.ts` already states the rule this now follows: `opened_at` is the
      canonical presence stamp, and it is what every other `user_day` reader uses.
    */
    safeCount(
      admin.from("user_day").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("opened_at", startIso).lt("opened_at", endIso),
    ),
  ]);

  return {
    trainingsCompleted,
    trainingsCreated,
    centerReflections,
    presence: typeof presenceCount === "number" ? presenceCount > 0 : false,
  };
}
