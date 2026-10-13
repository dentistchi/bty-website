import { NextResponse } from "next/server";
import { requireConsentedArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { isAiPatientAllowed } from "@/lib/bty/arena/aiPatient/aiPatientAccess";
import { isAiPatientAvailable } from "@/lib/bty/arena/aiPatient/aiPatientService";

export const runtime = "nodejs";

/**
 * GET /api/arena/ai-patient/access — whether to show the AI patient door to THIS user.
 * Display only: every AI patient route re-checks the allowlist itself. No budget is spent here.
 */
export async function GET() {
  const gate = await requireConsentedArenaAccess();
  if (!gate.ok) return gate.response;
  return NextResponse.json({ enabled: isAiPatientAllowed(gate.access.userId) && isAiPatientAvailable() }, { headers: { "Cache-Control": "no-store" } });
}
