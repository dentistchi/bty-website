import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Canonical actor for a run-scoped action contract is `arena_runs.user_id` (choice/run owner), not an unverified caller id.
 */
export async function loadArenaRunOwnerUserId(
  admin: SupabaseClient,
  runId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("arena_runs")
    .select("user_id")
    .eq("run_id", runId)
    .maybeSingle();

  if (error) {
    console.error("[arenaRunActor] load_run_owner_failed", { runId, message: error.message });
    return null;
  }
  const uid = (data as { user_id?: string } | null)?.user_id;
  return typeof uid === "string" && uid.trim() !== "" ? uid.trim() : null;
}

export function logActionContractActorTrace(
  step:
    | "ensureActionContractWithAdmin"
    | "ensureDraftActionContractWithAdmin"
    | "ensureEliteBindingActionCommitmentContract"
    | "action_loop_token"
    | "qr_validate"
    | "submit_validation"
    | "approve_action_contract"
    | "arena_event_choice"
    | "record_choice_confirmed",
  fields: {
    incoming_actor_user_id: string;
    source_run_id: string | null;
    resolved_run_owner_user_id?: string | null;
    resolved_auth_user_id?: string;
    contract_user_id?: string | null;
    inserted_bty_action_contracts_user_id?: string | null;
  },
): void {
  console.info(`[action_contract_actor] TEMP ${step}`, fields);
}
