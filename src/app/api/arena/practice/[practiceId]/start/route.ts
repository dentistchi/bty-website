import { NextResponse } from "next/server";
import { requireArenaMember } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { startPracticeRun } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * POST /api/arena/practice/[practiceId]/start — begin (or resume) a practice run.
 * Records a row in `foundry_arena_practice_runs` (NO XP, isolated from arena_runs).
 * Duplicate-tap safe: an in-progress run for (user, practice) is reused, never
 * duplicated. 404 if the practice is missing/retired. Approved-member gated.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ practiceId: string }> }) {
  const gate = await requireArenaMember();
  if (!gate.ok) return gate.response;
  const { practiceId } = await ctx.params;

  const result = await startPracticeRun(gate.admin, gate.userId, practiceId);
  if (!result.ok) {
    const status = result.reason === "practice_not_available" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(
    { run_id: result.value.runId, resumed: result.value.resumed },
    { status: result.value.resumed ? 200 : 201, headers: { "Cache-Control": "no-store" } },
  );
}
