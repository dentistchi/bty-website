/**
 * todayRelationshipCommitment (server) — persist/read the user's immutable confirmed relationship
 * for one canonical BTY day. Server-authoritative: writes go through the service-role admin client;
 * the day_key is resolved with the SAME {@link resolveUserTzContext} + {@link userDayKey} used by
 * `user_day`, so a commitment and the day's presence row always agree on which BTY day it is.
 *
 * Semantics — first-commit-wins, immutable after creation:
 *  - no row for (user, day_key)          → INSERT one, return {status:"created"}.
 *  - row exists, SAME relationship        → no write, return {status:"exists"}.
 *  - row exists, DIFFERENT relationship   → no write, return {status:"locked", <existing canonical>}.
 * suggested_relationship / locale / timezone / confirmed_at are set once and NEVER updated.
 *
 * This module carries NO AI/generation concern (no prompt, no provider, no evidence packet). It only
 * records that BTY received the decision.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayKey } from "@/domain/daily/userDayKey";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import {
  type RelationshipValue,
  type TodayCommitment,
} from "@/domain/daily/todayRelationshipCommitment";

const TABLE = "today_relationship_commitments";

type CommitmentRow = {
  relationship: string;
  suggested_relationship: string | null;
  day_key: string;
  confirmed_at: string;
  locale: string | null;
  timezone_snapshot: string;
  tz_fallback: boolean;
};

function toCommitment(row: CommitmentRow | null | undefined): TodayCommitment | null {
  if (!row) return null;
  return {
    relationship: row.relationship as RelationshipValue,
    suggestedRelationship: (row.suggested_relationship ?? null) as RelationshipValue | null,
    dayKey: row.day_key,
    confirmedAt: row.confirmed_at,
    locale: row.locale ?? null,
    timezoneSnapshot: row.timezone_snapshot,
    tzFallback: row.tz_fallback,
  };
}

const SELECT_COLS =
  "relationship, suggested_relationship, day_key, confirmed_at, locale, timezone_snapshot, tz_fallback";

export type CommitTodayRelationshipResult =
  | { status: "created"; commitment: TodayCommitment }
  | { status: "exists"; commitment: TodayCommitment }
  | { status: "locked"; commitment: TodayCommitment };

/**
 * Commit `relationship` for the user's canonical BTY day (first-commit-wins, immutable).
 * @throws if persistence is unavailable or an existing row cannot be read back — the caller must
 *         translate that into a retryable failure and NEVER fabricate a confirmation.
 */
export async function commitTodayRelationship(
  admin: SupabaseClient,
  userId: string,
  instant: Date,
  relationship: RelationshipValue,
  opts: {
    suggestedRelationship: RelationshipValue | null;
    locale: string | null;
    deviceTz: string | null | undefined;
  },
): Promise<CommitTodayRelationshipResult> {
  const { timezone, tzFallback } = await resolveUserTzContext(admin, userId, opts.deviceTz);
  const dayKey = userDayKey(instant, timezone, 5);

  // Insert-only, first-commit-wins. UNIQUE(user_id, day_key) + ON CONFLICT DO NOTHING → RETURNING
  // rows only when THIS call actually inserted (mirrors ensureUserDay's isNew detection).
  const { data: insertedRows, error: insertError } = await admin
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        day_key: dayKey,
        relationship,
        suggested_relationship: opts.suggestedRelationship,
        confirmed_at: instant.toISOString(),
        locale: opts.locale,
        timezone_snapshot: timezone,
        tz_fallback: tzFallback,
      },
      { onConflict: "user_id,day_key", ignoreDuplicates: true },
    )
    .select(SELECT_COLS);

  if (insertError) throw insertError;

  if (Array.isArray(insertedRows) && insertedRows.length > 0) {
    const created = toCommitment(insertedRows[0] as CommitmentRow);
    if (!created) throw new Error("COMMIT_INSERT_UNREADABLE");
    return { status: "created", commitment: created };
  }

  // A row already existed for (user, day_key) — read the immutable existing commitment.
  const { data: existingRow, error: readError } = await admin
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("day_key", dayKey)
    .maybeSingle();

  if (readError) throw readError;
  const existing = toCommitment(existingRow as CommitmentRow | null);
  if (!existing) throw new Error("COMMIT_EXISTING_UNREADABLE"); // race/inconsistency → retryable

  return { status: existing.relationship === relationship ? "exists" : "locked", commitment: existing };
}

/** Read the user's commitment for the current canonical BTY day, or null if none. */
export async function getTodayCommitment(
  admin: SupabaseClient,
  userId: string,
  instant: Date,
  deviceTz: string | null | undefined,
): Promise<TodayCommitment | null> {
  const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
  const dayKey = userDayKey(instant, timezone, 5);
  const { data, error } = await admin
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("day_key", dayKey)
    .maybeSingle();
  if (error) throw error;
  return toCommitment(data as CommitmentRow | null);
}
