import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

const YES_DELTAS = { trust_delta: 1, courage_delta: 1, self_narrative_delta: 1 };
const NO_DELTAS = { trust_delta: 0, courage_delta: 0, self_narrative_delta: 0 };

/**
 * POST /api/bty/action-contract/followup
 * Body: { contractId: uuid, startedConversation: boolean, first30Seconds?: string }
 */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const out = NextResponse.json({ error: "invalid_json" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const b = body as Record<string, unknown>;
  const contractId = typeof b.contractId === "string" ? b.contractId.trim() : "";
  const startedConversation = b.startedConversation === true;
  const first30Seconds =
    typeof b.first30Seconds === "string" ? b.first30Seconds : startedConversation ? "" : null;

  if (!contractId) {
    const out = NextResponse.json({ error: "missing_contract_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: row, error: loadErr } = await supabase
    .from("bty_action_contracts")
    .select("id, user_id, committed_at, status")
    .eq("id", contractId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) {
    const out = NextResponse.json({ error: loadErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (!row) {
    const out = NextResponse.json(
      { error: "contract_not_found", message: "No action contract for this id and user." },
      { status: 404 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const st = String((row as { status?: string }).status ?? "");
  if (st === "draft" || !(row as { committed_at?: string | null }).committed_at) {
    const out = NextResponse.json({ error: "contract_not_committed" }, { status: 422 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: dup, error: dupErr } = await supabase
    .from("bty_action_contract_followups")
    .select("id")
    .eq("contract_id", contractId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (dupErr) {
    const out = NextResponse.json({ error: dupErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (dup) {
    const out = NextResponse.json({ error: "followup_already_recorded" }, { status: 409 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const deltas = startedConversation ? YES_DELTAS : NO_DELTAS;
  const { data: inserted, error: insErr } = await supabase
    .from("bty_action_contract_followups")
    .insert({
      contract_id: contractId,
      user_id: user.id,
      started_conversation: startedConversation,
      first_30_seconds: startedConversation ? first30Seconds : null,
      ...deltas,
    })
    .select("id, started_conversation, first_30_seconds, trust_delta, courage_delta, self_narrative_delta, created_at")
    .single();

  if (insErr) {
    const out = NextResponse.json({ error: insErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({ ok: true, followup: inserted });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
