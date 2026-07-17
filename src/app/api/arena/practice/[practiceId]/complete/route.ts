import { NextResponse } from "next/server";
import { requireArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { completePracticeRun } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * POST /api/arena/practice/[practiceId]/complete — mark the user's run complete.
 * Body: { runId }. Owner-scoped by user (only the run's owner can complete it, so
 * no extra practice-access check is needed). Idempotent. Awards NO XP and never
 * sets complete_verified — the canonical Arena machinery is untouched.
 */
export async function POST(req: Request, ctx: { params: Promise<{ practiceId: string }> }) {
  const gate = await requireArenaAccess();
  if (!gate.ok) return gate.response;
  const { userId, admin } = gate.access;
  const { practiceId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!runId) return NextResponse.json({ error: "run_id_required" }, { status: 400 });

  const result = await completePracticeRun(admin, userId, practiceId, runId);
  if (!result.ok) {
    const status = result.reason === "practice_run_not_found" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ completed: true }, { headers: { "Cache-Control": "no-store" } });
}
