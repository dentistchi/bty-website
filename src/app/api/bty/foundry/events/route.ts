import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { createEvent, listOwnerEvents } from "@/lib/bty/foundry/events/foundryEventService";

export const runtime = "nodejs";

/**
 * Foundry Event Rooms — manager collection.
 *
 * POST /api/bty/foundry/events  — create an event (body: { title }). Returns the
 *   canonical snapshot incl. join_url for the QR. 201 on success, 400 on bad title.
 * GET  /api/bty/foundry/events  — list the caller's own events (newest first) with
 *   joined counts. Never returns another owner's events (service is owner-scoped).
 */
export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const body = await req.json().catch(() => ({}));
  const result = await createEvent(admin, user.id, body?.title);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, 400);

  return managerJson(base, req, attachJoinUrl(req, result.value), 201);
}

export async function GET(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const events = await listOwnerEvents(admin, user.id);
  return managerJson(base, req, { events });
}
