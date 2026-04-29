import { NextRequest, NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import { resolveContractFollowupTrigger } from "@/lib/bty/action-contract/contractFollowupEligibility";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

type ContractRow = {
  id: string;
  session_id: string;
  committed_at: string | null;
};

/**
 * GET /api/bty/action-contract/pending-followup?sessionId=<arena run_id>
 * Returns the oldest committed contract without a follow-up row, if trigger (new session | 24h) applies.
 *
 * **Not used by `/bty-arena` UI** — Arena has no Action Contract surfaces; other clients may poll this.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const sessionIdRaw = req.nextUrl.searchParams.get("sessionId") ?? "";
  const currentSessionId = arenaRunIdFromUnknown(sessionIdRaw.trim());

  const { data: contracts, error: cErr } = await supabase
    .from("bty_action_contracts")
    .select("id, session_id, committed_at")
    .eq("user_id", user.id)
    .not("committed_at", "is", null)
    .neq("status", "draft")
    .order("committed_at", { ascending: true })
    .limit(50);

  if (cErr) {
    const out = NextResponse.json({ error: cErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const list = (contracts ?? []) as ContractRow[];
  if (list.length === 0) {
    const out = NextResponse.json({ followup: null });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const ids = list.map((c) => c.id);
  const { data: existing, error: fErr } = await supabase
    .from("bty_action_contract_followups")
    .select("contract_id")
    .eq("user_id", user.id)
    .in("contract_id", ids);

  if (fErr) {
    const out = NextResponse.json({ error: fErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const done = new Set(
    (existing ?? []).map((r: { contract_id?: string }) => r.contract_id).filter(Boolean) as string[],
  );

  const nowMs = Date.now();
  for (const row of list) {
    if (done.has(row.id)) continue;
    const committedAt = row.committed_at;
    if (!committedAt) continue;

    const trigger = resolveContractFollowupTrigger({
      contractSessionId: row.session_id,
      currentSessionId,
      committedAtIso: committedAt,
      nowMs,
    });

    if (!trigger) continue;

    const out = NextResponse.json({
      followup: {
        contractId: row.id,
        sessionId: row.session_id,
        committedAt,
        trigger,
      },
    });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const empty = NextResponse.json({ followup: null });
  copyCookiesAndDebug(base, empty, req, true);
  return empty;
}
