import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canMutateDraft } from "@/domain/foundry/module/module-draft";
import { inspectAsset, MAX_ASSETS_PER_DRAFT, MAX_DRAFT_TOTAL_BYTES } from "@/domain/foundry/module/draft-asset";
import { FOUNDRY_DOC_BUCKET, deleteFoundryDocument } from "./documentStorage";
import { getOwnerDraft, type ServiceResult } from "./foundryModuleService";
import { toClientAsset, type ClientAsset, type DraftAssetRow } from "./moduleClient";
import { derivePdfPageCountDeep } from "./pdfPageCountDeep";

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
 * ONE asset, resolved for its owner (Slice 3.2R-R3).
 *
 * The draft is resolved by (draft id + authenticated owner) FIRST — the asset table has no
 * owner column — and only then is the asset scoped to that confirmed draft. So a Host cannot
 * read another Host's material by knowing an asset id, and a wrong id and a wrong owner are
 * indistinguishable to the caller.
 *
 * Returns the storage coordinates for signing; the caller never hands them to a browser.
 */
export async function resolveDraftAssetForOwner(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  assetId: string,
): Promise<DraftAssetRow | null> {
  const draft = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!draft) return null;
  const { data } = await admin
    .from("foundry_module_draft_assets")
    .select(ASSET_COLS)
    .eq("id", assetId)
    .eq("draft_id", draftId)
    .maybeSingle<DraftAssetRow>();
  return data ?? null;
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

  const { ext, fileKind, mime, width, height } = inspected.value;
  /*
    DEEP PAGE COUNT (Slice 3.2R-R6). The pure inspector scans raw bytes and honestly reports
    `null` for a PDF whose page tree lives in compressed object streams — which is what
    `SafetyToolkit_Huddles.pdf` is. Publish then turned that `null` into 1, and would have told
    a learner a four-page document was fully read after page one. The deep pass inflates those
    streams and applies the SAME counting rules; when it still cannot tell, `null` survives and
    publish refuses rather than inventing a number.
  */
  const derivedDeep = fileKind === "pdf" ? await derivePdfPageCountDeep(bytes) : null;
  const pageCount = fileKind === "pdf" ? derivedDeep!.count : inspected.value.pageCount;
  const pageCountVerified = fileKind === "pdf" ? derivedDeep!.count !== null : inspected.value.pageCountVerified;
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
 * COPY-ON-REVISION (Slice 3.2P-R2.1) — the one primitive that carries a source attachment
 * from a parent draft to its new version.
 *
 * THE DEFECT IT CLOSES. "Create new version" copied the parent's answers verbatim, including
 * `materialIntent: "pdf"`, and copied no assets — so the child declared a PDF it did not
 * have, and the Host was asked to re-upload a file this system already holds, verified,
 * hashed and page-counted. Measured on the live pilot: v2 inherited `materialIntent: "pdf"`,
 * zero asset rows, `document_asset_ref: null`, and an empty `verifiedArtifacts` for
 * generation.
 *
 * WHY THE OBJECT IS COPIED AND NOT SHARED. `removeAsset` deletes the underlying storage
 * object. A child row pointing at the parent's path would mean a Host detaching the file from
 * v2 destroys the object that v1's PUBLISHED event still serves to learners. So each
 * inherited asset gets its own object at a fresh owner-scoped path; identical bytes, and
 * therefore an identical `content_hash`, which is what makes the copy verifiable.
 *
 * IDEMPOTENT BY CONTENT HASH. A parent asset whose hash already exists on the child is
 * skipped — no second row, no second object. So a retry after a partial failure completes the
 * remainder rather than duplicating what already landed.
 *
 * NOT A "RESTORE" HOOK. This runs at revision CREATION only. A Host who later removes an
 * attachment means it; resurrecting it because the child has no assets would override that.
 */
export type AssetCloneResult = {
  /** Parent assets found. Zero means there was nothing to inherit — not a failure. */
  readonly found: number;
  /** Rows newly written on the child by this call. */
  readonly copied: number;
  /** Already present on the child (same content hash) and correctly left alone. */
  readonly skipped: number;
  /** True only when every parent asset is now present on the child. */
  readonly complete: boolean;
};

