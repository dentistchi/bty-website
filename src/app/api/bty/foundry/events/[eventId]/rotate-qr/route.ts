import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { rotateJoinVersion } from "@/lib/bty/foundry/events/foundryEventService";
import { getOwnerTrainingSnapshot } from "@/lib/bty/foundry/events/foundryTrainingService";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/events/[eventId]/rotate-qr — bump join_version so every
 * previously-minted QR token becomes stale. Returns the snapshot with the NEW
 * join_url. Current participants keep their room (session-gated, not version-
 * gated); only NEW joins require the current QR. 404 if not owned.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const rotated = await rotateJoinVersion(admin, user.id, eventId);
  if (!rotated) return managerJson(base, req, { error: "not_found" }, 404);

  const snapshot = await getOwnerTrainingSnapshot(admin, user.id, eventId);
  if (!snapshot) return managerJson(base, req, { error: "not_found" }, 404);
  return managerJson(base, req, attachJoinUrl(req, snapshot));
}
