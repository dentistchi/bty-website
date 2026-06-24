import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/action-contracts/pending
 *
 * User-wide, side-effect-free list of the caller's unclosed action contracts
 * (`verified_at IS NULL`). Pure read — performs NO status transition (e.g. the
 * expired→missed update owned by session/next) and calls no session/next path.
 *
 * Auth: user-scoped Supabase client (requireUser); filtered by the caller's id.
 * Never uses service-role — RLS + the explicit `user_id` filter both apply.
 *
 * Footgun note: exposes the canonical `verification_type` (semantic kind), NOT
 * the `verification_mode` channel column (the CHECK-workaround that holds
 * 'hybrid'). The action description lives in the `contract_description` column;
 * it is surfaced as `action_text` (consistent with the session/next contract shape).
 * `session_id` IS the arena run id (table comment: "session_id = arena_runs.run_id");
 * there is no separate `run_id` column to expose.
 */
type PendingContractRow = {
  id: string;
  status: string;
  contract_description: string;
  deadline_at: string;
  verification_type: string | null;
  session_id: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { data, error } = await supabase
    .from("bty_action_contracts")
    .select("id, status, contract_description, deadline_at, verification_type, session_id, created_at")
    .eq("user_id", user.id)
    .is("verified_at", null)
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    const out = NextResponse.json({ error: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const contracts = ((data ?? []) as PendingContractRow[]).map((c) => ({
    id: c.id,
    status: c.status,
    action_text: c.contract_description,
    deadline_at: c.deadline_at,
    verification_type: c.verification_type,
    session_id: c.session_id,
    created_at: c.created_at,
  }));

  const out = NextResponse.json({ contracts });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
