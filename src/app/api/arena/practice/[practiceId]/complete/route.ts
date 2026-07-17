import { NextResponse } from "next/server";
import { requireArenaMember } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { completePracticeRun } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * POST /api/arena/practice/[practiceId]/complete — mark the member's run complete.
 * Body: { runId }. Owner-scoped by user. Idempotent. Awards NO XP (there is no XP
 * column to award to) and never sets complete_verified — the canonical Arena
 * completion/XP/level machinery is untouched. 404 if the run isn't the caller's.
 */
export async function POST(req: Request, ctx: { params: Promise<{ practiceId: string }> }) {
  const gate = await requireArenaMember();
  if (!gate.ok) return gate.response;
  const { practiceId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!runId) return NextResponse.json({ error: "run_id_required" }, { status: 400 });

  const result = await completePracticeRun(gate.admin, gate.userId, practiceId, runId);
  if (!result.ok) {
    const status = result.reason === "practice_run_not_found" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ completed: true }, { headers: { "Cache-Control": "no-store" } });
}
