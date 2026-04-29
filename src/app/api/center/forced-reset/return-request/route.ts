/**
 * POST /api/center/forced-reset/return-request — Center 진단 완료 후 Arena 복귀 게이트.
 * `center-return.flow` · `stage_4_completion` 전이.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  applyStageTransition,
  getLeadershipEngineState,
} from "@/lib/bty/leadership-engine/state-service";
import {
  runCenterReturnFlow,
  type ArenaAccessRestoredPayload,
} from "@/engine/forced-reset/center-return.flow";
import { createInitialLockoutState } from "@/engine/forced-reset/lockout.service";
import { STAGE_4 } from "@/domain/leadership-engine/stages";

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { allRequiredDiagnosticsPassed?: boolean };
    try {
      body = (await req.json()) as { allRequiredDiagnosticsPassed?: boolean };
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    if (body.allRequiredDiagnosticsPassed !== true) {
      return NextResponse.json({ error: "DIAGNOSTICS_INCOMPLETE" }, { status: 400 });
    }

    const le = await getLeadershipEngineState(supabase, user.id);
    if (le.currentStage !== STAGE_4) {
      return NextResponse.json({ error: "NOT_IN_STAGE_4" }, { status: 400 });
    }

    const transition = await applyStageTransition(supabase, user.id, "stage_4_completion");
    if (!transition.applied) {
      return NextResponse.json({ error: "STAGE_TRANSITION_FAILED" }, { status: 409 });
    }

    const occurredAt = new Date();
    const flow = runCenterReturnFlow(
      {
        userId: user.id,
        allRequiredDiagnosticsPassed: true,
        occurredAt,
      },
      createInitialLockoutState()
    );

    if (!flow.applied || !flow.arenaAccessRestored) {
      return NextResponse.json({ error: "FLOW_NOT_APPLIED" }, { status: 500 });
    }

    const payload: ArenaAccessRestoredPayload = flow.arenaAccessRestored;

    return NextResponse.json({
      ok: true,
      arena_access_restored: payload,
    });
  } catch (e) {
    console.error("[center/forced-reset/return-request]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
