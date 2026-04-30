import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import {
  ARENA_ACTION_LOOP_TOKEN_MAX_AGE_MS,
  signArenaActionLoopToken,
} from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

export const runtime = "nodejs";

type ContractRow = {
  id: string;
  user_id: string;
  session_id?: string | null;
  run_id?: string | null;
  status?: string | null;
  validation_approved_at?: string | null;
  verified_at?: string | null;
};

/**
 * POST /api/arena/action-contract/secure-link
 * Body: { run_id?: string; locale?: "en" | "ko" }
 * Returns { url: string } — deep-link the user can share instead of scanning a QR code.
 * Mints the same signed token as the QR route; the my-page commit flow handles both.
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

  const runIdRaw =
    typeof body === "object" && body !== null && "run_id" in body
      ? (body as { run_id?: unknown }).run_id
      : undefined;
  const localeRaw =
    typeof body === "object" && body !== null && "locale" in body
      ? (body as { locale?: unknown }).locale
      : undefined;
  const runIdStr = typeof runIdRaw === "string" ? runIdRaw.trim() : "";
  const locale = localeRaw === "ko" ? "ko" : "en";

  if (!runIdStr) {
    const out = NextResponse.json({ error: "missing_run_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  // Resolve contract by session_id (run_id). Accept pending or approved-but-unverified.
  let contract: ContractRow | null = null;
  const byPending = await supabase
    .from("bty_action_contracts")
    .select("id, user_id, session_id, run_id, status, validation_approved_at, verified_at")
    .eq("user_id", user.id)
    .eq("session_id", runIdStr)
    .in("status", ["pending"])
    .maybeSingle();

  if (byPending.data) {
    contract = byPending.data as ContractRow;
  } else {
    const byApproved = await supabase
      .from("bty_action_contracts")
      .select("id, user_id, session_id, run_id, status, validation_approved_at, verified_at")
      .eq("user_id", user.id)
      .eq("session_id", runIdStr)
      .eq("status", "approved")
      .not("validation_approved_at", "is", null)
      .is("verified_at", null)
      .maybeSingle();
    contract = (byApproved.data as ContractRow | null) ?? null;
  }

  if (!contract) {
    const out = NextResponse.json({ error: "no_pending_contract" }, { status: 409 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (String(contract.user_id ?? "") !== user.id) {
    const out = NextResponse.json({ error: "contract_user_mismatch" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const resolvedRunId =
    String(contract.session_id ?? "").trim() ||
    String(contract.run_id ?? "").trim() ||
    runIdStr;

  let token: string;
  try {
    token = signArenaActionLoopToken({
      sessionId: resolvedRunId,
      userId: user.id,
      actionId: `arena_action_loop:${resolvedRunId}`,
      issuedAt: Date.now(),
      contractId: contract.id,
    });
  } catch (err) {
    console.error("[secure-link] token mint failed", {
      error: err instanceof Error ? err.message : String(err),
      runId: resolvedRunId,
    });
    const out = NextResponse.json({ error: "token_mint_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const url =
    `${origin}/${locale}/my-page` +
    `?arena_action_loop=commit` +
    `&aalo=${encodeURIComponent(token)}`;

  const expiresAt = new Date(Date.now() + ARENA_ACTION_LOOP_TOKEN_MAX_AGE_MS).toISOString();
  const out = NextResponse.json({ ok: true, url, expiresAt });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
