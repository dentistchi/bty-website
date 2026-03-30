import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifyArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

export const runtime = "nodejs";

/**
 * POST /api/arena/leadership-engine/qr/validate
 * Body: { arenaActionLoopToken: string, clientScanAtIso?: string }
 *
 * Witness / any signed-in user may call this — we do **not** require `session.user.id === token.userId`.
 * Contract owner is taken from the signed token; DB updates use service role keyed by token payload.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const arenaActionLoopToken =
    typeof body.arenaActionLoopToken === "string" ? body.arenaActionLoopToken.trim() : "";
  if (!arenaActionLoopToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const verified = verifyArenaActionLoopToken(arenaActionLoopToken);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 });
  }

  const { userId, sessionId, contractId } = verified.payload;

  if (contractId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    if (!supabaseUrl.trim() || !serviceKey.trim()) {
      console.error("[qr/validate] Missing Supabase admin credentials");
      return NextResponse.json({ error: "server_config_error" }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: row, error: selErr } = await adminClient
      .from("bty_action_contracts")
      .select("id, user_id, session_id, status")
      .eq("id", contractId)
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (selErr || !row) {
      return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 409 });
    }
    if (row.status !== "pending") {
      return NextResponse.json({ ok: false, error: "contract_not_pending" }, { status: 409 });
    }

    const { error: upErr } = await adminClient
      .from("bty_action_contracts")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", contractId)
      .eq("user_id", userId)
      .eq("status", "pending");

    if (upErr) {
      return NextResponse.json({ ok: false, error: "contract_update_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    userId,
    sessionId,
    contractId: contractId ?? null,
    clientScanAtIso: typeof body.clientScanAtIso === "string" ? body.clientScanAtIso : null,
  });
}
