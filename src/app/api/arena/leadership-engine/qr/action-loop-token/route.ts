import { NextRequest, NextResponse } from "next/server";
import { logActionContractActorTrace } from "@/lib/bty/action-contract/arenaRunActor.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import {
  ARENA_ACTION_LOOP_TOKEN_MAX_AGE_MS,
  signArenaActionLoopToken,
} from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

export const runtime = "nodejs";

type ActionContractTokenRow = {
  id: string;
  user_id: string;
  session_id?: string | null;
  run_id?: string | null;
  arena_session_id?: string | null;
  status?: string | null;
  validation_approved_at?: string | null;
  verified_at?: string | null;
};

/**
 * POST /api/arena/leadership-engine/qr/action-loop-token
 * Body: { runId?: string; contractId?: string } — resolve pending contract by session_id(run) or contract id.
 * Returns { token, url } for QR / deep link (My Page commit flow).
 */
export async function POST(req: NextRequest) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const out = NextResponse.json({ error: "invalid_json" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const runIdInput =
    typeof body === "object" && body !== null && "runId" in body
      ? (body as { runId?: unknown }).runId
      : undefined;
  const contractIdInput =
    typeof body === "object" && body !== null && "contractId" in body
      ? (body as { contractId?: unknown }).contractId
      : undefined;
  const runIdStr = typeof runIdInput === "string" ? runIdInput.trim() : "";
  const contractIdStr = typeof contractIdInput === "string" ? contractIdInput.trim() : "";

  if (!runIdStr && !contractIdStr) {
    const out = NextResponse.json({ error: "missing_run_or_contract_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let contract: ActionContractTokenRow | null = null;
  if (contractIdStr) {
    const byId = await supabase
      .from("bty_action_contracts")
      .select("id, user_id, session_id, run_id, status, validation_approved_at, verified_at")
      .eq("id", contractIdStr)
      .maybeSingle();
    contract = (byId.data as ActionContractTokenRow | null) ?? null;
    if (!contract) {
      const out = NextResponse.json({ error: "contract_not_found" }, { status: 404 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  } else {
    let byRun = await supabase
      .from("bty_action_contracts")
      .select("id, user_id, session_id, run_id, status, validation_approved_at, verified_at")
      .eq("user_id", user.id)
      .eq("session_id", runIdStr)
      .in("status", ["pending"])
      .maybeSingle();

    if (!byRun.data) {
      byRun = await supabase
        .from("bty_action_contracts")
        .select("id, user_id, session_id, run_id, status, validation_approved_at, verified_at")
        .eq("user_id", user.id)
        .eq("session_id", runIdStr)
        .eq("status", "approved")
        .not("validation_approved_at", "is", null)
        .is("verified_at", null)
        .maybeSingle();
    }
    contract = (byRun.data as ActionContractTokenRow | null) ?? null;
    if (!contract) {
      const out = NextResponse.json({ error: "no_pending_contract" }, { status: 409 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  const contractUserId = String(contract.user_id ?? "");
  if (!contractUserId || contractUserId !== user.id) {
    const out = NextResponse.json({ error: "contract_user_mismatch" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const status = String(contract.status ?? "");
  const approvedAwaiting =
    (status === "approved" || status === "submitted") &&
    contract.validation_approved_at != null &&
    contract.verified_at == null;
  if (status !== "pending" && !approvedAwaiting) {
    const out = NextResponse.json({ error: "contract_not_pending" }, { status: 409 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const resolvedRunId =
    String(contract.session_id ?? "").trim() ||
    String(contract.arena_session_id ?? "").trim() ||
    String(contract.run_id ?? "").trim() ||
    runIdStr ||
    null;
  const tokenSessionId = resolvedRunId ?? `contract:${contract.id}`;

  logActionContractActorTrace("action_loop_token", {
    incoming_actor_user_id: user.id,
    source_run_id: tokenSessionId,
    resolved_auth_user_id: user.id,
    contract_user_id: contractUserId,
  });

  let token: string;
  try {
    token = signArenaActionLoopToken({
      sessionId: tokenSessionId,
      userId: contractUserId,
      actionId: resolvedRunId ? `arena_action_loop:${resolvedRunId}` : `arena_action_loop:contract:${contract.id}`,
      issuedAt: Date.now(),
      contractId: contract.id,
    });
  } catch (err) {
    console.error(
      "[action-loop-token] mint failed",
      {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        runId: tokenSessionId,
        userId: user.id,
        hasSecret: !!process.env.ARENA_ACTION_LOOP_QR_SECRET,
        hasCronSecret: !!process.env.CRON_SECRET,
      },
    );
    const out = NextResponse.json({ error: "token_mint_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const localeRaw = req.nextUrl.searchParams.get("locale");
  const locale = localeRaw === "ko" ? "ko" : "en";

  const url =
    `${origin}/${locale}/my-page` +
    `?arena_action_loop=commit` +
    `&aalo=${encodeURIComponent(token)}`;

  const expiresAt = new Date(Date.now() + ARENA_ACTION_LOOP_TOKEN_MAX_AGE_MS).toISOString();
  const res = NextResponse.json({
    ok: true,
    token,
    url,
    qrUrl: url,
    contractId: contract.id,
    runId: resolvedRunId,
    expiresAt,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
