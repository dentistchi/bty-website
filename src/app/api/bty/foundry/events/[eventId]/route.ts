import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerTrainingSnapshot } from "@/lib/bty/foundry/events/foundryTrainingService";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/[eventId] — the manager control-room snapshot:
 * event + training identity + join_url + roster with per-participant training
 * status + joined/completed counts. This is also the roster-refresh poll target.
 * Returns 404 (non-disclosing) if the event is not owned by the caller. The
 * roster NEVER includes response text (privacy).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const snapshot = await getOwnerTrainingSnapshot(admin, user.id, eventId);
  if (!snapshot) return managerJson(base, req, { error: "not_found" }, 404);

  return managerJson(base, req, attachJoinUrl(req, snapshot));
}
