import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  getOwnerDraft,
  updateDraftStep,
  deleteDraft,
} from "@/lib/bty/foundry/events/foundryModuleService";
import { toClientDraft } from "@/lib/bty/foundry/events/moduleClient";
import { validateDraftPatch } from "@/domain/foundry/module/module-builder";

export const runtime = "nodejs";

/**
 * Guided Module Builder — one draft (manager-gated, owner-scoped).
 *
 * GET    — read one draft (client shape). 404 non-disclosing if not owned/missing.
 * PATCH  — save validated answers + current_step. Field-level validation only
 *          (partial drafts save fine — NOT approval completeness). 400 on bad
 *          input, 404 non-disclosing if not owned/missing, 409 if the draft is
 *          approved/published (immutable). Returns the fresh { draft }.
 * DELETE — delete a draft-status draft only. 404 non-disclosing / 409 if immutable.
 *
 * A foreign owner's draft is indistinguishable from a missing one (both 404). The
 * server rejects mutation/deletion of approved/published drafts even if the client
 * is manipulated. No approve/publish/session/event side effects here.
 */

/** Map a service failure reason to an HTTP status without disclosing existence. */
function statusForReason(reason: string): number {
  if (reason === "draft_not_found") return 404;
  if (reason === "draft_not_mutable") return 409;
  return 400;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);
  return managerJson(base, req, { draft: toClientDraft(draft) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const validated = validateDraftPatch({ answers: body?.answers, currentStep: body?.current_step });
  if (!validated.ok) return managerJson(base, req, { error: "invalid_fields", fields: validated.errors }, 400);

  const result = await updateDraftStep(admin, user.id, id, {
    answers: validated.value.answers,
    currentStep: validated.value.currentStep,
  });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  return managerJson(base, req, { draft: toClientDraft(result.value) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const result = await deleteDraft(admin, user.id, id);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));
  return managerJson(base, req, { deleted: true });
}
