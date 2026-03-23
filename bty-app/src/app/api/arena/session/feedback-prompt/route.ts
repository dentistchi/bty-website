import { NextRequest, NextResponse } from "next/server";
import { getFeedbackPrompt } from "@/engine/scenario/scenario-feedback.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * GET /api/arena/session/feedback-prompt — oldest pending reflection prompt for {@link ScenarioSessionShell}.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const prompt = await getFeedbackPrompt(user.id, supabase);
    const res = NextResponse.json({ ok: true, prompt });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "feedback_prompt_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
