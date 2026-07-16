import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { removeAsset } from "@/lib/bty/foundry/events/draftAssetService";

export const runtime = "nodejs";

/**
 * Guided Module Builder — one draft asset (manager-gated, owner-scoped).
 *
 * DELETE — remove one asset from a draft (object first, then row). Draft-status
 * only. Never removes another draft's asset. A storage failure keeps the row and
 * reports honestly (502). Foreign/missing draft or asset → 404 non-disclosing.
 */
function statusForReason(reason: string): number {
  if (reason === "draft_not_found" || reason === "asset_not_found") return 404;
  if (reason === "draft_not_mutable") return 409;
  if (reason === "storage_failed" || reason === "asset_record_failed") return 502;
  return 400;
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; assetId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id, assetId } = await ctx.params;
  const result = await removeAsset(admin, user.id, id, assetId);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  return managerJson(base, req, { removed: true });
}
