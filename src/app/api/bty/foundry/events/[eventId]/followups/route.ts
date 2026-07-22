import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getEventFollowupsForOwner } from "@/lib/bty/foundry/events/foundryFollowupService";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/[eventId]/followups — Host Follow-up Status section (Slice 3.1B-3K).
 * Owner-scoped via requireManager (+ owner re-check in the projection). INDEPENDENT of the Shared
 * Question / Shared Understanding gate: a training with followUpDays > 0 and no shared question still
 * shows follow-up status. Returns per-participant: identity, checkpoint, due date, derived state
 * (pending / due / overdue / responded), and the LEARNER-REPORTED outcome + responded_at. NEVER
 * response_text / private reflection / AI interpretation. 404 when the event is not owned.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const { timezone } = await resolveUserTzContext(admin, user.id, req.nextUrl.searchParams.get("tz"));
  const view = await getEventFollowupsForOwner(admin, user.id, eventId, new Date(), timezone);
  if (!view) return managerJson(base, req, { error: "not_found" }, 404);
  return managerJson(base, req, { ok: true, ...view });
}
