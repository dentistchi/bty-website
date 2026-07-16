import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canMutateDraft } from "@/domain/foundry/module/module-draft";
import { inspectAsset, MAX_ASSETS_PER_DRAFT, MAX_DRAFT_TOTAL_BYTES } from "@/domain/foundry/module/draft-asset";
import { FOUNDRY_DOC_BUCKET, deleteFoundryDocument } from "./documentStorage";
import { getOwnerDraft, type ServiceResult } from "./foundryModuleService";
import { toClientAsset, type ClientAsset, type DraftAssetRow } from "./moduleClient";

/**
 * Foundry Guided Module Builder — draft assets (Slice 2.1.2).
 *
 * Multi-format attachments on a DRAFT. Every op resolves the draft by (draft id +
 * authenticated owner) FIRST (non-disclosing 404), then scopes assets by that
 * confirmed draft id — the asset table has no owner column. Server-authoritative
 * intake (extension allowlist + signature/container validation, server byte size,
 * SHA-256) to the PRIVATE foundry-docs bucket. The client never sees bucket, path,
 * hash, or owner. Nothing here writes the legacy document_asset_ref column.
 */

const ASSET_COLS =
  "id, draft_id, original_filename, normalized_extension, mime_type, file_kind, byte_size, storage_bucket, storage_path, content_hash, page_count, page_count_verified, width, height, created_at";

function sanitizeFilename(name: unknown): string {
  if (typeof name !== "string") return "file";
  let out = "";
  for (const ch of name) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) continue;
    out += ch;
  }
  const cleaned = out.trim().slice(0, 260);
  return cleaned.length ? cleaned : "file";
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** List a draft's assets, oldest-first. Returns null if the draft is not owned. */
export async function listDraftAssets(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
): Promise<ClientAsset[] | null> {
  const draft = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!draft) return null;
  const { data } = await admin
    .from("foundry_module_draft_assets")
    .select(ASSET_COLS)
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true })
    .returns<DraftAssetRow[]>();
  return (data ?? []).map(toClientAsset);
}

/**
 * Attach ONE file to a draft (the client uploads each selected file in its own
 * request). Validates the bytes, enforces per-draft count + total-size limits,
 * uploads privately, then records the asset — compensating storage if the DB
 * insert fails. Returns the client-safe asset.
 */
export async function attachAsset(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  file: unknown,
): Promise<ServiceResult<{ asset: ClientAsset }>> {
  const draft = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!draft) return { ok: false, reason: "draft_not_found" };
  if (!canMutateDraft(draft.status)) return { ok: false, reason: "draft_not_mutable" };
  if (!(file instanceof File)) return { ok: false, reason: "file_required" };

  // Count + total-size guard (server-authoritative).
  const { data: existing } = await admin
    .from("foundry_module_draft_assets")
    .select("byte_size")
    .eq("draft_id", draftId)
    .returns<{ byte_size: number }[]>();
  const rows = existing ?? [];
  if (rows.length >= MAX_ASSETS_PER_DRAFT) return { ok: false, reason: "too_many_files" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectAsset(file.name, bytes);
  if (!inspected.ok) return { ok: false, reason: inspected.reason };

  const totalBefore = rows.reduce((s, r) => s + (Number(r.byte_size) || 0), 0);
  if (totalBefore + bytes.byteLength > MAX_DRAFT_TOTAL_BYTES) return { ok: false, reason: "draft_asset_quota" };

  const { ext, fileKind, mime, pageCount, pageCountVerified, width, height } = inspected.value;
  const path = `${ownerUserId}/${crypto.randomUUID()}.${ext}`;
  const contentHash = sha256Hex(bytes);

  const { error: upErr } = await admin.storage.from(FOUNDRY_DOC_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) return { ok: false, reason: "storage_failed" };

  const { data, error } = await admin
    .from("foundry_module_draft_assets")
    .insert({
      draft_id: draftId,
      original_filename: sanitizeFilename(file.name),
      normalized_extension: ext,
      mime_type: mime,
      file_kind: fileKind,
      byte_size: bytes.byteLength,
      storage_bucket: FOUNDRY_DOC_BUCKET,
      storage_path: path,
      content_hash: contentHash,
      page_count: pageCount,
      page_count_verified: pageCountVerified,
      width,
      height,
    })
    .select(ASSET_COLS)
    .single<DraftAssetRow>();

  if (error || !data) {
    await deleteFoundryDocument(admin, FOUNDRY_DOC_BUCKET, path); // compensate storage
    return { ok: false, reason: "asset_record_failed" };
  }

  return { ok: true, value: { asset: toClientAsset(data) } };
}

/**
 * Remove one asset from a draft. Removes the private object FIRST (strict — a real
 * storage failure keeps the row and reports honestly; a missing object is
 * idempotent), then deletes the row. Never touches another draft's asset.
 */
export async function removeAsset(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  assetId: string,
): Promise<ServiceResult<{ removed: boolean }>> {
  const draft = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!draft) return { ok: false, reason: "draft_not_found" };
  if (!canMutateDraft(draft.status)) return { ok: false, reason: "draft_not_mutable" };

  const { data: asset } = await admin
    .from("foundry_module_draft_assets")
    .select("id, storage_bucket, storage_path")
    .eq("id", assetId)
    .eq("draft_id", draftId)
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();
  if (!asset) return { ok: false, reason: "asset_not_found" };

  const { error: rmErr } = await admin.storage.from(asset.storage_bucket).remove([asset.storage_path]);
  if (rmErr) return { ok: false, reason: "storage_failed" }; // honest: row not deleted

  const { error } = await admin
    .from("foundry_module_draft_assets")
    .delete()
    .eq("id", assetId)
    .eq("draft_id", draftId);
  if (error) return { ok: false, reason: "asset_record_failed" };

  return { ok: true, value: { removed: true } };
}
