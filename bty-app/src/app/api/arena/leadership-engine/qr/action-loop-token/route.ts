import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { signArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

export const runtime = "nodejs";

/**
 * POST /api/arena/leadership-engine/qr/action-loop-token
 * Body: { runId: string } — Arena run id tied to pending `bty_action_contracts.session_id`.
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

  const runId = typeof body === "object" && body !== null && "runId" in body
    ? (body as { runId?: unknown }).runId
    : undefined;
  const runIdStr = typeof runId === "string" ? runId.trim() : "";

  if (!runIdStr) {
    const out = NextResponse.json({ error: "missing_run_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: contract } = await supabase
    .from("bty_action_contracts")
    .select("id, session_id, status")
    .eq("user_id", user.id)
    .eq("session_id", runIdStr)
    .eq("status", "pending")
    .maybeSingle();

  if (!contract) {
    const out = NextResponse.json({ error: "no_pending_contract" }, { status: 409 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let token: string;
  try {
    token = signArenaActionLoopToken({
      sessionId: runIdStr,
      userId: user.id,
      actionId: `arena_action_loop:${runIdStr}`,
      issuedAt: Date.now(),
      contractId: contract.id,
    });
  } catch {
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

  const res = NextResponse.json({ token, url });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
