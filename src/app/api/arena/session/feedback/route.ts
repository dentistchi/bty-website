import { NextRequest, NextResponse } from "next/server";
import { syncBehaviorPatterns } from "@/engine/integrity/behavior-pattern.service";
import { submitFeedback } from "@/engine/scenario/scenario-feedback.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * POST /api/arena/session/feedback — persist reflection text; refreshes {@link syncBehaviorPatterns}.
 */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const scenarioId = typeof b.scenarioId === "string" ? b.scenarioId.trim() : "";
  const responseText = typeof b.responseText === "string" ? b.responseText : "";
  if (!scenarioId) {
    return NextResponse.json({ ok: false, error: "MISSING_SCENARIO" }, { status: 400 });
  }

  try {
    await submitFeedback(user.id, scenarioId, responseText, supabase);
    await syncBehaviorPatterns(user.id);
    const res = NextResponse.json({ ok: true });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "submit_failed";
    const status =
      msg === "empty_response" ||
      msg === "response_too_short" ||
      msg === "no_pending_feedback_for_scenario"
        ? 400
        : 500;
    const res = NextResponse.json({ ok: false, error: msg }, { status });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
