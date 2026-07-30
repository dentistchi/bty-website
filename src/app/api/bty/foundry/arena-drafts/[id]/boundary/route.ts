import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { saveDraftBoundary, toClientArenaDraft } from "@/lib/bty/foundry/arena/foundryArenaDraftService";

export const runtime = "nodejs";

/**
 * PUT /api/bty/foundry/arena-drafts/[id]/boundary (manager-gated, owner-scoped).
 *
 * Save the Manager-CONFIRMED practice boundary onto a draft (Slice 3.2I-R5A). This is the
 * ONLY authority for the boundary — generation reads it back from the server, never from a
 * generation request. The server validates the boundary, enforces stale-revision, and
 * INVALIDATES the unapproved generated scenario when the boundary meaningfully changes. The
 * response is canonical persisted state (never the client echo). A foreign owner's draft is
 * indistinguishable from a missing one (both 404).
 *
 * Body: { boundary: PracticeBoundary, expectedRevision?: number }.
 */
function statusForReason(reason: string): number {
  if (reason === "arena_draft_not_found") return 404;
  if (reason === "stale_revision") return 409;
  if (reason.startsWith("boundary_") || reason.startsWith("constraint_")) return 422;
  return 400;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const expectedRevision = typeof body?.expectedRevision === "number" ? body.expectedRevision : null;

  const result = await saveDraftBoundary(admin, user.id, id, body?.boundary, expectedRevision);
  if (!result.ok) {
    return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));
  }
  return managerJson(base, req, {
    draft: toClientArenaDraft(result.value.row),
    invalidated: result.value.invalidated,
  });
}
