import type { SupabaseClient } from "@supabase/supabase-js";
import { canMutateDraft } from "@/domain/foundry/module/module-draft";
import { uploadFoundryDocument, deleteFoundryDocument } from "./documentStorage";
import { getOwnerDraft, type ModuleDraftRow, type ServiceResult } from "./foundryModuleService";
import {
  parseDocumentRef,
  serializeDocumentRef,
  toClientAttachment,
  type ClientAttachment,
  type DraftDocumentRef,
} from "./moduleClient";

/**
 * Foundry Guided Module Builder — draft PDF attachment (Slice 2.1.1).
 *
 * A durable, server-owned attachment on a DRAFT. Reuses the existing
 * server-authoritative intake (`uploadFoundryDocument`: %PDF- magic bytes, server
 * byte size, page count, SHA-256, upload to the PRIVATE `foundry-docs` bucket at a
 * server-owned path). The canonical reference is stored as a JSON string in the
 * draft's own `document_asset_ref` COLUMN — never in `answers`, so the client's
 * autosave PATCH can neither forge nor overwrite it. The client only ever receives
 * safe metadata (filename / size / page count / uploaded_at); path, bucket, and
 * hash never leave the server. No expiring staging ticket is used as durable state.
 */

/** Drop control chars, bound length; keep the host's original filename otherwise. */
function sanitizeFilename(name: unknown): string | null {
  if (typeof name !== "string") return null;
  let out = "";
  for (const ch of name) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) continue;
    out += ch;
  }
  const cleaned = out.trim().slice(0, 160);
  return cleaned.length ? cleaned : null;
}

/** Best-effort, idempotent removal of a draft's stored asset (missing = fine). */
export async function cleanupDraftAsset(admin: SupabaseClient, documentAssetRef: string | null): Promise<void> {
  const ref = parseDocumentRef(documentAssetRef);
  if (ref) await deleteFoundryDocument(admin, ref.bucket, ref.path);
}

/**
 * Attach (or replace) a PDF on a draft. Uploads + validates the NEW file first;
 * only after the new reference is persisted authoritatively is the OLD object
 * removed. If anything fails, the existing attachment is retained.
 */
export async function attachDocument(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  file: unknown,
  pageCountHint?: unknown,
): Promise<ServiceResult<{ draft: ModuleDraftRow; attachment: ClientAttachment }>> {
  const current = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "draft_not_found" };
  if (!canMutateDraft(current.status)) return { ok: false, reason: "draft_not_mutable" };

  // Server-authoritative intake to the private bucket (new object first).
  const up = await uploadFoundryDocument(admin, ownerUserId, file, pageCountHint);
  if (!up.ok) return { ok: false, reason: up.reason };

  const newRef: DraftDocumentRef = {
    bucket: up.value.bucket,
    path: up.value.path,
    filename: sanitizeFilename((file as File)?.name),
    byteSize: up.value.byteSize,
    pageCount: up.value.pageCount,
    pageCountVerified: up.value.pageCountVerified,
    contentHash: up.value.contentHash,
    uploadedAt: new Date().toISOString(),
  };

  const oldRef = parseDocumentRef(current.document_asset_ref);

  // Persist the new reference (owner + draft-status guarded). Only then is it
  // authoritative. If this fails, discard the just-uploaded object and keep the old.
  const { error } = await admin
    .from("foundry_module_drafts")
    .update({ document_asset_ref: serializeDocumentRef(newRef), updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "draft");

  if (error) {
    await deleteFoundryDocument(admin, newRef.bucket, newRef.path);
    return { ok: false, reason: "attach_failed" };
  }

  // Replace: remove the previous object only after the new ref is authoritative.
  if (oldRef && oldRef.path !== newRef.path) {
    await deleteFoundryDocument(admin, oldRef.bucket, oldRef.path);
  }

  const fresh = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!fresh) return { ok: false, reason: "draft_not_found" };
  return { ok: true, value: { draft: fresh, attachment: toClientAttachment(newRef) as ClientAttachment } };
}

/**
 * Remove a draft's PDF. Removes the private object FIRST; only on a successful
 * (or idempotent-missing) removal does it clear the reference — a removal failure
 * never falsely reports the attachment gone.
 */
export async function removeDocument(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
): Promise<ServiceResult<{ draft: ModuleDraftRow }>> {
  const current = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "draft_not_found" };
  if (!canMutateDraft(current.status)) return { ok: false, reason: "draft_not_mutable" };

  const ref = parseDocumentRef(current.document_asset_ref);
  if (ref) {
    const { error } = await admin.storage.from(ref.bucket).remove([ref.path]);
    // A genuinely-missing object returns no error (idempotent). A real failure
    // must NOT clear the ref — the attachment stays and the UI can retry.
    if (error) return { ok: false, reason: "remove_failed" };
  }

  const { error } = await admin
    .from("foundry_module_drafts")
    .update({ document_asset_ref: null, updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "draft");
  if (error) return { ok: false, reason: "remove_failed" };

  const fresh = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!fresh) return { ok: false, reason: "draft_not_found" };
  return { ok: true, value: { draft: fresh } };
}
