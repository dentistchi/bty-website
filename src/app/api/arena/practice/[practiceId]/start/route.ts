import { NextResponse } from "next/server";
import { requireArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import {
  canAccessPractice,
  getPlayablePractice,
  startPracticeRun,
} from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * POST /api/arena/practice/[practiceId]/start — begin (or resume) a practice run.
 * Records a row in `foundry_arena_practice_runs` (NO XP, isolated from arena_runs).
 * Duplicate-tap safe. Visible to the creator OR an approved member; others 403.
 * 404 if missing/retired.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ practiceId: string }> }) {
  const gate = await requireArenaAccess();
  if (!gate.ok) return gate.response;
  const { userId, admin, isApprovedMember } = gate.access;
  const { practiceId } = await ctx.params;

  const practice = await getPlayablePractice(admin, practiceId);
  if (!practice) return NextResponse.json({ error: "practice_not_available" }, { status: 404 });
  if (!canAccessPractice(practice, userId, isApprovedMember)) {
    return NextResponse.json({ error: "practice_forbidden" }, { status: 403 });
  }

  const result = await startPracticeRun(admin, userId, practiceId);
  if (!result.ok) {
    const status = result.reason === "practice_not_available" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(
    // selected_path (Slice 3.2I) lets the client restore the same branch/phase on reload.
    { run_id: result.value.runId, resumed: result.value.resumed, selected_path: result.value.selectedPath },
    { status: result.value.resumed ? 200 : 201, headers: { "Cache-Control": "no-store" } },
  );
}
