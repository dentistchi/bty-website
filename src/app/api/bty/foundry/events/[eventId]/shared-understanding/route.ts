import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getSharedUnderstandingForOwner } from "@/lib/bty/foundry/events/foundrySharedReviewService";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/[eventId]/shared-understanding — Host educational review surface
 * (Slice 3.1B-3G). Owner-scoped via requireManager. Returns the configured shared question and
 * every SUBMITTED shared response with its review state. NEVER returns response_text / private
 * reflection. 404 when the event is not owned by the caller (no disclosure of a foreign event).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const view = await getSharedUnderstandingForOwner(admin, user.id, eventId);
  if (!view) return managerJson(base, req, { error: "not_found" }, 404);
  return managerJson(base, req, { ok: true, ...view });
}
