import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canApprove,
  canMutateDraft,
  nextModuleVersion,
  validateModuleDraft,
  type ModuleDraftAnswers,
  type ModuleDraftStatus,
} from "@/domain/foundry/module/module-draft";
import { draftTitleFrom, type BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { deleteFoundryDocument } from "./documentStorage";
import { parseDocumentRef } from "./moduleClient";

/**
 * Foundry Guided Module Builder — service layer (Slice 1).
 *
 * All DB access runs through the caller-provided service-role client (`admin`);
 * the tables are client-deny (RLS on, no client policy). Every manager-facing
 * function takes `ownerUserId` and scopes the query by `owner_user_id`, so a
 * caller can never touch another owner's draft — a missing/foreign row resolves
 * to null and the route returns a non-disclosing 404.
 *
 * Business rules (lifecycle transitions, approval-readiness, version bump) live
 * in the domain module; this layer only orchestrates domain + DB.
 *
 * Slice-1 boundary: publish is NOT implemented. `getPublishedEventBySourceDraft`
 * is the read-only lookup seam that a future publish will use to resolve the
 * winner after the DB `foundry_event_module.source_draft_id` UNIQUE constraint
 * rejects a concurrent duplicate publish. document_asset_ref is carried opaquely;
 * durable draft-asset lifecycle is deferred to the content/publish slice.
 */

const DRAFT_COLS =
  "id, owner_user_id, status, current_step, answers, module_version, parent_module_id, document_asset_ref, approved_at, published_at, created_at, updated_at";

export type ModuleDraftRow = {
  id: string;
  owner_user_id: string;
  status: ModuleDraftStatus;
  current_step: number;
  answers: ModuleDraftAnswers;
  module_version: number;
  parent_module_id: string | null;
  document_asset_ref: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModuleDraftSummary = {
  id: string;
  status: ModuleDraftStatus;
  current_step: number;
  module_version: number;
  /** Card title derived from the problem statement (null when not started). */
  title: string | null;
  updated_at: string;
  created_at: string;
};

export type PublishedModuleRef = {
  event_id: string;
  source_draft_id: string;
  module_version: number;
};

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export type CreateDraftInput = {
  answers?: ModuleDraftAnswers;
  currentStep?: number;
  documentAssetRef?: string | null;
  /** When present, this draft is a revision descending from an existing owned draft. */
  parentDraftId?: string;
};

// ---------------------------------------------------------------------------
// Create / revise
// ---------------------------------------------------------------------------

/**
 * Create a draft owned by `ownerUserId`. Starts `draft`, version 1. When
 * `parentDraftId` is given it is a REVISION: the parent must be owned by the
 * caller, and the new draft carries `nextModuleVersion(parent.module_version)`
 * plus a `parent_module_id` lineage link. The parent is never mutated (a revision
 * of an approved/published module is always a fresh draft).
 */
export async function createDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  input: CreateDraftInput = {},
): Promise<ServiceResult<ModuleDraftRow>> {
  let moduleVersion = 1;
  let parentModuleId: string | null = null;

  if (input.parentDraftId) {
    const parent = await getOwnerDraft(admin, ownerUserId, input.parentDraftId);
    if (!parent) return { ok: false, reason: "parent_not_found" };
    moduleVersion = nextModuleVersion(parent.module_version);
    parentModuleId = parent.id;
  }

  const insert: Record<string, unknown> = {
    owner_user_id: ownerUserId,
    module_version: moduleVersion,
    parent_module_id: parentModuleId,
  };
  if (input.answers !== undefined) insert.answers = input.answers;
  if (input.currentStep !== undefined) insert.current_step = input.currentStep;
  if (input.documentAssetRef !== undefined) insert.document_asset_ref = input.documentAssetRef;

  const { data, error } = await admin
    .from("foundry_module_drafts")
    .insert(insert)
    .select(DRAFT_COLS)
    .single<ModuleDraftRow>();

  if (error || !data) return { ok: false, reason: error?.message ?? "draft_insert_failed" };
  return { ok: true, value: data };
}

// ---------------------------------------------------------------------------
// Read (owner-scoped)
// ---------------------------------------------------------------------------

/** Fetch one draft. Returns null if it does not exist OR is not owned by the caller. */
export async function getOwnerDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
): Promise<ModuleDraftRow | null> {
  const { data } = await admin
    .from("foundry_module_drafts")
    .select(DRAFT_COLS)
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<ModuleDraftRow>();
  return data ?? null;
}

