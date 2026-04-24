import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { completeArenaRunAfterContractVerification } from "@/lib/bty/action-contract/actionContractLifecycle.server";
import { logActionContractActorTrace } from "@/lib/bty/action-contract/arenaRunActor.server";
import { verifyArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";
import { onArenaRunCompleteVerified } from "@/lib/bty/level-engine/arenaLevelRecords";

export const runtime = "nodejs";

/**
 * POST /api/arena/leadership-engine/qr/validate
 * Body: { arenaActionLoopToken: string, clientScanAtIso?: string }
 *
 * Witness / any caller may POST — **no** `requireUser`. The token’s **`userId`** must equal **`arena_runs.user_id`** for **`sessionId`** (run id); otherwise **409** `run_actor_token_mismatch`. DB updates use service role keyed by verified token payload.
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  let runOwnerId: string | null = null;
  if (supabaseUrl.trim() && serviceKey.trim()) {
    const adminForActor = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: runActorRow } = await adminForActor
      .from("arena_runs")
      .select("user_id")
      .eq("run_id", sessionId)
      .maybeSingle();
    const uid = (runActorRow as { user_id?: string } | null)?.user_id;
    runOwnerId = typeof uid === "string" && uid.trim() !== "" ? uid.trim() : null;
  }

  logActionContractActorTrace("qr_validate", {
    incoming_actor_user_id: userId,
    source_run_id: sessionId,
    resolved_run_owner_user_id: runOwnerId,
    contract_user_id: contractId ?? null,
  });
  if (runOwnerId != null && runOwnerId !== userId) {
    return NextResponse.json({ ok: false, error: "run_actor_token_mismatch" }, { status: 409 });
  }

  if (contractId) {
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

    const finalized = await completeArenaRunAfterContractVerification(adminClient, {
      userId,
      runId: sessionId,
      verifiedAtIso: verifiedAt,
    });
    if (!finalized.runUpdated) {
      console.error("[qr/validate] arena_runs completion after contract verify failed");
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
