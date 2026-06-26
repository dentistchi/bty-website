import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifyArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

export const runtime = "nodejs";

/**
 * GET /api/arena/action-contract/by-token?aalo=<signed token>
 *
 * MVE-D2 Phase 2 (Ruling 3) — witness pre-confirm read. Returns the action the
 * actor promised + its status so the witness screen can show
 * "오늘의 약속 → 행동 → 사람의 확인" BEFORE a human presses Confirm.
 *
 * READ-ONLY: no status transition, no QR validation. QR validation remains
 * exclusive to POST /api/arena/leadership-engine/qr/validate (CLAUDE.md invariant).
 * Guest-safe (no `requireUser`) — the signed token is the authorization; the row
 * is scoped to the token's `userId` so no other user's contract can be read.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("aalo")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const verified = verifyArenaActionLoopToken(token);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 });
  }

  const { userId, contractId } = verified.payload;
  if (!contractId || contractId.trim() === "") {
    return NextResponse.json({ ok: false, error: "missing_contract_id" }, { status: 422 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl.trim() || !serviceKey.trim()) {
    return NextResponse.json({ ok: false, error: "server_config_error" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error } = await admin
    .from("bty_action_contracts")
    .select("contract_description, status")
    .eq("id", contractId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    contractDescription:
      typeof row.contract_description === "string" ? row.contract_description : "",
    status: typeof row.status === "string" ? row.status : null,
  });
}
