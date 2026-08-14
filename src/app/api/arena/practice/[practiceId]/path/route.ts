import { NextResponse } from "next/server";
import { requireConsentedArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { recordSelectedPath } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * POST /api/arena/practice/[practiceId]/path — record the learner's cumulative decision
 * path on their own run (Slice 3.2I). One coherent run-progress writer for all phases.
 * Body: { runId, primaryChoiceId, tradeoffChoiceId?, actionChoiceId? }. Every id is
 * validated server-side against the authoritative published snapshot; unknown / cross-
 * branch / out-of-order / cross-user ids fail closed. Owner-scoped, idempotent, zero-XP.
 * Returns the canonical stored path.
 */
export async function POST(req: Request, ctx: { params: Promise<{ practiceId: string }> }) {
  const gate = await requireConsentedArenaAccess();
  if (!gate.ok) return gate.response;
  const { userId, admin } = gate.access;
  const { practiceId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!runId) return NextResponse.json({ error: "run_id_required" }, { status: 400 });

  const input = {
    primaryChoiceId: typeof body?.primaryChoiceId === "string" ? body.primaryChoiceId : undefined,
    tradeoffChoiceId: typeof body?.tradeoffChoiceId === "string" ? body.tradeoffChoiceId : undefined,
    actionChoiceId: typeof body?.actionChoiceId === "string" ? body.actionChoiceId : undefined,
  };

  const result = await recordSelectedPath(admin, userId, practiceId, runId, input);
  if (!result.ok) {
    const status = result.reason === "practice_run_not_found" || result.reason === "practice_not_available" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(
    { selected_path: result.value.selectedPath },
    { headers: { "Cache-Control": "no-store" } },
  );
}
