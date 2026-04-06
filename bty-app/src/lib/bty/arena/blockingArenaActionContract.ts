import type { SupabaseClient } from "@supabase/supabase-js";

/** Row shape for 409 `action_contract_pending` responses and middleware gate. */
export type BlockingArenaContractRow = {
  id: string;
  contract_description: string;
  deadline_at: string;
  verification_mode: string;
  created_at: string;
  status: string;
};

/**
 * `ENGINE_ARCHITECTURE_V1.md` §6.3 — open pipeline contracts that block new Arena play.
 * `submitted` / `escalated` (any), or `pending` with `deadline_at` in the future.
 */
export async function fetchBlockingArenaContractForSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<BlockingArenaContractRow | null> {
  const nowIso = new Date().toISOString();

  const { data: openSe, error: errSe } = await supabase
    .from("bty_action_contracts")
    .select("id, contract_description, deadline_at, verification_mode, created_at, status")
    .eq("user_id", userId)
    .in("status", ["submitted", "escalated"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errSe) {
    console.error("[arena] blocking contract query (submitted/escalated)", errSe.message);
  } else if (openSe) {
    return openSe as BlockingArenaContractRow;
  }

  const { data: openPending, error: errP } = await supabase
    .from("bty_action_contracts")
    .select("id, contract_description, deadline_at, verification_mode, created_at, status")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gt("deadline_at", nowIso)
    .order("deadline_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errP) {
    console.error("[arena] blocking contract query (pending)", errP.message);
    return null;
  }

  if (openPending) {
    return openPending as BlockingArenaContractRow;
  }

  const { data: awaitingVerify, error: errV } = await supabase
    .from("bty_action_contracts")
    .select("id, contract_description, deadline_at, verification_mode, created_at, status")
    .eq("user_id", userId)
    .eq("status", "approved")
    .not("validation_approved_at", "is", null)
    .is("verified_at", null)
    .gt("deadline_at", nowIso)
    .order("deadline_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errV) {
    console.error("[arena] blocking contract query (awaiting verify)", errV.message);
    return null;
  }

  return awaitingVerify ? (awaitingVerify as BlockingArenaContractRow) : null;
}

export async function userHasBlockingArenaActionContract(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const row = await fetchBlockingArenaContractForSession(supabase, userId);
  return row != null;
}
