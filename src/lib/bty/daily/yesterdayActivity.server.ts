import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import type { YesterdayCounts } from "@/domain/daily/yesterdaySummary";

/**
 * Yesterday activity — read-only canonical counts for the Today "Yesterday" section
 * (Slice 3.2C-B3A.2B). Computed over the user's LOCAL BTY day (05:00 rollover),
 * NEVER the UTC calendar date. Fail-soft PER CATEGORY: a source that errors yields
 * `undefined` (the copy layer OMITS it) — never an estimate, never a fabricated count.
 *
 * Canonical sources (measured in the slice reality-check):
 *   - trainingsCompleted = core_xp_ledger rows source_type='foundry_training_completion'
 *     (user-scoped; one idempotent row per completion — never double-counts reviews/retries)
 *   - trainingsCreated   = foundry_programs owned by the user (NEW Program roots only; a new
 *     version or new Run creates NO foundry_programs row, so it does not count)
 *   - centerReflections  = dear_me_letters (the canonical Center reflection/check-in store)
 *   - presence           = a user_day row exists for yesterday (canonical presence)
 * Writes nothing.
 */

async function safeCount(p: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | undefined> {
  try {
    const { count, error } = await p;
    return error ? undefined : count ?? 0;
  } catch {
    return undefined; // fail-soft → category omitted, never estimated
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
  const startIso = userDayStartInstant(new Date(todayStart.getTime() - 1000), timezone, 5).toISOString();
  const endIso = todayStart.toISOString();

  // Each source counted head-only within [yesterday 05:00, today 05:00) local.
  const win = (table: string) =>
    admin.from(table).select("*", { count: "exact", head: true }).gte("created_at", startIso).lt("created_at", endIso);

  const [trainingsCompleted, trainingsCreated, centerReflections, presenceCount] = await Promise.all([
    safeCount(win("core_xp_ledger").eq("user_id", userId).eq("source_type", "foundry_training_completion")),
    safeCount(win("foundry_programs").eq("owner_user_id_snapshot", userId)),
    safeCount(win("dear_me_letters").eq("user_id", userId)),
    safeCount(win("user_day").eq("user_id", userId)),
  ]);

  return {
    trainingsCompleted,
    trainingsCreated,
    centerReflections,
    presence: typeof presenceCount === "number" ? presenceCount > 0 : false,
  };
}
