/**
 * Aggregates repeated {@link flag_type} into {@link user_behavior_pattern_state}.
 * Keys: `flag_total:{flag}`, `flag_consecutive:{flag}`.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

function totalKey(flagType: string): string {
  return `flag_total:${flagType}`;
}

function consecutiveKey(flagType: string): string {
  return `flag_consecutive:${flagType}`;
}

async function fetchPatternRow(
  userId: string,
  patternKey: string,
): Promise<{ total_count?: number; consecutive_count?: number } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("user_behavior_pattern_state")
    .select("total_count, consecutive_count")
    .eq("user_id", userId)
    .eq("pattern_key", patternKey)
    .maybeSingle();
  if (error) {
    console.warn("[fetchPatternRow]", error.message);
    return null;
  }
  return data as { total_count?: number; consecutive_count?: number } | null;
}

/**
 * After a memory event row exists, updates totals and consecutive streak for `flagType`.
 */
export async function aggregateRepeatedFlagTypes(
  userId: string,
  flagType: string,
  playedAt: Date,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { data: lastTwo, error: qErr } = await admin
    .from("user_behavior_memory_events")
    .select("flag_type")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(2);

  if (qErr) {
    console.warn("[aggregateRepeatedFlagTypes] read events", qErr.message);
    return;
  }

  const rows = (lastTwo ?? []) as { flag_type?: string }[];
  const previous = rows.length > 1 ? rows[1]?.flag_type : null;
  const prevTotalRow = await fetchPatternRow(userId, totalKey(flagType));
  const nextTotal = (prevTotalRow?.total_count ?? 0) + 1;

  let nextConsecutive = 1;
  if (previous === flagType) {
    const prevConsecRow = await fetchPatternRow(userId, consecutiveKey(flagType));
    nextConsecutive = (prevConsecRow?.consecutive_count ?? 0) + 1;
  }

  const nowIso = playedAt.toISOString();
  const base = {
    user_id: userId,
    last_flag_type: flagType,
    last_occurred_at: nowIso,
    updated_at: nowIso,
  };

  const { error: u1 } = await admin.from("user_behavior_pattern_state").upsert(
    {
      ...base,
      pattern_key: totalKey(flagType),
      total_count: nextTotal,
      consecutive_count: 0,
      meta: {},
    },
    { onConflict: "user_id,pattern_key" },
  );

  if (u1) console.warn("[aggregateRepeatedFlagTypes] upsert total", u1.message);

  const { error: u2 } = await admin.from("user_behavior_pattern_state").upsert(
    {
      ...base,
      pattern_key: consecutiveKey(flagType),
      total_count: 0,
      consecutive_count: nextConsecutive,
      meta: { streak_for_flag: flagType },
    },
    { onConflict: "user_id,pattern_key" },
  );

  if (u2) console.warn("[aggregateRepeatedFlagTypes] upsert consecutive", u2.message);
}
