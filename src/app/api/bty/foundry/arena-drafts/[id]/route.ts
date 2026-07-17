import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  getOwnerArenaDraft,
  saveArenaDraftEdits,
  toClientArenaDraft,
} from "@/lib/bty/foundry/arena/foundryArenaDraftService";

export const runtime = "nodejs";

/**
 * Foundry Guided Arena Builder — one Arena scenario draft (manager-gated, owner-scoped).
 *
 * GET   — read one draft (client shape). 404 non-disclosing if not owned/missing.
 * PATCH — save the host-edited scenario. The edited structure MUST pass the
 *         deterministic validator; an invalid edit is refused (422 invalid_structure
 *         + failing codes) and never silently saved. A DB failure surfaces as an
 *         error, never a fake success. Returns the fresh { draft, warnings }.
 *
 * A foreign owner's draft is indistinguishable from a missing one (both 404).
 */

function statusForReason(reason: string): number {
  if (reason === "arena_draft_not_found") return 404;
  if (reason === "invalid_structure") return 422;
  return 400;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const draft = await getOwnerArenaDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);
  return managerJson(base, req, { draft: toClientArenaDraft(draft) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await saveArenaDraftEdits(admin, user.id, id, body?.scenario_draft);
  if (!result.ok) {
    return managerJson(
      base,
      req,
      { error: result.reason, ...(result.errors ? { fields: result.errors } : {}) },
      statusForReason(result.reason),
    );
  }
  return managerJson(base, req, { draft: toClientArenaDraft(result.value.row), warnings: result.value.warnings });
}
