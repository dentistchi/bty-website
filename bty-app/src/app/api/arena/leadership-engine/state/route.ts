import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  getLeadershipEngineState,
  ensureLeadershipEngineState,
} from "@/lib/bty/leadership-engine/state-service";

/**
 * GET /api/arena/leadership-engine/state
 * Returns current Stage for the authenticated user. UI displays only; no computation in UI.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  await ensureLeadershipEngineState(supabase, user.id);
  const state = await getLeadershipEngineState(supabase, user.id);

  const res = NextResponse.json({
    currentStage: state.currentStage,
    stageName: state.stageName,
    forcedResetTriggeredAt: state.forcedResetTriggeredAt,
    resetDueAt: state.resetDueAt,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
