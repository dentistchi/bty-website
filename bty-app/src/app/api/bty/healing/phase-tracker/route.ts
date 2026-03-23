/**
 * GET /api/bty/healing/phase-tracker — Center healing 4-phase stepper state.
 * POST — advance to next phase when `canAdvance` (domain diagnostics for current phase passed).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  advanceHealingPhase,
  getHealingPhaseTrackerState,
} from "@/lib/bty/center/healingPhaseService";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const state = await getHealingPhaseTrackerState(supabase, user.id);
  if ("error" in state) {
    return NextResponse.json({ error: state.error }, { status: 500 });
  }

  const res = NextResponse.json({
    ok: true,
    activePhase: state.activePhase,
    canAdvance: state.canAdvance,
    phaseComplete: state.phaseComplete,
    /** No individual scores — aggregate flags only. */
    inputsSummary: {
      assessmentCount: state.inputs.assessmentSubmissionCount,
      dearMeLetterCount: state.inputs.dearMeLetterCount,
      awakeningActsCompleted: state.inputs.completedAwakeningActIds.length,
    },
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const result = await advanceHealingPhase(supabase, user.id);
  if (!result.ok) {
    const status =
      result.error === "CRITERIA_NOT_MET"
        ? 400
        : result.error === "ALREADY_COMPLETE"
          ? 409
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  const res = NextResponse.json({
    ok: true,
    previousPhase: result.previousPhase,
    newPhase: result.newPhase,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
