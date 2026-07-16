import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { attachDocument, removeDocument } from "@/lib/bty/foundry/events/moduleDocumentService";
import { toClientDraft } from "@/lib/bty/foundry/events/moduleClient";

export const runtime = "nodejs";

/**
 * Guided Module Builder — draft PDF attachment (manager-gated, owner-scoped).
 *
 * POST   — multipart { file } → server-authoritative PDF intake to the PRIVATE
 *          bucket + durable server-owned reference on the draft. Returns safe
 *          attachment metadata + the client draft (attachment present). PDF only.
 * DELETE — remove the draft's PDF (private object first, then clear the ref).
 *
 * Draft-status only (approved/published → 409). Foreign/missing → 404
 * non-disclosing. NEVER returns owner id, bucket, storage path, signed URL, hash,
 * or any staging ticket.
 */

function statusForReason(reason: string): number {
  if (reason === "draft_not_found") return 404;
  if (reason === "draft_not_mutable") return 409;
  if (reason === "attach_failed" || reason === "remove_failed" || reason === "upload_failed") return 502;
  return 400; // file_not_pdf / file_too_large / file_empty / file_required / page_count_unverifiable
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const pageCountHint = form?.get("page_count_hint") ?? undefined;

  const result = await attachDocument(admin, user.id, id, file, pageCountHint);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  return managerJson(base, req, {
    attachment: result.value.attachment,
    draft: toClientDraft(result.value.draft),
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const result = await removeDocument(admin, user.id, id);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  return managerJson(base, req, { draft: toClientDraft(result.value.draft) });
}
