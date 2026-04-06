import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifyArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";
import { onArenaRunCompleteVerified } from "@/lib/bty/level-engine/arenaLevelRecords";

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
      .select("id, user_id, session_id, status, validation_approved_at, verified_at")
      .eq("id", contractId)
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (selErr || !row) {
      return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 409 });
    }

    const legacyPending = row.status === "pending";
    const validatorApprovedAwaitingQr =
      row.status === "approved" &&
      row.validation_approved_at != null &&
      row.verified_at == null;

    if (!legacyPending && !validatorApprovedAwaitingQr) {
      return NextResponse.json({ ok: false, error: "contract_not_pending" }, { status: 409 });
    }

    const verifiedAt = new Date().toISOString();

    if (legacyPending) {
      const { error: upErr } = await adminClient
        .from("bty_action_contracts")
        .update({
          status: "approved",
          verified_at: verifiedAt,
          completed_at: verifiedAt,
        })
        .eq("id", contractId)
        .eq("user_id", userId)
        .eq("status", "pending");

      if (upErr) {
        return NextResponse.json({ ok: false, error: "contract_update_failed" }, { status: 500 });
      }
    } else {
      const { error: upErr } = await adminClient
        .from("bty_action_contracts")
        .update({
          verified_at: verifiedAt,
          completed_at: verifiedAt,
        })
        .eq("id", contractId)
        .eq("user_id", userId)
        .eq("status", "approved")
        .is("verified_at", null);

      if (upErr) {
        return NextResponse.json({ ok: false, error: "contract_update_failed" }, { status: 500 });
      }
    }

    const { error: runErr } = await adminClient
      .from("arena_runs")
      .update({ completion_state: "complete_verified" })
      .eq("run_id", sessionId)
      .eq("user_id", userId);

    if (runErr) {
      console.error("[qr/validate] arena_runs completion_state update failed", runErr.message);
    }

    const levelRes = await onArenaRunCompleteVerified(adminClient, userId);
    if (!levelRes.ok) {
      console.error("[qr/validate] level record update failed", levelRes.error);
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
