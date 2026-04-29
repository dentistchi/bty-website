import { NextRequest, NextResponse } from "next/server";
import { buildArenaContext } from "@/engine/integration/arena-context.injector";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * GET /api/arena/session/context — {@link buildArenaContext} for pattern banner + pending outcomes.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const ctx = await buildArenaContext(user.id, supabase);
    const res = NextResponse.json({
      ok: true,
      patternNarrative: ctx.patternNarrative,
      pendingOutcomeIds: ctx.pendingOutcomeIds,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "context_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
