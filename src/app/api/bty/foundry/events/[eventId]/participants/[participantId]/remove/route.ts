import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { removeParticipant, getOwnerEventSnapshot } from "@/lib/bty/foundry/events/foundryEventService";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/events/[eventId]/participants/[participantId]/remove —
 * owner removes a participant. Their session can no longer restore the room. The
 * removal is owner-scoped (the event must belong to the caller). Returns the
 * refreshed snapshot. 404 if not owned / participant not removable.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ eventId: string; participantId: string }> },
) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId, participantId } = await ctx.params;
  const removed = await removeParticipant(admin, user.id, eventId, participantId);
  if (!removed) return managerJson(base, req, { error: "not_found" }, 404);

  const snapshot = await getOwnerEventSnapshot(admin, user.id, eventId);
  if (!snapshot) return managerJson(base, req, { error: "not_found" }, 404);
  return managerJson(base, req, attachJoinUrl(req, snapshot));
}
