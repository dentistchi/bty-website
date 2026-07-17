import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { approveDraft } from "@/lib/bty/foundry/events/foundryModuleService";
import { toClientDraft } from "@/lib/bty/foundry/events/moduleClient";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/modules/[id]/approve — approve a builder draft
 * (draft -> approved). Manager-gated + owner-scoped. Refuses an incomplete draft
 * (400 with the failing reason) or a non-draft row (409). 404 non-disclosing if
 * not owned/missing. After approval the draft is immutable. Publishing is the
 * separate /publish step (which also enforces this gate, so approval is optional
 * in the one-tap flow).
 */
function statusForReason(reason: string): number {
  if (reason === "draft_not_found") return 404;
  if (reason === "draft_not_mutable") return 409;
  return 400;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const result = await approveDraft(admin, user.id, id);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));
  return managerJson(base, req, { draft: toClientDraft(result.value) });
}
