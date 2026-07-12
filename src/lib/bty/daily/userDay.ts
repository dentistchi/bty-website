/**
 * userDay — server-authoritative daily-instance foundation (STEP 1C / D1).
 *
 * On Today entry, resolve the canonical {@link userDayKey} and idempotently create/reuse the
 * user's row for that day. No client-only truth for progression — the row is written server-side.
 *
 * Timezone resolution (Commander-ratified fallback = UTC-for-request + recapture):
 *   1. `arena_profiles.timezone` if present and a valid IANA id → use it.
 *   2. else the request's device tz if valid IANA → use it AND capture it to the profile.
 *   3. else → compute THIS request's key on **UTC** (tz_fallback=true). Do NOT overwrite the
 *      profile timezone with "UTC" — leave it null so capture is retried on later entries.
 * `user_day.timezone_snapshot` always records the tz actually used for that day_key.
 *
 * Fail-soft: any DB error (incl. schema not yet migrated) degrades to a computed dayKey with
 * `isNew=false` and no persistence, so Today never breaks.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayKey } from "@/domain/daily/userDayKey";

export type UserDayResult = {
  dayKey: string;
  isNew: boolean; // true = this call created today's row; false = it already existed (or persistence unavailable)
  timezone: string; // the tz actually used to compute dayKey ("Asia/Seoul" … or "UTC" on fallback)
  tzFallback: boolean; // true = device tz unresolved → UTC used for this key
};

/** Valid IANA tz id? (Intl throws RangeError on an unknown/invalid zone.) */
export function isValidIanaTz(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The tz actually used to compute a BTY day_key for this request, plus the fallback flag.
 * Shared by every server-authoritative daily surface so they all resolve the SAME canonical
 * day_key for the same (user, instant, deviceTz) — see {@link resolveUserTzContext}.
 */
export type UserTzContext = { timezone: string; tzFallback: boolean };

/**
 * Resolve the canonical timezone for a user's BTY day_key (profile → device[+capture] → UTC).
 * Extracted so `user_day` and the Today relationship commitment produce identical day_keys; the
 * ladder and capture behavior are unchanged from the original inline logic.
 *
 *   1. `arena_profiles.timezone` if a valid IANA id → use it.
 *   2. else the request's device tz if valid IANA → use it AND capture it to the profile.
 *   3. else → "UTC" with tzFallback=true; leave the profile tz null so capture is retried later.
 */
export async function resolveUserTzContext(
  admin: SupabaseClient,
  userId: string,
  deviceTz: string | null | undefined,
): Promise<UserTzContext> {
  let profileTz: string | null = null;
  try {
    const { data } = await admin
      .from("arena_profiles")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();
    profileTz = (data as { timezone?: string | null } | null)?.timezone ?? null;
  } catch {
    profileTz = null; // e.g. column not yet migrated → treat as unresolved
  }

  if (isValidIanaTz(profileTz)) {
    return { timezone: profileTz, tzFallback: false };
  }
  if (isValidIanaTz(deviceTz)) {
    // Capture the newly-resolved device tz (best-effort; never overwrite a real tz with UTC).
    try {
      await admin.from("arena_profiles").update({ timezone: deviceTz }).eq("user_id", userId);
    } catch {
      /* capture is best-effort; the key is still correct this request */
    }
    return { timezone: deviceTz, tzFallback: false };
  }
  return { timezone: "UTC", tzFallback: true };
}

export async function ensureUserDay(
  admin: SupabaseClient,
  userId: string,
  instant: Date,
  deviceTz: string | null | undefined,
): Promise<UserDayResult> {
  // 1) Resolve the timezone (profile → device[+capture] → UTC fallback) via the shared resolver.
  const { timezone: resolvedTz, tzFallback } = await resolveUserTzContext(admin, userId, deviceTz);

  const dayKey = userDayKey(instant, resolvedTz, 5);

  // 2) Idempotent daily creation. UNIQUE (user_id, day_key) + ON CONFLICT DO NOTHING guarantees
  //    one row per user per day; RETURNING rows only when a row was actually inserted → isNew.
  let isNew = false;
  try {
    const { data, error } = await admin
      .from("user_day")
      .upsert(
        { user_id: userId, day_key: dayKey, timezone_snapshot: resolvedTz, tz_fallback: tzFallback },
        { onConflict: "user_id,day_key", ignoreDuplicates: true },
      )
      .select("id");
    isNew = !error && Array.isArray(data) && data.length > 0;
  } catch {
    isNew = false; // persistence unavailable (e.g. table not yet migrated) → fail-soft
  }

  return { dayKey, isNew, timezone: resolvedTz, tzFallback };
}
