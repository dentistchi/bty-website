import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerEventSnapshot } from "@/lib/bty/foundry/events/foundryEventService";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/[eventId] — the manager control-room snapshot:
 * event + join_url + roster (joined_at asc). This is also the roster-refresh
 * poll target. Returns 404 (non-disclosing) if the event is not owned by the
 * caller — a stranger's event id is indistinguishable from a missing one.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const snapshot = await getOwnerEventSnapshot(admin, user.id, eventId);
  if (!snapshot) return managerJson(base, req, { error: "not_found" }, 404);

  return managerJson(base, req, attachJoinUrl(req, snapshot));
}
