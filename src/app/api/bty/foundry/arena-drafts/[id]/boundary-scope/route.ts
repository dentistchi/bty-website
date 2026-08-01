import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { saveDraftBoundaryScope, toClientArenaDraft } from "@/lib/bty/foundry/arena/foundryArenaDraftService";

export const runtime = "nodejs";

/**
 * PUT /api/bty/foundry/arena-drafts/[id]/boundary-scope (manager-gated, owner-scoped).
 *
 * Save which CONFIRMED boundaries are ACTIVE for this Practice situation (Slice 3.2I-R2.23C).
 *
 * A situation rehearses at most three rules at once — beyond that, two options that stay inside all
 * of them stop being a choice. When four or more are confirmed, generation blocks until the Host
 * chooses; the system never selects a default set, never merges rules and never silently drops one.
 * Unselected rules are untouched and remain available for another situation.
 *
 * Like the boundary itself, this is server authority: generation reads the selection back from
 * here, never from a generation request. Owner-scoped and stale-revision-guarded; a foreign owner's
 * draft is indistinguishable from a missing one (both 404).
 *
 * Body: { activeBoundaryIds: string[], expectedRevision?: number }.
 */
function statusForReason(reason: string): number {
  if (reason === "arena_draft_not_found") return 404;
  if (reason === "stale_revision") return 409;
  // Host SETUP outcomes — the selection is unprocessable, not malformed.
  if (
    reason.startsWith("boundary_") ||
    reason === "too_many_active_boundaries" ||
    reason === "unknown_active_boundary" ||
    reason === "missing_required_active_boundary" ||
    reason === "active_boundary_set_changed" ||
    reason === "practice_boundary_scope_required"
  ) {
    return 422;
  }
  return 400;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const expectedRevision = typeof body?.expectedRevision === "number" ? body.expectedRevision : null;

  const result = await saveDraftBoundaryScope(admin, user.id, id, body?.activeBoundaryIds, expectedRevision);
  if (!result.ok) {
    return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));
  }
  return managerJson(base, req, {
    draft: toClientArenaDraft(result.value.row),
    invalidated: result.value.invalidated,
  });
}
