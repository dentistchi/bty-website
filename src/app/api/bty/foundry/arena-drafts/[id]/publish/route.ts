import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  getPublishedForCurrentRevision,
  publishPractice,
  toClientPublishedPractice,
} from "@/lib/bty/foundry/arena/foundryArenaPublishService";

export const runtime = "nodejs";

/**
 * Foundry Guided Arena Builder — publish a draft to Arena (manager-gated, owner-scoped).
 *
 * POST — freeze the EXACT current saved revision of the caller's draft into an
 *        immutable published practice. `expectedRevision` (the revision the client
 *        loaded) must match the stored revision or the publish is rejected as
 *        stale (409). Malformed structure → 422. Idempotent: a duplicate publish
 *        of the same revision returns the existing version (never a duplicate).
 *        404 non-disclosing if the draft is missing/not owned.
 */

function statusForReason(reason: string): number {
  if (reason === "arena_draft_not_found") return 404;
  if (reason === "stale_revision") return 409;
  if (reason === "invalid_structure") return 422;
  return 400;
}

/** GET — is the draft's CURRENT revision already published? Returns { practice|null }. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;
  const { id } = await ctx.params;
  const practice = await getPublishedForCurrentRevision(admin, user.id, id);
  return managerJson(base, req, { practice });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const expectedRevision =
    typeof body?.expectedRevision === "number" && Number.isInteger(body.expectedRevision)
      ? body.expectedRevision
      : null;

  const result = await publishPractice(admin, user.id, id, expectedRevision);
  if (!result.ok) {
    return managerJson(
      base,
      req,
      { error: result.reason, ...(result.errors ? { fields: result.errors } : {}) },
      statusForReason(result.reason),
    );
  }
  return managerJson(
    base,
    req,
    {
      practice: toClientPublishedPractice(result.value.row),
      alreadyPublished: result.value.alreadyPublished,
      warnings: result.value.warnings,
    },
    result.value.alreadyPublished ? 200 : 201,
  );
}
