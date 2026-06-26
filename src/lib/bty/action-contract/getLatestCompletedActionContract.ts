import type { SupabaseClient } from "@supabase/supabase-js";

/** The actor's most recently verified action contract — D2 actor-return completion surface. */
export type LatestCompletedActionContract = {
  id: string;
  contractDescription: string;
  verifiedAt: string;
};

/**
 * D2 actor-return detection (read-only).
 *
 * Rule (Commander-specified): user_id = current actor, verified_at IS NOT NULL,
 * order by verified_at desc, limit 1. Intentionally does NOT use `open_action_contract`
 * because that view excludes completed (verified) contracts. RLS (`select_own`) + the
 * explicit `user_id` filter both scope this to the caller.
 */
export async function getLatestCompletedActionContract(
  supabase: SupabaseClient,
  userId: string,
): Promise<LatestCompletedActionContract | null> {
  const { data, error } = await supabase
    .from("bty_action_contracts")
    .select("id, contract_description, verified_at")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: String((data as { id: string }).id),
    contractDescription:
      typeof (data as { contract_description?: unknown }).contract_description === "string"
        ? (data as { contract_description: string }).contract_description
        : "",
    verifiedAt:
      typeof (data as { verified_at?: unknown }).verified_at === "string"
        ? (data as { verified_at: string }).verified_at
        : "",
  };
}
