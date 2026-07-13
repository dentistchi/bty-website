/**
 * yesterdayMemory (server) — Yesterday → Today Memory Bridge V1.
 *
 * Read-only assembly of yesterday's provenance-safe evidence for the arrival trace. It reuses the
 * SAME canonical primitives as every other daily surface so the day boundary can never drift:
 *   - resolveUserTzContext → the user's canonical IANA tz (profile → device → UTC)
 *   - userDayKey(now, tz, 5) → today's BTY day key (05:00 local rollover)
 *   - readYesterdayContext → yesterday's committed relationship (from today_relationship_commitments)
 *
 * The heavy lifting (which day is "yesterday", what row is canonical) already exists in
 * readYesterdayContext; this loader only maps its output onto the pure presentation resolver.
 * Fail-soft by construction: any degraded read yields null → the trace renders unchanged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayKey } from "@/domain/daily/userDayKey";
import { readYesterdayContext } from "./livingResponseYesterday.server";
import { resolveUserTzContext } from "./userDay";
import { resolveYesterdayMemory, type YesterdayMemory } from "@/domain/daily/yesterdayMemory";

/** BTY day open-hour (05:00 local) — the single canonical boundary shared by all daily surfaces. */
const OPEN_HOUR = 5;

/**
 * Resolve today's one remembered line from yesterday's real commitment, or null. The client renders
 * this in the existing arrival trace slot when present, and the unchanged status line otherwise.
 */
export async function loadYesterdayMemory(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  deviceTz: string | null,
): Promise<YesterdayMemory | null> {
  try {
    const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
    const todayDayKey = userDayKey(now, timezone, OPEN_HOUR);
    const yesterday = await readYesterdayContext(admin, userId, todayDayKey);
    return resolveYesterdayMemory({
      existed: yesterday.existed,
      relationship: yesterday.relationship,
    });
  } catch {
    return null; // fail-soft — never break Today's arrival.
  }
}
