import type { ModuleDraftRow, ModuleDraftSummary } from "./foundryModuleService";
import type { ModuleDraftStatus } from "@/domain/foundry/module/module-draft";
import { normalizeLearningNeeds, type BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { previewSupported, participantDeliveryReady, type FileKind } from "@/domain/foundry/module/draft-asset";

/**
 * Client-facing draft serialization for the Guided Module Builder routes.
 *
 * The builder never receives owner_user_id, and never the opaque
 * document_asset_ref VALUE (only whether one is present) — in this slice a PDF is
 * an intent, not a durable asset, and no storage path is ever exposed. This is the
 * single place the API's draft shape is defined, so a route can't accidentally leak
 * an internal field.
 */
export type ClientDraft = {
  id: string;
  status: ModuleDraftStatus;
  current_step: number;
  answers: BuilderAnswers;
  module_version: number;
  parent_module_id: string | null;
  document_asset_ref_present: boolean;
  attachment: ClientAttachment | null;
  /** Multi-format draft attachments (Slice 2.1.2). Populated by the draft-detail route. */
  assets: ClientAsset[];
  created_at: string;
  updated_at: string;
};

/** The list-item shape — a summary already free of owner id and answers. */
export type ClientDraftSummary = ModuleDraftSummary;

/** The SERVER-owned draft asset row (foundry_module_draft_assets). Server-only. */
export type DraftAssetRow = {
  id: string;
  draft_id: string;
  original_filename: string;
  normalized_extension: string;
  mime_type: string;
  file_kind: FileKind;
  byte_size: number;
  storage_bucket: string;
  storage_path: string;
  content_hash: string;
  page_count: number | null;
  page_count_verified: boolean;
  width: number | null;
  height: number | null;
  created_at: string;
};

/** The client-safe asset projection — NO bucket, path, hash, or owner. */
export type ClientAsset = {
  id: string;
  filename: string;
  file_kind: FileKind;
  mime_type: string;
  byte_size: number;
  page_count: number | null;
  page_count_verified: boolean;
  width: number | null;
  height: number | null;
  uploaded_at: string;
  preview_supported: boolean;
  participant_delivery_ready: boolean;
};

export function toClientAsset(row: DraftAssetRow): ClientAsset {
  return {
    id: row.id,
    filename: row.original_filename,
    file_kind: row.file_kind,
    mime_type: row.mime_type,
    byte_size: row.byte_size,
    page_count: row.page_count,
    page_count_verified: row.page_count_verified,
    width: row.width,
    height: row.height,
    uploaded_at: row.created_at,
    preview_supported: previewSupported(row.file_kind),
    participant_delivery_ready: participantDeliveryReady(row.file_kind),
  };
}

/**
 * The SERVER-owned draft document reference, stored (as a JSON string) in the
 * `document_asset_ref` column — never sent to the client. It carries the private
 * storage location + the canonical, server-derived integrity values. Because it
 * lives in its own column (not `answers`), the client's autosave PATCH can never
 * forge or overwrite it.
 */
export type DraftDocumentRef = {
  bucket: string;
  path: string;
  filename: string | null;
  byteSize: number;
  pageCount: number;
  pageCountVerified: boolean;
  contentHash: string;
  uploadedAt: string;
};

/** The client-safe attachment projection — NO path, bucket, or hash. */
export type ClientAttachment = {
  present: true;
  filename: string | null;
  byte_size: number;
  page_count: number;
  page_count_verified: boolean;
  uploaded_at: string;
};

/** Parse the opaque `document_asset_ref` column value; tolerant of legacy/blank. */
export function parseDocumentRef(raw: string | null | undefined): DraftDocumentRef | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o && typeof o === "object" && typeof o.path === "string" && typeof o.bucket === "string") {
      return {
        bucket: o.bucket,
        path: o.path,
        filename: typeof o.filename === "string" ? o.filename : null,
        byteSize: Number(o.byteSize) || 0,
        pageCount: Number(o.pageCount) || 0,
        pageCountVerified: Boolean(o.pageCountVerified),
        contentHash: typeof o.contentHash === "string" ? o.contentHash : "",
        uploadedAt: typeof o.uploadedAt === "string" ? o.uploadedAt : "",
      };
    }
  } catch {
    /* not a JSON ref → no attachment */
  }
  return null;
}

export function serializeDocumentRef(ref: DraftDocumentRef): string {
  return JSON.stringify(ref);
}

/** Strip the private fields — the client never receives path, bucket, or hash. */
export function toClientAttachment(ref: DraftDocumentRef | null): ClientAttachment | null {
  if (!ref) return null;
  return {
    present: true,
    filename: ref.filename,
    byte_size: ref.byteSize,
    page_count: ref.pageCount,
    page_count_verified: ref.pageCountVerified,
    uploaded_at: ref.uploadedAt,
  };
}

export function toClientDraft(row: ModuleDraftRow): ClientDraft {
  const answers = (row.answers ?? {}) as BuilderAnswers;
  // Restore old drafts into the canonical multi-select shape (legacy learningNeed
  // -> learningNeeds[]) so the client never has to know about the legacy field.
  const needs = normalizeLearningNeeds(answers);
  const normalized: BuilderAnswers = needs.length > 0 ? { ...answers, learningNeeds: needs } : answers;
  const ref = parseDocumentRef(row.document_asset_ref);
  return {
    id: row.id,
    status: row.status,
    current_step: row.current_step,
    answers: normalized,
    module_version: row.module_version,
    parent_module_id: row.parent_module_id,
    document_asset_ref_present: ref != null,
    attachment: toClientAttachment(ref),
    assets: [], // populated by the draft-detail route (listDraftAssets)
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Summaries are already safe; this is the explicit, named projection the routes use. */
export function toClientSummary(s: ModuleDraftSummary): ClientDraftSummary {
  return {
    id: s.id,
    status: s.status,
    current_step: s.current_step,
    module_version: s.module_version,
    title: s.title ?? null,
    updated_at: s.updated_at,
    created_at: s.created_at,
  };
}
