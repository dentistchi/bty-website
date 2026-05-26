import type { SupabaseClient } from "@supabase/supabase-js";

/** Why the Arena gate denied entry — surfaced for telemetry / 403 debugging. */
export type MembershipDenyReason = "no_request" | "pending" | "rejected";

export type MembershipGateResult =
  | { approved: true }
  | { approved: false; status: 403; error: "MEMBERSHIP_REQUIRED"; reason: MembershipDenyReason };

/**
 * S2 Arena-entry gate — single source of truth.
 *
 * A user may create or be served an Arena scenario only with an approved
 * `arena_membership_requests` row. Called by every independent Arena entry
 * point (run, beginner-run, quick/start, n/session, session/next) so the gate
 * cannot be bypassed via an alternate mode. Unapproved users submit a request
 * at `/[locale]/my-page/team`; the middleware gate redirects them there.
 *
 * Reads via the caller's RLS-scoped client; the self-read policy
 * (`arena_membership_requests_select_own`) returns only the caller's own row.
 * Fails closed: a missing row or query error denies entry.
 */
export async function requireApprovedMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<MembershipGateResult> {
  const { data, error } = await supabase
    .from("arena_membership_requests")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { approved: false, status: 403, error: "MEMBERSHIP_REQUIRED", reason: "no_request" };
  }
  if (data.status === "approved") return { approved: true };
  return {
    approved: false,
    status: 403,
    error: "MEMBERSHIP_REQUIRED",
    reason: data.status === "rejected" ? "rejected" : "pending",
  };
}
