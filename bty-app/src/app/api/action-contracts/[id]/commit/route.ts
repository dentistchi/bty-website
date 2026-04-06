import { NextRequest, NextResponse } from "next/server";
import { logActionContractLifecycle } from "@/lib/bty/action-contract/actionContractLifecycle.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

function fieldsComplete(row: {
  who: string | null;
  what: string | null;
  how: string | null;
  step_when: string | null;
}): boolean {
  const w = (row.who ?? "").trim();
  const x = (row.what ?? "").trim();
  const h = (row.how ?? "").trim();
  const wh = (row.step_when ?? "").trim();
  return w.length > 0 && x.length > 0 && h.length > 0 && wh.length > 0;
}

/**
 * POST /api/action-contracts/:id/commit — validate Step 6 fields; set status = committed.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { id: contractId } = await ctx.params;
  if (!contractId || contractId.trim() === "") {
    const out = NextResponse.json({ error: "missing_contract_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: row, error: loadErr } = await supabase
    .from("bty_action_contracts")
    .select("id, user_id, status, who, what, how, step_when, arena_scenario_id")
    .eq("id", contractId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) {
    console.error("[commit action-contract] load", loadErr.message);
    const out = NextResponse.json({ error: "load_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (!row) {
    logActionContractLifecycle("commit_not_found", { contractId, userId: user.id });
    const out = NextResponse.json(
      { error: "contract_not_found", message: "No action contract for this id and user." },
      { status: 404 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const st = String((row as { status?: string }).status ?? "");
  if (st !== "draft") {
    const out = NextResponse.json(
      { error: "contract_not_committable", status: st },
      { status: 409 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const r = row as {
    who: string | null;
    what: string | null;
    how: string | null;
    step_when: string | null;
    arena_scenario_id?: string | null;
  };

  if (!fieldsComplete(r)) {
    const out = NextResponse.json(
      { error: "commit_validation_failed", message: "who, what, how, and when must be non-empty." },
      { status: 422 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const committedAt = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("bty_action_contracts")
    .update({
      status: "committed",
      committed_at: committedAt,
    })
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (upErr) {
    console.error("[commit action-contract] update", upErr.message);
    const out = NextResponse.json({ error: "update_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const scenarioId = typeof r.arena_scenario_id === "string" ? r.arena_scenario_id : "";
  logActionContractLifecycle("commit", { contractId, userId: user.id, scenarioId });
  const out = NextResponse.json({ ok: true, contractId, status: "committed" as const });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
