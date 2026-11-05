import { NextResponse } from "next/server";
import { requireConsentedArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { listAvailablePractices } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";

export const runtime = "nodejs";

/**
 * GET /api/arena/practice — the authenticated user's available published
 * practices: own published work, shared work for approved Arena members, and
 * practices built from training this user completed. Newest first, each with
 * the user's completion flag. Discovery follows the existing per-practice access.
 */
export async function GET() {
  const gate = await requireConsentedArenaAccess();
  if (!gate.ok) return gate.response;
  const { userId, admin, isApprovedMember } = gate.access;
  const practices = await listAvailablePractices(admin, userId, isApprovedMember);
  return NextResponse.json({ practices }, { headers: { "Cache-Control": "no-store" } });
}
