import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { completeQuickAction } from "@/lib/bty/arena/quickModeService";

export const runtime = "nodejs";

/** POST /api/arena/quick/complete — record action completion and award XP. */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const body = await req.json().catch(() => ({}));
  const scenarioId = typeof body?.scenarioId === "string" ? body.scenarioId.trim() : "";
  const axis = typeof body?.axis === "string" ? body.axis.trim() : undefined;
  const actionCompleted = body?.actionCompleted === true;

  if (!scenarioId) {
    const out = NextResponse.json({ error: "scenarioId_required" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const result = await completeQuickAction(supabase, user.id, scenarioId, {
    axis,
    actionCompleted,
  });

  if (!result.ok) {
    const out = NextResponse.json({ error: result.error }, { status: 500 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const out = NextResponse.json({
    ok: true,
    xpAwarded: result.xpAwarded,
    abandonmentTriggered: result.abandonmentTriggered,
  });
  copyCookiesAndDebug(base, out, req, false);
  return out;
}