export async function cloneDraftAssets(
  admin: SupabaseClient,
  ownerUserId: string,
  fromDraftId: string,
  toDraftId: string,
): Promise<ServiceResult<AssetCloneResult>> {
  // Both sides owner-resolved first, exactly like every other op here: an asset must never
  // cross an owner boundary, and neither id is trusted from a caller.
  const parent = await getOwnerDraft(admin, ownerUserId, fromDraftId);
  if (!parent) return { ok: false, reason: "parent_not_found" };
  const child = await getOwnerDraft(admin, ownerUserId, toDraftId);
  if (!child) return { ok: false, reason: "draft_not_found" };
  if (!canMutateDraft(child.status)) return { ok: false, reason: "draft_not_mutable" };

  const { data: sources } = await admin
    .from("foundry_module_draft_assets")
    .select(ASSET_COLS)
    .eq("draft_id", fromDraftId)
    .order("created_at", { ascending: true })
    .returns<DraftAssetRow[]>();
  const parentAssets = sources ?? [];
  if (parentAssets.length === 0) {
    return { ok: true, value: { found: 0, copied: 0, skipped: 0, complete: true } };
  }

  const { data: already } = await admin
    .from("foundry_module_draft_assets")
    .select("content_hash")
    .eq("draft_id", toDraftId)
    .returns<{ content_hash: string }[]>();
  const present = new Set((already ?? []).map((r) => r.content_hash));

  let copied = 0;
  let skipped = 0;
  for (const src of parentAssets) {
    if (present.has(src.content_hash)) {
      skipped += 1;
      continue;
    }

    // 1. READ the parent object. A read failure stops this asset and leaves everything as it
    //    was — nothing has been written yet.
    const { data: blob, error: dlErr } = await admin.storage.from(src.storage_bucket).download(src.storage_path);
    if (dlErr || !blob) return { ok: false, reason: "storage_failed" };
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // 2. VERIFY the bytes are what the parent row claims before writing anything derived from
    //    them. A silent mismatch would produce a "copy" that is not one.
    if (sha256Hex(bytes) !== src.content_hash) return { ok: false, reason: "asset_content_mismatch" };

    // 3. WRITE the child's own object at a fresh path. `upsert: false` so a UUID collision
    //    fails loudly instead of overwriting somebody's file.
    const path = `${ownerUserId}/${crypto.randomUUID()}.${src.normalized_extension}`;
    const { error: upErr } = await admin.storage.from(FOUNDRY_DOC_BUCKET).upload(path, bytes, {
      contentType: src.mime_type,
      upsert: false,
    });
    if (upErr) return { ok: false, reason: "storage_failed" };

    // 4. RECORD it. Metadata is carried across because the SERVER derived it from these exact
    //    bytes at intake — page count, verification flag, dimensions — and the bytes are
    //    provably identical. `created_at` is the child row's own.
    const { error } = await admin.from("foundry_module_draft_assets").insert({
      draft_id: toDraftId,
      original_filename: src.original_filename,
      normalized_extension: src.normalized_extension,
      mime_type: src.mime_type,
      file_kind: src.file_kind,
      byte_size: src.byte_size,
      storage_bucket: FOUNDRY_DOC_BUCKET,
      storage_path: path,
      content_hash: src.content_hash,
      page_count: src.page_count,
      page_count_verified: src.page_count_verified,
      width: src.width,
      height: src.height,
    });
    if (error) {
      // Storage and Postgres are not one transaction. Compensate the object THIS iteration
      // just created — the same both-or-neither discipline `attachAsset` uses — and report.
      // Objects written by earlier iterations already have their rows and are legitimate.
      await deleteFoundryDocument(admin, FOUNDRY_DOC_BUCKET, path);
      return { ok: false, reason: "asset_record_failed" };
    }
    copied += 1;
    present.add(src.content_hash);
  }

  return { ok: true, value: { found: parentAssets.length, copied, skipped, complete: true } };
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
