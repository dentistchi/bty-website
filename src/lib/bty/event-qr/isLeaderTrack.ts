import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Leader-track gate read — single source for "is this user approved to the leader
 * track?". The flag lives on `leadership_engine_state.is_leader_track` (set by the
 * admin approve-leader-track path); there was no reusable helper before this, and
 * Reality Event creation is the **first user-facing consumer** gating on it.
 *
 * `is_leader_track` is admin-managed state, so read it with a **service-role**
 * client (after the route has already authenticated the user) rather than relying
 * on a self-read RLS policy. Fails closed: a missing row or query error → `false`.
 */
export async function isLeaderTrack(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("leadership_engine_state")
    .select("is_leader_track")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { is_leader_track?: boolean }).is_leader_track === true;
}
