import { NextResponse } from "next/server";
import { requireArenaMember } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { listAvailablePractices } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * GET /api/arena/practice — the authenticated Arena member's available published
 * practices (Foundry-authored), newest first, each with the member's completion
 * flag. Approved-membership gated (the same authority as any Arena run). This is
 * a narrow V1 discovery list: no search, no marketplace.
 */
export async function GET() {
  const gate = await requireArenaMember();
  if (!gate.ok) return gate.response;
  const practices = await listAvailablePractices(gate.admin, gate.userId);
  return NextResponse.json({ practices }, { headers: { "Cache-Control": "no-store" } });
}
