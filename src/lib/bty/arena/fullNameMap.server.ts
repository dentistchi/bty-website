import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch arena_profiles.full_name (real name) for a set of user_ids.
 * Returns a Map of user_id → full_name, omitting users without a name set.
 * Used by admin screens to display the real name alongside email/user_id.
 */
export async function fetchFullNameMap(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  if (ids.length === 0) return map;

  const { data } = await admin
    .from("arena_profiles")
    .select("user_id, full_name")
    .in("user_id", ids);

  for (const r of (data ?? []) as Array<{ user_id: string; full_name: string | null }>) {
    if (r.full_name) map.set(r.user_id, r.full_name);
  }
  return map;
}
