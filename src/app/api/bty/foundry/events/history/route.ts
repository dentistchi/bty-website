import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { listHostHistory } from "@/lib/bty/foundry/events/foundryHostHistoryService";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/history — the authenticated host's Event History
 * Archive (read-only). Returns the host's TERMINAL (closed) events, most-recently
 * -ended first, with canonical joined/completion counts. Owner-scoped in the
 * service, so another host's events are never returned. The payload carries NO
 * reflection text, session token, or join credential (aggregate + factual only).
 *
 * Behind `requireManager`: 401 unauthenticated, 403 `foundry_host_required` for a
 * non-host. Static segment `history` takes precedence over the sibling `[eventId]`
 * dynamic route, so this never collides with the control-room snapshot loader.
 */
export async function GET(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const events = await listHostHistory(admin, user.id);
  return managerJson(base, req, { events });
}
