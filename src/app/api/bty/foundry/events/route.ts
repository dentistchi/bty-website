import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { listOwnerEvents } from "@/lib/bty/foundry/events/foundryEventService";
import { createTrainingEvent } from "@/lib/bty/foundry/events/foundryTrainingService";

export const runtime = "nodejs";

/**
 * Foundry Training Rooms — manager collection.
 *
 * POST /api/bty/foundry/events  — create a training event (body: { title,
 *   youtube_url, completion_prompt }). Parses the canonical video id, stores
 *   event + content atomically (compensating delete on content failure). Returns
 *   the control-room snapshot incl. join_url. 201 on success, 400 on bad input.
 * GET  /api/bty/foundry/events  — list the caller's own events (newest first) with
 *   joined counts. Never returns another owner's events (service is owner-scoped).
 */
export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const body = await req.json().catch(() => ({}));
  const result = await createTrainingEvent(admin, user.id, {
    title: body?.title,
    youtube_url: body?.youtube_url,
    completion_prompt: body?.completion_prompt,
  });
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
