import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toDisplayState,
  type BtyActionContractStatus,
  type BtyActionContractVerificationMode,
} from "@/domain/action-contract";

/** My Page Action Hub — `display_state` from domain {@link toDisplayState}; `deadline_at` mirrors DB column. */
export type MyPageOpenActionContractUi = {
  id: string;
  /** Arena run id for POST QR / secure-link bodies. */
  session_id: string | null;
  action_text: string;
  deadline_at: string;
  verification_type: BtyActionContractVerificationMode;
  display_state: "pending" | "completed" | "missed" | "blocked";
  completion_method: "qr" | "link" | null;
  completed_at?: string;
};

function asVerificationMode(v: string | null | undefined): BtyActionContractVerificationMode {
  if (v === "qr" || v === "link" || v === "hybrid") return v;
  return "hybrid";
}

function asCompletionMethod(v: string | null | undefined): "qr" | "link" | null {
  if (v === "qr" || v === "link") return v;
  return null;
}

/**
 * Open or latest terminal action contract for My Page GET state.
 * Pending + `required` → {@link toDisplayState} may yield `blocked`.
 */
export async function fetchOpenActionContractForMyPage(
  supabase: SupabaseClient,
  userId: string,
): Promise<MyPageOpenActionContractUi | null> {
  const nowMs = Date.now();

  const { data: pending, error: pendingErr } = await supabase
    .from("bty_action_contracts")
    .select(
      "id, contract_description, deadline_at, verification_mode, status, completion_method, completed_at, required, session_id",
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("deadline_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingErr) return null;

  if (pending) {
    const rowP = pending as Record<string, unknown>;
    const deadlineMs = Date.parse(String(rowP.deadline_at ?? ""));
    if (!Number.isFinite(deadlineMs) || deadlineMs <= nowMs) {
      const { error: expireErr } = await supabase
        .from("bty_action_contracts")
        .update({ status: "missed" })
        .eq("id", String(rowP.id))
        .eq("status", "pending");
      if (expireErr) {
        console.error("[openActionContractForMyPage] inline expiry failed", expireErr.message);
      }
      return null;
    }
  }

  if (pending) {
    const row = pending as Record<string, unknown>;
    const required = row.required === true;
    const display_state = toDisplayState("pending", required) as MyPageOpenActionContractUi["display_state"];
    return {
      id: String(row.id),
      session_id: row.session_id != null ? String(row.session_id) : null,
      action_text: String(row.contract_description ?? ""),
      deadline_at: String(row.deadline_at),
      verification_type: asVerificationMode(row.verification_mode as string),
      display_state,
      completion_method: null,
    };
  }

  const { data: awaitingVerify, error: avErr } = await supabase
    .from("bty_action_contracts")
    .select(
      "id, contract_description, deadline_at, verification_mode, status, completion_method, completed_at, required, session_id, validation_approved_at, verified_at",
    )
    .eq("user_id", userId)
    .eq("status", "approved")
    .not("validation_approved_at", "is", null)
    .is("verified_at", null)
    .order("deadline_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (avErr) return null;

  if (awaitingVerify) {
    const rowAv = awaitingVerify as Record<string, unknown>;
    const deadlineMsAv = Date.parse(String(rowAv.deadline_at ?? ""));
    if (!Number.isFinite(deadlineMsAv) || deadlineMsAv <= nowMs) {
      const { error: expireErr } = await supabase
        .from("bty_action_contracts")
        .update({ status: "missed" })
        .eq("id", String(rowAv.id))
        .eq("status", "approved");
      if (expireErr) {
        console.error("[openActionContractForMyPage] awaiting-verify expiry failed", expireErr.message);
      }
    } else {
      const display_state = toDisplayState("pending", false) as MyPageOpenActionContractUi["display_state"];
      return {
        id: String(rowAv.id),
        session_id: rowAv.session_id != null ? String(rowAv.session_id) : null,
        action_text: String(rowAv.contract_description ?? ""),
        deadline_at: String(rowAv.deadline_at),
        verification_type: asVerificationMode(rowAv.verification_mode as string),
        display_state,
        completion_method: null,
      };
    }
  }

  const { data: terminalRows, error: terminalErr } = await supabase
    .from("bty_action_contracts")
    .select(
      "id, contract_description, deadline_at, verification_mode, status, completion_method, completed_at, session_id, verified_at",
    )
    .eq("user_id", userId)
    .in("status", ["approved", "completed", "missed"])
    .order("created_at", { ascending: false })
    .limit(24);

  if (terminalErr || !terminalRows?.length) return null;

  const terminal = terminalRows.find((r) => {
    const tr = r as Record<string, unknown>;
    const s = String(tr.status ?? "");
    if (s === "missed" || s === "completed") return true;
    if (s === "approved" && tr.verified_at != null) return true;
    return false;
  });

  if (!terminal) return null;

  const row = terminal as Record<string, unknown>;
  const st = row.status as string;
  if (st !== "approved" && st !== "completed" && st !== "missed") return null;

  const status = (st === "completed" ? "approved" : st) as BtyActionContractStatus;
  const display_state = toDisplayState(status, false) as MyPageOpenActionContractUi["display_state"];

  return {
    id: String(row.id),
    session_id: row.session_id != null ? String(row.session_id) : null,
    action_text: String(row.contract_description ?? ""),
    deadline_at: String(row.deadline_at),
    verification_type: asVerificationMode(row.verification_mode as string),
    display_state,
    completion_method: asCompletionMethod(row.completion_method as string),
    completed_at: row.completed_at != null ? String(row.completed_at) : undefined,
  };
}
