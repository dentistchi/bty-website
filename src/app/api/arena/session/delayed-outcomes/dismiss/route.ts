/**
 * POST /api/arena/session/delayed-outcomes/dismiss
 * Body: `{ "pendingOutcomeId": "<uuid>" }` — {@link markDueOutcomesDelivered} + {@link scheduleOutcomes}.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  markDueOutcomesDelivered,
  scheduleOutcomes,
} from "@/engine/scenario/delayed-outcome-trigger.service";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { pendingOutcomeId?: unknown; outcomeId?: unknown };
  try {
    body = (await req.json()) as { pendingOutcomeId?: unknown; outcomeId?: unknown };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const pendingOutcomeId =
    (typeof body.outcomeId === "string" ? body.outcomeId.trim() : "") ||
    (typeof body.pendingOutcomeId === "string" ? body.pendingOutcomeId.trim() : "");
  if (!pendingOutcomeId) {
    return NextResponse.json({ error: "MISSING_PENDING_OUTCOME_ID" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
  }

  try {
    await markDueOutcomesDelivered(user.id, [pendingOutcomeId], admin);
    await scheduleOutcomes(user.id, admin);
    const res = NextResponse.json({ ok: true });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
