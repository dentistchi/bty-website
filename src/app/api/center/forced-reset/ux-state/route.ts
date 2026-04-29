/**
 * GET /api/center/forced-reset/ux-state — Stage 4 무결성 리셋 창·잠금 표시용.
 * @returns 200 { lockout_start, locked, current_stage, reset_due_at }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getLeadershipEngineState } from "@/lib/bty/leadership-engine/state-service";
import { getResetDueAt } from "@/domain/leadership-engine/forced-reset";
import { STAGE_4 } from "@/domain/leadership-engine/stages";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const s = await getLeadershipEngineState(supabase, user.id);
    const now = new Date();

    const lockoutStart =
      s.currentStage === STAGE_4 && s.forcedResetTriggeredAt != null ? s.forcedResetTriggeredAt : null;

    const resetDueAt =
      lockoutStart != null ? getResetDueAt(new Date(lockoutStart)).toISOString() : null;

    const locked =
      lockoutStart != null && resetDueAt != null && now.getTime() < new Date(resetDueAt).getTime();

    return NextResponse.json({
      lockout_start: lockoutStart,
      locked,
      current_stage: s.currentStage,
      reset_due_at: resetDueAt,
    });
  } catch (e) {
    console.error("[center/forced-reset/ux-state]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
