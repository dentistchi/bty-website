import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { attachAsset } from "@/lib/bty/foundry/events/draftAssetService";

export const runtime = "nodejs";

/**
 * Guided Module Builder — draft assets collection (manager-gated, owner-scoped).
 *
 * POST — multipart { file } → attach ONE file (the client uploads each selected
 * file in its own request, so bodies stay bounded and each file has its own
 * progress/retry). Server-authoritative validation (extension allowlist +
 * signature/container). Returns a client-safe asset. Draft-status only. Never
 * returns bucket / storage path / hash / owner id. Foreign/missing draft → 404.
 */
function statusForReason(reason: string): number {
  if (reason === "draft_not_found") return 404;
  if (reason === "draft_not_mutable") return 409;
  if (reason === "storage_failed" || reason === "asset_record_failed") return 502;
  if (reason === "too_many_files" || reason === "draft_asset_quota") return 409;
  return 400; // unsupported_file_type / invalid_file_signature / file_too_large / file_empty / file_required
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  const result = await attachAsset(admin, user.id, id, file);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  return managerJson(base, req, { asset: result.value.asset }, 201);
}
