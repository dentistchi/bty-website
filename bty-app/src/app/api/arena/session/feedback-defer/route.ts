import { NextRequest, NextResponse } from "next/server";
import { deferFeedbackPrompt } from "@/engine/scenario/scenario-feedback.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * POST /api/arena/session/feedback-defer — set `deferred_until` +24h on a queue row (snooze).
 */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const b = body as Record<string, unknown>;
  const queueId = typeof b.queueId === "string" ? b.queueId.trim() : "";
  if (!queueId) {
    const res = NextResponse.json({ ok: false, error: "MISSING_QUEUE_ID" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    await deferFeedbackPrompt(user.id, queueId, supabase);
    const res = NextResponse.json({ ok: true as const });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "defer_failed";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
