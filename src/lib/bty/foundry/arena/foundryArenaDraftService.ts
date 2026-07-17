import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import { validateArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
import { resolveArenaSource } from "./arenaScenarioSource";
import { generateArenaScenarioDraft, type Locale } from "./arenaScenarioGenerationService";

/**
 * Foundry Guided Arena Builder — draft persistence (service).
 *
 * The table is client-deny; every function takes `ownerUserId` and scopes by
 * `owner_user_id`, so a foreign/missing row resolves to null and the route returns
 * a non-disclosing 404. Business rules (source resolution + ownership, structural
 * validity, generation) live in the domain + sibling services; this layer
 * orchestrates them and the DB. Source version is bound at CREATE from the frozen
 * module snapshot and never re-pointed at "latest".
 */

const DRAFT_COLS =
  "id, owner_user_id, source_event_id, source_module_version, source_draft_id, status, guided_answers, scenario_draft, generation_source, revision, created_at, updated_at";

export type ArenaDraftRow = {
  id: string;
  owner_user_id: string;
  source_event_id: string;
  source_module_version: number;
  source_draft_id: string;
  status: "draft";
  guided_answers: GuidedAnswers;
  scenario_draft: ArenaScenarioDraft | null;
  generation_source: "ai" | "template" | "edited" | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Create — resolve source, generate, validate, insert (source version bound here)
// ---------------------------------------------------------------------------

export type CreateArenaDraftInput = {
  sourceEventId: string;
  guidedAnswers: GuidedAnswers;
  locale: Locale;
};

/**
 * Create a draft: prove the caller owns the source event, read its frozen module
 * snapshot, generate a valid three-phase draft, and persist it with the exact
 * source version identity (event id + module_version + source_draft_id). The
 * guided answers are stored so a later regenerate never loses host input. Returns
 * the fresh row (with any advisory warnings).
 */
export async function createArenaDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  input: CreateArenaDraftInput,
): Promise<ServiceResult<{ row: ArenaDraftRow; warnings: string[] }>> {
  const source = await resolveArenaSource(admin, ownerUserId, input.sourceEventId);
  if (!source.ok) return { ok: false, reason: source.reason };

  const generated = await generateArenaScenarioDraft({
    locale: input.locale,
    facts: source.value.facts,
    guided: input.guidedAnswers,
  });

  // Defense: never persist an invalid structure as valid (generation guarantees
  // validity, but the gate is the single source of truth).
  const check = validateArenaScenarioDraft(generated.draft);
  if (!check.ok) return { ok: false, reason: check.errors[0] ?? "generation_invalid" };

  const { data, error } = await admin
    .from("foundry_arena_scenario_drafts")
    .insert({
      owner_user_id: ownerUserId,
      source_event_id: source.value.eventId,
      source_module_version: source.value.moduleVersion,
      source_draft_id: source.value.sourceDraftId,
      guided_answers: input.guidedAnswers,
      scenario_draft: generated.draft,
      generation_source: generated.source,
      revision: 0,
    })
    .select(DRAFT_COLS)
    .single<ArenaDraftRow>();

  if (error || !data) return { ok: false, reason: error?.message ?? "arena_draft_insert_failed" };
  return { ok: true, value: { row: data, warnings: [...generated.warnings, ...check.warnings] } };
}

// ---------------------------------------------------------------------------
// Read (owner-scoped)
// ---------------------------------------------------------------------------

export async function getOwnerArenaDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
): Promise<ArenaDraftRow | null> {
  const { data } = await admin
    .from("foundry_arena_scenario_drafts")
    .select(DRAFT_COLS)
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<ArenaDraftRow>();
  return data ?? null;
}

export type ArenaDraftSummary = {
  id: string;
  source_event_id: string;
  source_module_version: number;
  title: string | null;
  revision: number;
  updated_at: string;
  created_at: string;
};

