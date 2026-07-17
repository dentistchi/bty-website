import { NextResponse } from "next/server";
import { requireArenaMember } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { getPlayablePractice, getUserPracticeState } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * GET /api/arena/practice/[practiceId] — the immutable snapshot to play, plus the
 * member's current run state (for reload). 404 if missing/retired. Approved-member
 * gated. Returns the frozen three-phase scenario + source training lineage.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ practiceId: string }> }) {
  const gate = await requireArenaMember();
  if (!gate.ok) return gate.response;
  const { practiceId } = await ctx.params;

  const practice = await getPlayablePractice(gate.admin, practiceId);
  if (!practice) return NextResponse.json({ error: "practice_not_available" }, { status: 404 });
  const runState = await getUserPracticeState(gate.admin, gate.userId, practiceId);

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