/** List an owner's drafts, newest-touched first, each with a derived card title. */
export async function listOwnerDrafts(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<ModuleDraftSummary[]> {
  const { data } = await admin
    .from("foundry_module_drafts")
    .select("id, status, current_step, module_version, answers, updated_at, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false })
    .returns<(Omit<ModuleDraftSummary, "title"> & { answers: ModuleDraftAnswers })[]>();
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    current_step: r.current_step,
    module_version: r.module_version,
    title: draftTitleFrom(r.answers as BuilderAnswers),
    updated_at: r.updated_at,
    created_at: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Update (draft-only, owner-scoped)
// ---------------------------------------------------------------------------

export type UpdateDraftStepInput = {
  /** Shallow-merged into the stored answers. */
  answers?: ModuleDraftAnswers;
  currentStep?: number;
  documentAssetRef?: string | null;
};

/**
 * Update a draft's step/answers. Allowed ONLY while status = 'draft'; an approved
 * or published draft is immutable and yields `draft_not_mutable`. Answers are
 * shallow-merged so a step can patch only its own fields. Returns the fresh row.
 */
export async function updateDraftStep(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  input: UpdateDraftStepInput,
): Promise<ServiceResult<ModuleDraftRow>> {
  const current = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "draft_not_found" };
  if (!canMutateDraft(current.status)) return { ok: false, reason: "draft_not_mutable" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.answers !== undefined) {
    patch.answers = { ...(current.answers ?? {}), ...input.answers };
  }
  if (input.currentStep !== undefined) patch.current_step = input.currentStep;
  if (input.documentAssetRef !== undefined) patch.document_asset_ref = input.documentAssetRef;

  const { error } = await admin
    .from("foundry_module_drafts")
    .update(patch)
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "draft"); // guard: never mutate a non-draft row

  if (error) return { ok: false, reason: error.message };

  const fresh = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!fresh) return { ok: false, reason: "draft_not_found" };
  return { ok: true, value: fresh };
}

/**
 * Approve a draft: draft -> approved. Refused unless the row is a `draft` AND its
 * answers pass domain validation (returns `draft_incomplete` with the failing
 * reasons otherwise). Stamps approved_at. After this the draft is immutable.
 */
export async function approveDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
): Promise<ServiceResult<ModuleDraftRow>> {
  const current = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "draft_not_found" };
  if (current.status !== "draft") return { ok: false, reason: "draft_not_mutable" };

  if (!canApprove(current.status, current.answers)) {
    const { errors } = validateModuleDraft(current.answers);
    return { ok: false, reason: errors[0] ?? "draft_incomplete" };
  }

  const { error } = await admin
    .from("foundry_module_drafts")
    .update({ status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "draft"); // guard: only the draft->approved transition

  if (error) return { ok: false, reason: error.message };

  const fresh = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!fresh) return { ok: false, reason: "draft_not_found" };
  return { ok: true, value: fresh };
}

// ---------------------------------------------------------------------------
// Delete (draft-only, owner-scoped)
// ---------------------------------------------------------------------------

/**
 * Delete a draft. Allowed ONLY while status = 'draft' — an approved or published
 * draft is immutable and yields `draft_not_mutable` (a published draft is also
 * FK-referenced by its event module and must never be deletable).
 */
export async function deleteDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const current = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "draft_not_found" };
  if (!canMutateDraft(current.status)) return { ok: false, reason: "draft_not_mutable" };

  // Remove all of the draft's private storage objects first (idempotent; a
  // missing object is fine) so deleting a draft never leaves orphaned files.
  // (a) legacy single-doc ref (0 exist in practice, kept for safety);
  const ref = parseDocumentRef(current.document_asset_ref);
  if (ref) await deleteFoundryDocument(admin, ref.bucket, ref.path);
  // (b) multi-format draft assets — the draft is already owner-confirmed above,
  //     so scoping the sweep by draft_id is safe. DB cascade removes the rows.
  const { data: assets } = await admin
    .from("foundry_module_draft_assets")
    .select("storage_bucket, storage_path")
    .eq("draft_id", draftId)
    .returns<{ storage_bucket: string; storage_path: string }[]>();
  for (const a of assets ?? []) await deleteFoundryDocument(admin, a.storage_bucket, a.storage_path);

  const { error } = await admin
    .from("foundry_module_drafts")
    .delete()
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "draft"); // guard: never delete a non-draft row

  if (error) return { ok: false, reason: error.message };
  return { ok: true, value: { deleted: true } };
}

// ---------------------------------------------------------------------------
// Publish idempotency lookup seam (read-only in Slice 1; publish is a later slice)
// ---------------------------------------------------------------------------

/**
 * Resolve the event a given draft version already published, if any. This is the
 * lookup half of the publish-idempotency boundary: `foundry_event_module` has a
 * UNIQUE(source_draft_id) constraint, so a concurrent duplicate publish fails at
 * the DB; the loser is compensating-deleted and the caller resolves the winner
 * with this function. NOT owner-scoped by itself (foundry_event_module has no
 * owner column); callers gate on draft ownership before reaching here.
 */
export async function getPublishedEventBySourceDraft(
  admin: SupabaseClient,
  sourceDraftId: string,
): Promise<PublishedModuleRef | null> {
  const { data } = await admin
    .from("foundry_event_module")
    .select("event_id, source_draft_id, module_version")
    .eq("source_draft_id", sourceDraftId)
    .maybeSingle<PublishedModuleRef>();
  return data ?? null;
}