/** List an owner's Arena drafts for one source event, newest-touched first. */
export async function listOwnerArenaDraftsForEvent(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ArenaDraftSummary[]> {
  const { data } = await admin
    .from("foundry_arena_scenario_drafts")
    .select("id, source_event_id, source_module_version, scenario_draft, revision, updated_at, created_at")
    .eq("owner_user_id", ownerUserId)
    .eq("source_event_id", eventId)
    .order("updated_at", { ascending: false })
    .returns<
      (Omit<ArenaDraftSummary, "title"> & { scenario_draft: ArenaScenarioDraft | null })[]
    >();
  return (data ?? []).map((r) => ({
    id: r.id,
    source_event_id: r.source_event_id,
    source_module_version: r.source_module_version,
    title: r.scenario_draft?.title ?? null,
    revision: r.revision,
    updated_at: r.updated_at,
    created_at: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Save edits (owner-scoped) — validate the host-edited draft before persisting
// ---------------------------------------------------------------------------

/**
 * Save a host-edited scenario draft. The edited structure MUST pass the
 * deterministic validator (an invalid edit is refused with `invalid_structure` +
 * the failing codes — never silently saved). Bumps `revision`, marks the draft
 * `edited`. Returns the fresh row. Save honesty: a DB error is surfaced, never a
 * fake success.
 */
export async function saveArenaDraftEdits(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  scenarioDraft: unknown,
): Promise<ServiceResult<{ row: ArenaDraftRow; warnings: string[] }> & { errors?: string[] }> {
  const current = await getOwnerArenaDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "arena_draft_not_found" };

  const check = validateArenaScenarioDraft(scenarioDraft);
  if (!check.ok) return { ok: false, reason: "invalid_structure", errors: check.errors };

  const { data, error } = await admin
    .from("foundry_arena_scenario_drafts")
    .update({
      scenario_draft: scenarioDraft,
      generation_source: "edited",
      revision: current.revision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .select(DRAFT_COLS)
    .single<ArenaDraftRow>();

  if (error || !data) return { ok: false, reason: error?.message ?? "arena_draft_save_failed" };
  return { ok: true, value: { row: data, warnings: check.warnings } };
}

// ---------------------------------------------------------------------------
// Regenerate (owner-scoped) — reuse the STORED guided answers (retry, no re-entry)
// ---------------------------------------------------------------------------

/**
 * Regenerate the scenario from the SAME stored guided answers + the same bound
 * source version. Used by the host's re-roll after an unsatisfying draft — it
 * never loses their answers and never re-points the source. Overwrites
 * `scenario_draft`, bumps `revision`. Fails honestly if the source has since been
 * retired.
 */
export async function regenerateArenaDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  locale: Locale,
): Promise<ServiceResult<{ row: ArenaDraftRow; warnings: string[] }>> {
  const current = await getOwnerArenaDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "arena_draft_not_found" };

  const source = await resolveArenaSource(admin, ownerUserId, current.source_event_id);
  if (!source.ok) return { ok: false, reason: source.reason };

  const generated = await generateArenaScenarioDraft({
    locale,
    facts: source.value.facts,
    guided: current.guided_answers,
  });
  const check = validateArenaScenarioDraft(generated.draft);
  if (!check.ok) return { ok: false, reason: check.errors[0] ?? "generation_invalid" };

  const { data, error } = await admin
    .from("foundry_arena_scenario_drafts")
    .update({
      scenario_draft: generated.draft,
      generation_source: generated.source,
      revision: current.revision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .select(DRAFT_COLS)
    .single<ArenaDraftRow>();

  if (error || !data) return { ok: false, reason: error?.message ?? "arena_draft_save_failed" };
  return { ok: true, value: { row: data, warnings: [...generated.warnings, ...check.warnings] } };
}

// ---------------------------------------------------------------------------
// Client projection — strips owner id
// ---------------------------------------------------------------------------

export type ClientArenaDraft = {
  id: string;
  source_event_id: string;
  source_module_version: number;
  status: "draft";
  guided_answers: GuidedAnswers;
  scenario_draft: ArenaScenarioDraft | null;
  generation_source: "ai" | "template" | "edited" | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

export function toClientArenaDraft(row: ArenaDraftRow): ClientArenaDraft {
  return {
    id: row.id,
    source_event_id: row.source_event_id,
    source_module_version: row.source_module_version,
    status: row.status,
    guided_answers: row.guided_answers,
    scenario_draft: row.scenario_draft,
    generation_source: row.generation_source,
    revision: row.revision,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
