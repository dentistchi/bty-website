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

/**
 * Internal ref (id + relationship + dayKey + locale) for the current BTY day, or null. Used by the
 * Living Response layer to link its row (FK) — does NOT change the public commitment route/shape.
 */
export async function getTodayCommitmentRef(
  admin: SupabaseClient,
  userId: string,
  instant: Date,
  deviceTz: string | null | undefined,
): Promise<{ id: string; relationship: RelationshipValue; dayKey: string; locale: string | null } | null> {
  const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
  const dayKey = userDayKey(instant, timezone, 5);
  const { data, error } = await admin
    .from(TABLE)
    .select("id, relationship, day_key, locale")
    .eq("user_id", userId)
    .eq("day_key", dayKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { id: string; relationship: string; day_key: string; locale: string | null };
  return { id: String(row.id), relationship: row.relationship as RelationshipValue, dayKey: row.day_key, locale: row.locale ?? null };
}

/**
 * Read the user's recent PRIOR confirmed commitments (machine columns only: relationship + day_key),
 * most recent first, excluding today. Feeds the Living Continuity trajectory classifier. Fail-soft: a
 * degraded read returns [] (→ no trajectory expressed, never a fabricated one). No text/PII selected.
 */
export async function recentCommitments(
  admin: SupabaseClient,
  userId: string,
  todayDayKey: string,
  limit = 14,
): Promise<{ relationship: RelationshipValue; dayKey: string }[]> {
  try {
    const { data } = await admin
      .from(TABLE)
      .select("relationship, day_key")
      .eq("user_id", userId)
      .order("day_key", { ascending: false })
      .limit(limit + 1); // +1 so today's row (filtered below) never shortens the prior window
    const rows = (data ?? []) as { relationship: string; day_key: string }[];
    return rows
      .filter((r) => r.day_key < todayDayKey)
      .slice(0, limit)
      .map((r) => ({ relationship: r.relationship as RelationshipValue, dayKey: r.day_key }));
  } catch {
    return [];
  }
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
