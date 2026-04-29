import { NextRequest, NextResponse } from "next/server";
import { loadContractForUser, logActionContractLifecycle } from "@/lib/bty/action-contract/actionContractLifecycle.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

type Body = {
  who?: unknown;
  what?: unknown;
  how?: unknown;
  when?: unknown;
};

/**
 * PATCH /api/action-contracts/:id — update draft fields (who, what, how, when).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { id: contractId } = await ctx.params;
  if (!contractId || contractId.trim() === "") {
    const out = NextResponse.json({ error: "missing_contract_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    const out = NextResponse.json({ error: "invalid_json" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const contract = await loadContractForUser(supabase, contractId, user.id);
  if (!contract) {
    logActionContractLifecycle("patch_not_found", { contractId, userId: user.id });
    const out = NextResponse.json(
      { error: "contract_not_found", message: "No action contract for this id and user." },
      { status: 404 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (contract.status !== "draft") {
    const out = NextResponse.json(
      { error: "contract_not_editable", status: contract.status },
      { status: 409 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const who = typeof body.who === "string" ? body.who : undefined;
  const what = typeof body.what === "string" ? body.what : undefined;
  const how = typeof body.how === "string" ? body.how : undefined;
  const when = typeof body.when === "string" ? body.when : undefined;

  const patch: Record<string, string> = {};
  if (who !== undefined) patch.who = who;
  if (what !== undefined) patch.what = what;
  if (how !== undefined) patch.how = how;
  if (when !== undefined) patch.step_when = when;

  if (Object.keys(patch).length === 0) {
    const out = NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { error: upErr } = await supabase
    .from("bty_action_contracts")
    .update(patch)
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (upErr) {
    console.error("[PATCH action-contracts]", upErr.message);
    const out = NextResponse.json({ error: "update_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  logActionContractLifecycle("patch_draft", { contractId, userId: user.id });
  const out = NextResponse.json({ ok: true, contractId });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
