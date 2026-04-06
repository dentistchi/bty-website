import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/cron/action-contract-escalation-expire
 * VALIDATOR_ARCHITECTURE_V1 §3.5 — 72h SLA: open escalations past expires_at → contract pending (not force-approve).
 * Secured by CRON_SECRET (Authorization: Bearer or x-cron-secret).
 */
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret")?.trim();
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration (no admin client)" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { data: due, error: selErr } = await admin
    .from("bty_action_contract_escalations")
    .select("id, contract_id")
    .eq("status", "open")
    .lt("expires_at", nowIso);

  if (selErr) {
    console.error("[action-contract-escalation-expire] select failed", selErr.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let expired = 0;
  for (const row of due ?? []) {
    const escId = String(row.id);
    const contractId = String(row.contract_id);

    const { error: upEsc } = await admin
      .from("bty_action_contract_escalations")
      .update({ status: "expired" })
      .eq("id", escId)
      .eq("status", "open");

    if (upEsc) {
      console.error("[action-contract-escalation-expire] escalation update failed", upEsc.message);
      continue;
    }

    const { error: upC } = await admin
      .from("bty_action_contracts")
      .update({ status: "pending", escalated_at: null })
      .eq("id", contractId)
      .eq("status", "escalated");

    if (upC) {
      console.error("[action-contract-escalation-expire] contract update failed", upC.message);
      continue;
    }

    expired += 1;
  }

  return NextResponse.json({ ok: true, expired });
}
