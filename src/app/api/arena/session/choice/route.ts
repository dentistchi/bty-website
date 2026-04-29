import { NextRequest, NextResponse } from "next/server";
import { submitScenarioSessionChoice } from "@/lib/bty/arena/scenarioSessionChoice.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import type { ScenarioSubmitPayload } from "@/lib/bty/scenario/types";

export const runtime = "nodejs";

/**
 * POST /api/arena/session/choice — body `{ scenarioId, choiceId, locale? }` → engine + optional {@link handleChoiceConfirmed}.
 */
export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { scenarioId?: unknown; choiceId?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.trim() : "";
  const choiceId = typeof body.choiceId === "string" ? body.choiceId.trim() : "";
  const locale = body.locale === "ko" ? "ko" : "en";

  if (!scenarioId || !choiceId) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const payload: ScenarioSubmitPayload = {
    scenarioId,
    choiceId: choiceId as ScenarioSubmitPayload["choiceId"],
    locale,
  };

  try {
    const result = await submitScenarioSessionChoice(user.id, payload);
    const res = NextResponse.json(result);
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "submit_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
