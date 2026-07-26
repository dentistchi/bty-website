import type { SupabaseClient } from "@supabase/supabase-js";
import { createDraft } from "./foundryModuleService";
import type { ModuleDraftAnswers, ModuleDraftStatus } from "@/domain/foundry/module/module-draft";

/**
 * Guided Program — Create New Version (Slice 3.2C-B1).
 *
 * The narrowest server entry that turns a published Guided training into a NEW
 * DRAFT VERSION within the SAME Program. It adds NO version engine — it only
 * resolves + authorizes the source and delegates creation to the EXISTING
 * `createDraft` revision branch (parent_module_id lineage + nextModuleVersion +
 * inherited program_id). It never mints a Program, never mutates the old draft or
 * run, and creates no event/snapshot (publish stays the existing Builder flow).
 *
 * The client supplies ONLY the published foundry_events id. Everything else
 * (source draft, owner, program, version) is resolved server-side and never
 * trusted from the caller. Errors are calm and non-enumerating.
 */

type SourceDraft = {
  id: string;
  owner_user_id: string;
  status: ModuleDraftStatus;
  module_version: number;
  parent_module_id: string | null;
  program_id: string | null;
  answers: ModuleDraftAnswers;
};

const SRC_COLS =
  "id, owner_user_id, status, module_version, parent_module_id, program_id, answers";

export type RevisionReason =
  | "not_guided_program"
  | "source_not_found"
  | "not_owner"
  | "source_not_published"
  | "program_lineage_missing"
  | "newer_version_exists"
  | "revision_unavailable";

export type RevisionResult =
  | { ok: true; draftId: string; programId: string; moduleVersion: number; resumed: boolean }
  | { ok: false; reason: RevisionReason; latestVersionDraftId?: string };

type SourceResult = { ok: true; source: SourceDraft } | { ok: false; reason: RevisionReason };

/**
 * Resolve the source draft behind a published Guided event, owner-scoped:
 *   foundry_events.id → foundry_event_module.source_draft_id → foundry_module_drafts.
 * Validates: mapping exists (Guided), source draft exists, owned by the caller,
 * published, and carries a canonical program_id. Foundry Host capability is
 * enforced by the route's requireManager gate BEFORE this runs.
 */
async function resolveSource(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<SourceResult> {
  const { data: mod } = await admin
    .from("foundry_event_module")
    .select("source_draft_id")
    .eq("event_id", eventId)
    .maybeSingle<{ source_draft_id: string }>();
  if (!mod?.source_draft_id) return { ok: false, reason: "not_guided_program" };

  const { data: src } = await admin
    .from("foundry_module_drafts")
    .select(SRC_COLS)
    .eq("id", mod.source_draft_id)
    .maybeSingle<SourceDraft>();
  if (!src) return { ok: false, reason: "source_not_found" };
  // Non-disclosing ownership check — never reveal another Host's draft/Program.
  if (src.owner_user_id !== ownerUserId) return { ok: false, reason: "not_owner" };
  if (src.status !== "published") return { ok: false, reason: "source_not_published" };
  if (!src.program_id) return { ok: false, reason: "program_lineage_missing" };
  return { ok: true, source: src };
}

/** UI gate: is this owned event a Guided published training with resolvable lineage? Boolean only (no metadata). */
export async function isEventRevisable(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<boolean> {
  const r = await resolveSource(admin, ownerUserId, eventId);
  return r.ok;
}

/**
 * Create — or resume — exactly one new revision draft for the Program behind a
 * published Guided event. Linear-version safe:
 *   - branches only from the LATEST published version in the Program (a stale
 *     selection returns newer_version_exists + the latest draft id to navigate to);
 *   - if an unpublished child revision of the latest already exists, RESUMES it
 *     (ordinary double-taps never create a duplicate open draft);
 *   - otherwise creates one new draft via the existing createDraft revision branch,
 *     copying the parent's answers (prefill) and inheriting program_id.
 * Never mints a Program, never mutates old rows, never creates an event/snapshot.
 */
export async function createOrResumeRevision(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<RevisionResult> {
  const r = await resolveSource(admin, ownerUserId, eventId);
  if (!r.ok) return { ok: false, reason: r.reason };
  const programId = r.source.program_id as string;

  // Latest PUBLISHED version in this Program (linearity anchor).
  const { data: latestPub } = await admin
    .from("foundry_module_drafts")
    .select(SRC_COLS)
    .eq("program_id", programId)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "published")
    .order("module_version", { ascending: false })
    .limit(1)
    .maybeSingle<SourceDraft>();
  if (!latestPub) return { ok: false, reason: "source_not_published" };

  // Do not branch from an old version when a newer published one exists.
  if (latestPub.id !== r.source.id) {
    return { ok: false, reason: "newer_version_exists", latestVersionDraftId: latestPub.id };
  }

  // Resume an existing unpublished child revision of the latest published draft.
  const { data: openChild } = await admin
    .from("foundry_module_drafts")
    .select(SRC_COLS)
    .eq("parent_module_id", latestPub.id)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "draft")
    .order("module_version", { ascending: false })
    .limit(1)
    .maybeSingle<SourceDraft>();
  if (openChild) {
    return {
      ok: true,
      draftId: openChild.id,
      programId: (openChild.program_id ?? programId) as string,
      moduleVersion: openChild.module_version,
      resumed: true,
    };
  }

  // Create exactly one new revision draft (existing createDraft revision branch:
  // parent_module_id lineage + nextModuleVersion + inherited program_id) with the
  // parent's answers copied for prefill.
  const created = await createDraft(admin, ownerUserId, {
    parentDraftId: latestPub.id,
    // Deep copy so the revision draft's answers are independent of the parent's
    // (Postgres jsonb already stores a copy; this makes the intent explicit and
    // guarantees editing V2 can never touch V1 answers). answers is JSON-shaped.
    answers: latestPub.answers ? (JSON.parse(JSON.stringify(latestPub.answers)) as ModuleDraftAnswers) : latestPub.answers,
  });
  if (!created.ok) return { ok: false, reason: "revision_unavailable" };
  return {
    ok: true,
    draftId: created.value.id,
    programId: (created.value.program_id ?? programId) as string,
    moduleVersion: created.value.module_version,
    resumed: false,
  };
}
