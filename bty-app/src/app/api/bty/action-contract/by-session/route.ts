import { NextRequest, NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * GET /api/bty/action-contract/by-session?sessionId=<arena run_id>
 * Own-row snapshot for Execution Gate (Step 7) and polling.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const sessionIdRaw = req.nextUrl.searchParams.get("sessionId") ?? "";
  const sessionId = arenaRunIdFromUnknown(sessionIdRaw.trim());
  if (sessionId === null) {
    const out = NextResponse.json({ error: "missing_or_invalid_session_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data, error } = await supabase
    .from("bty_action_contracts")
    .select(
      "id, status, who, what, how, step_when, raw_text, verified_at, validation_approved_at, submitted_at, escalated_at",
    )
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    const out = NextResponse.json({ error: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({ contract: data ?? null });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
