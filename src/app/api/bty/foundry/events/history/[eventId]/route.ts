import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getHostHistoryDetail } from "@/lib/bty/foundry/events/foundryHostHistoryService";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/history/[eventId] — a read-only snapshot of one
 * historical event the caller owns: session summary, canonical counts, a material
 * summary, and a completion-only roster. Returns 404 (non-disclosing) when the
 * event is not owned by the caller OR is not terminal (an open/current event is
 * not in the archive) — a guessed foreign or active id reveals nothing. The
 * payload NEVER includes reflection text, a session token, a join credential, or
 * a storage path.
 *
 * Behind `requireManager`: 401 unauthenticated, 403 `foundry_host_required`.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const detail = await getHostHistoryDetail(admin, user.id, eventId);
  if (!detail) return managerJson(base, req, { error: "not_found" }, 404);

  return managerJson(base, req, { event: detail });
}
