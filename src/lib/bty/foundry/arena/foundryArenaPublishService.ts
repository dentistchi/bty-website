import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { publishableSnapshot } from "@/domain/foundry/arena-draft/publish";
import { getOwnerArenaDraft } from "./foundryArenaDraftService";

/**
 * Foundry Guided Arena Builder — publish service (Slice 3.0B).
 *
 * Turns a saved draft revision into an IMMUTABLE published practice. Host-owner
 * scoped (the caller must own the draft). Publishing the EXACT current saved
 * revision: a stale expected-revision is rejected. Structure is validated
 * server-authoritatively (domain). Idempotent: (source_draft_id, revision) is
 * UNIQUE, so a duplicate publish (double-tap) resolves to the same row and never
 * creates a second version. A new draft revision publishes a NEW row — past
 * versions are never overwritten.
 */

const PRACTICE_COLS =
  "id, source_draft_id, source_draft_revision, source_event_id, source_module_version, published_by, practice_title, source_training_title, scenario_snapshot, status, availability, published_at, retired_at";

export type PublishedPracticeRow = {
  id: string;
  source_draft_id: string;
  source_draft_revision: number;
  source_event_id: string;
  source_module_version: number;
  published_by: string;
  practice_title: string;
  source_training_title: string;
  scenario_snapshot: ArenaScenarioDraft;
  status: "published" | "retired";
  availability: "all_members";
  published_at: string;
  retired_at: string | null;
};

export type PublishResult =
  | { ok: true; value: { row: PublishedPracticeRow; alreadyPublished: boolean; warnings: string[] } }
  | { ok: false; reason: string; errors?: string[] };

async function findExisting(
  admin: SupabaseClient,
  sourceDraftId: string,
  revision: number,
): Promise<PublishedPracticeRow | null> {
  const { data } = await admin
    .from("foundry_published_arena_practices")
    .select(PRACTICE_COLS)
    .eq("source_draft_id", sourceDraftId)
    .eq("source_draft_revision", revision)
    .maybeSingle<PublishedPracticeRow>();
  return data ?? null;
}

/**
 * Publish the exact saved revision of an owned draft. `expectedRevision` (from the
 * client's loaded draft) must match the draft's current revision — a mismatch is a
 * stale publish and is rejected so a host never publishes bytes they didn't see.
 */
export async function publishPractice(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  expectedRevision: number | null,
): Promise<PublishResult> {
  const draft = await getOwnerArenaDraft(admin, ownerUserId, draftId);
  if (!draft) return { ok: false, reason: "arena_draft_not_found" };

  if (expectedRevision != null && expectedRevision !== draft.revision) {
    return { ok: false, reason: "stale_revision" };
  }

  const publishable = publishableSnapshot(draft.scenario_draft);
  if (!publishable.ok) return { ok: false, reason: "invalid_structure", errors: publishable.errors };

  // Idempotency: same (draft, revision) already published → return it unchanged.
  const existing = await findExisting(admin, draftId, draft.revision);
  if (existing) return { ok: true, value: { row: existing, alreadyPublished: true, warnings: publishable.warnings } };

  // Source training title (host owns the event; draft is already owner-scoped).
  const { data: event } = await admin
    .from("foundry_events")
    .select("title")
    .eq("id", draft.source_event_id)
    .maybeSingle<{ title: string }>();
  const sourceTrainingTitle = event?.title ?? publishable.snapshot.title;

  const insert = {
    source_draft_id: draftId,
    source_draft_revision: draft.revision,
    source_event_id: draft.source_event_id,
    source_module_version: draft.source_module_version,
    published_by: ownerUserId,
    practice_title: publishable.snapshot.title,
    source_training_title: sourceTrainingTitle,
    scenario_snapshot: publishable.snapshot,
  };

  const { data, error } = await admin
    .from("foundry_published_arena_practices")
    .insert(insert)
    .select(PRACTICE_COLS)
    .single<PublishedPracticeRow>();

  if (error || !data) {
    // Lost a concurrent-publish race on the UNIQUE(draft, revision) constraint →
    // resolve the winner (idempotent), never a duplicate version.
    const raced = await findExisting(admin, draftId, draft.revision);
    if (raced) return { ok: true, value: { row: raced, alreadyPublished: true, warnings: publishable.warnings } };
    return { ok: false, reason: error?.message ?? "publish_insert_failed" };
  }
  return { ok: true, value: { row: data, alreadyPublished: false, warnings: publishable.warnings } };
}

/** List the published versions a host has produced from a given draft (newest first). */
export async function listPublishedForDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
): Promise<{ id: string; source_draft_revision: number; practice_title: string; status: string; published_at: string }[]> {
  const draft = await getOwnerArenaDraft(admin, ownerUserId, draftId);
  if (!draft) return [];
  const { data } = await admin
    .from("foundry_published_arena_practices")
    .select("id, source_draft_revision, practice_title, status, published_at")
    .eq("source_draft_id", draftId)
    .order("published_at", { ascending: false })
    .returns<
      { id: string; source_draft_revision: number; practice_title: string; status: string; published_at: string }[]
    >();
  return data ?? [];
}

export type ClientPublishedPractice = {
  id: string;
  source_draft_revision: number;
  practice_title: string;
  source_training_title: string;
  source_module_version: number;
  status: "published" | "retired";
  published_at: string;
};

export function toClientPublishedPractice(row: PublishedPracticeRow): ClientPublishedPractice {
  return {
    id: row.id,
    source_draft_revision: row.source_draft_revision,
    practice_title: row.practice_title,
    source_training_title: row.source_training_title,
    source_module_version: row.source_module_version,
    status: row.status,
    published_at: row.published_at,
  };
}
