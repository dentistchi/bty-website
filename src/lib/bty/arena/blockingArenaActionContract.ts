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
 * ACTION_REQUIRED is reserved for `pending` contracts only.
 */
export async function fetchBlockingArenaContractForSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<BlockingArenaContractRow | null> {
  const nowIso = new Date().toISOString();

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
  return null;
}

/**
 * When a contract was just created (same request) and {@link fetchBlockingArenaContractForSession}
 * has not yet surfaced it, load by id for snapshot authority.
 */
export async function fetchBlockingContractRowByContractId(
  supabase: SupabaseClient,
  userId: string,
  contractId: string,
): Promise<BlockingArenaContractRow | null> {
  const cid = typeof contractId === "string" ? contractId.trim() : "";
  if (!cid) return null;
  const { data, error } = await supabase
    .from("bty_action_contracts")
    .select("id, contract_description, deadline_at, verification_mode, created_at, status")
    .eq("user_id", userId)
    .eq("id", cid)
    .maybeSingle();
  if (error) {
    console.error("[arena] blocking contract by id", error.message);
    return null;
  }
  return data ? (data as BlockingArenaContractRow) : null;
}

export async function userHasBlockingArenaActionContract(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const row = await fetchBlockingArenaContractForSession(supabase, userId);
  return row != null;
}
