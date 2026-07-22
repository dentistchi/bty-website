/**
 * yesterdayReflection (server) — Today "From yesterday" Private Reflection bridge V1 (Slice 3.1B-3I).
 *
 * Read-only, OWNER-SCOPED. Reuses the SAME canonical day primitives as every daily surface so the
 * "yesterday" boundary can never drift:
 *   - resolveUserTzContext → the user's canonical IANA tz (profile → device → UTC)
 *   - userDayKey(instant, tz, 5) → the BTY day key (05:00 local rollover)
 * and reuses the SAME owner-scoped learner-private read (listUserFoundryHistory, linked_user_id =
 * caller) — no new query, no copied data. A reflection counts as "yesterday" when its completion's
 * BTY day key equals the day before today's. Fail-soft: any degraded read yields null (no card).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayKey } from "@/domain/daily/userDayKey";
import { resolveUserTzContext } from "./userDay";
import { listUserFoundryHistory } from "@/lib/bty/foundry/events/foundryHistoryService";

const OPEN_HOUR = 5;

export type YesterdayReflection = {
  /** Stable owner-scoped record id → the exact Center deep-link entry. */
  entryId: string;
  eventTitle: string;
  contentType: "youtube" | "document";
  completedAt: string;
  /** The learner's OWN private reflection body (owner-only; client collapses it until tapped). */
  responseText: string;
  /** How many MORE eligible reflections existed yesterday (0 when this is the only one). */
  additionalCount: number;
};

/** Pure calendar subtraction on a "YYYY-MM-DD" key (UTC math avoids tz interference). */
function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Yesterday's most-recent eligible Private Reflection for the authenticated caller, or null.
 * Deterministic: the owner-scoped history is newest-first, so the FIRST match is the most recent;
 * `additionalCount` is the number of other yesterday reflections.
 */
export async function loadYesterdayReflection(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  deviceTz: string | null,
): Promise<YesterdayReflection | null> {
  try {
    if (!userId) return null;
    const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
    const todayKey = userDayKey(now, timezone, OPEN_HOUR);
    const yesterdayKey = previousDayKey(todayKey);

    const items = await listUserFoundryHistory(admin, userId); // owner-scoped, newest-first
    const yesterday = items.filter(
      (it) =>
        it.responseText.trim().length > 0 &&
        userDayKey(new Date(it.completedAt), timezone, OPEN_HOUR) === yesterdayKey,
    );
    if (yesterday.length === 0) return null;

    const top = yesterday[0]!;
    return {
      entryId: top.entryId,
      eventTitle: top.eventTitle,
      contentType: top.contentType,
      completedAt: top.completedAt,
      responseText: top.responseText,
      additionalCount: yesterday.length - 1,
    };
  } catch {
    return null; // fail-soft — never break Today.
  }
}
