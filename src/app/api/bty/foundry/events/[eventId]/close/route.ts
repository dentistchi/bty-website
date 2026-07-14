import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { closeEvent } from "@/lib/bty/foundry/events/foundryEventService";
import { getOwnerTrainingSnapshot } from "@/lib/bty/foundry/events/foundryTrainingService";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/events/[eventId]/close — close the event (idempotent).
 * Blocks new joins AND new completions; completed participants keep their result
 * and may still claim XP; the owner keeps the roster. 404 if not owned.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const closed = await closeEvent(admin, user.id, eventId);
  if (!closed) return managerJson(base, req, { error: "not_found" }, 404);

  const snapshot = await getOwnerTrainingSnapshot(admin, user.id, eventId);
  if (!snapshot) return managerJson(base, req, { error: "not_found" }, 404);
  return managerJson(base, req, attachJoinUrl(req, snapshot));
}
