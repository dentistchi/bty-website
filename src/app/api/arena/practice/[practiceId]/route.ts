import { NextResponse } from "next/server";
import { requireArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import {
  canAccessPractice,
  getPlayablePractice,
  getUserPracticeState,
} from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * GET /api/arena/practice/[practiceId] — the immutable snapshot to play + the
 * user's run state (for reload). Visible to the creator OR an approved member;
 * others get 403. 404 if missing/retired. Returns the frozen three-phase scenario
 * + source training lineage.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ practiceId: string }> }) {
  const gate = await requireArenaAccess();
  if (!gate.ok) return gate.response;
  const { userId, admin, isApprovedMember } = gate.access;
  const { practiceId } = await ctx.params;

  const practice = await getPlayablePractice(admin, practiceId);
  if (!practice) return NextResponse.json({ error: "practice_not_available" }, { status: 404 });
  if (!canAccessPractice(practice, userId, isApprovedMember)) {
    return NextResponse.json({ error: "practice_forbidden" }, { status: 403 });
  }
  const runState = await getUserPracticeState(admin, userId, practiceId);

  return NextResponse.json(
    {
      practice: {
        id: practice.id,
        practice_title: practice.practice_title,
        source_training_title: practice.source_training_title,
        source_module_version: practice.source_module_version,
        scenario: practice.scenario_snapshot,
      },
      run_state: runState,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
