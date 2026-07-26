import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerRoomSnapshot } from "@/lib/bty/foundry/events/foundryDocumentService";
import { isEventRevisable } from "@/lib/bty/foundry/events/foundryRevisionService";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/[eventId] — the manager control-room snapshot:
 * event (incl. content_type) + content identity (training or document) + join_url
 * + roster with per-participant status + joined/completed counts. Content-type
 * aware so a PDF room's control room keeps its identity on every poll. This is
 * also the roster-refresh poll target. Returns 404 (non-disclosing) if the event
 * is not owned by the caller. The roster NEVER includes response text (privacy).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const snapshot = await getOwnerRoomSnapshot(admin, user.id, eventId);
  if (!snapshot) return managerJson(base, req, { error: "not_found" }, 404);

  // Guided "Create new version" eligibility (Slice 3.2C-B1): boolean only — true iff
  // this owned event is a Guided published training with a resolvable source draft.
  const revisable = await isEventRevisable(admin, user.id, eventId);

  return managerJson(base, req, { ...attachJoinUrl(req, snapshot), revisable });
}
