import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import { validateArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
import { boundaryChanged, validateBoundary, type PracticeBoundary } from "@/domain/foundry/arena-draft/boundary";
import { availableSetKey, buildBoundaryScope, type PracticeBoundaryScope } from "@/domain/foundry/arena-draft/boundaryScope";
import { resolveArenaSource } from "./arenaScenarioSource";
import { generateArenaScenarioDraft, type Locale } from "./arenaScenarioGenerationService";

/**
 * Slice 3.2I-R5A.2 — lifecycle discriminator. A NEW authoritative Practice draft carries
 * `practiceSetupVersion`; a HISTORICAL legacy draft does not (never auto-added). A new draft
 * is boundary-REQUIRED: absence of a boundary is NOT treated as legacy.
 */
export const PRACTICE_SETUP_VERSION = 1;

/** The stored guided-answers value: host Q1/Q2 + lifecycle discriminator + editable boundary. */
type StoredGuidedAnswers = GuidedAnswers & {
  practiceSetupVersion?: number;
  practiceBoundary?: PracticeBoundary;
  /**
   * R2.23C — the Host's ACTIVE-boundary selection for this situation. It rides inside the existing
   * versioned `guided_answers` JSONB, so no migration is required and no persisted row is rewritten.
   * Absent is legitimate: scoping is only required once four or more confirmed rules exist.
   */
  practiceBoundaryScope?: PracticeBoundaryScope;
};

/** True for a new authoritative draft (has the lifecycle discriminator). */
function isNewAuthorityDraft(guided: StoredGuidedAnswers): boolean {
  return typeof guided.practiceSetupVersion === "number";
}

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
  guided_answers: StoredGuidedAnswers;
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
  // SHELL-FIRST (Slice 3.2I-R5A.2): a new Practice begins as a canonical EMPTY draft shell —
  // NO generation, NO provider/reviewer call. The Manager confirms a boundary next, then
  // generation happens by draft id (regenerateArenaDraft). Source linkage is server-derived
  // from the frozen module snapshot (never client facts); the discriminator marks it as a new
  // authoritative draft so its missing boundary is never mistaken for a historical legacy one.
  const source = await resolveArenaSource(admin, ownerUserId, input.sourceEventId);
  if (!source.ok) return { ok: false, reason: source.reason };

  const guided: StoredGuidedAnswers = { ...input.guidedAnswers, practiceSetupVersion: PRACTICE_SETUP_VERSION };

  const { data, error } = await admin
    .from("foundry_arena_scenario_drafts")
    .insert({
      owner_user_id: ownerUserId,
      source_event_id: source.value.eventId,
      source_module_version: source.value.moduleVersion,
      source_draft_id: source.value.sourceDraftId,
      guided_answers: guided,
      scenario_draft: null, // no scenario until a boundary is confirmed and generation runs
      generation_source: null,
      revision: 0,
    })
    .select(DRAFT_COLS)
    .single<ArenaDraftRow>();

  if (error || !data) {
    // A unique-violation (23505) means a concurrent request already inserted the authoritative
    // shell for this (owner, event) relationship — the DB rejected our duplicate. Surface it as a
    // distinct, recoverable reason so create-or-open converges to the winning row (never a second
    // authoritative row). Requires the one-shell unique index (migration 20260803000000).
    if ((error as { code?: string } | null)?.code === "23505") {
      return { ok: false, reason: "duplicate_relationship" };
    }
    return { ok: false, reason: error?.message ?? "arena_draft_insert_failed" };
  }
  return { ok: true, value: { row: data, warnings: [] } };
}

/**
 * Create-or-OPEN the canonical Practice shell for a training (Slice 3.2I-R5B1A.1) — GLOBALLY
 * ATOMIC across Worker isolates. Correctness rests on the DB one-shell unique invariant, NOT on a
 * SELECT-then-INSERT check (which two isolates can both pass):
 *   1. fast path — reopen the canonical current draft if one already exists (no insert);
 *   2. otherwise attempt to INSERT the shell. If a concurrent isolate won the race, our INSERT
 *      loses with a unique violation and we LOAD the winning row and return it.
 * Every successful caller therefore receives the SAME canonical draft id, and no duplicate/orphan
 * authoritative shell can ever remain. `opened` distinguishes reuse (or race-loss) from creation.
 */
export async function createOrOpenArenaDraftShell(
  admin: SupabaseClient,
  ownerUserId: string,
  input: CreateArenaDraftInput,
): Promise<ServiceResult<{ row: ArenaDraftRow; opened: boolean }>> {
  // Fast path: an existing canonical shell is reopened, never duplicated.
  const existing = await getCurrentOwnerArenaDraft(admin, ownerUserId, input.sourceEventId);
  if (existing) return { ok: true, value: { row: existing, opened: true } };

  // Create path: the DB unique index makes this atomic. Exactly one concurrent INSERT can win.
  const created = await createArenaDraft(admin, ownerUserId, input);
  if (created.ok) return { ok: true, value: { row: created.value.row, opened: false } };

  // Lost the race (another isolate inserted first): converge on THAT winning row.
  if (created.reason === "duplicate_relationship") {
    const winner = await getCurrentOwnerArenaDraft(admin, ownerUserId, input.sourceEventId);
    if (winner) return { ok: true, value: { row: winner, opened: true } };
  }
  return created; // a genuine failure (source not owned / missing / no module)
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

/**
 * The single canonical CURRENT draft for (owner, event). With the one-shell unique invariant
 * there is at most one new-authority row, so this IS the authoritative Practice shell. Ordering
 * carries a DETERMINISTIC tie-breaker (updated_at desc, then created_at desc, then id asc) so
 * historical data with equal timestamps still resolves to the same winner every time — never a
 * bare `updated_at DESC` that could flip between ties. Returns the full row (owner-scoped).
 */
export async function getCurrentOwnerArenaDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ArenaDraftRow | null> {
  const { data } = await admin
    .from("foundry_arena_scenario_drafts")
    .select(DRAFT_COLS)
    .eq("owner_user_id", ownerUserId)
    .eq("source_event_id", eventId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(1)
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
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
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

  // TRUST BOUNDARY (Slice 3.2I-R5A): generation reads ONLY the canonical, server-stored
  // boundary — never a client-supplied one. Snapshot the revision it was generated under.
  const canonicalBoundary = current.guided_answers.practiceBoundary;
  const generatedUnderRevision = current.revision;

  // NEW-AUTHORITY drafts (Slice 3.2I-R5A.2) are boundary-REQUIRED: a missing/unconfirmed
  // boundary blocks generation (no legacy boundaryless fallback). Legacy drafts (no
  // discriminator) fall through to the free-text eligibility contract as before.
  if (isNewAuthorityDraft(current.guided_answers) && !(canonicalBoundary && canonicalBoundary.confirmed)) {
    return { ok: false, reason: "boundary_confirmation_required" };
  }

  const generated = await generateArenaScenarioDraft({
    locale,
    facts: source.value.facts,
    guided: current.guided_answers,
    boundary: canonicalBoundary,
    // R2.23C — the Host's ACTIVE selection, read from the SERVER, never from a generation request.
    boundaryScope: current.guided_answers.practiceBoundaryScope ?? null,
  });
  if (!generated.ok) return { ok: false, reason: generated.reason };
  const gen = generated.value;
  // Copy the boundary onto the scenario so it rides into the published snapshot (audit).
  const scenario: ArenaScenarioDraft = canonicalBoundary ? { ...gen.draft, practiceBoundary: canonicalBoundary } : gen.draft;
  const check = validateArenaScenarioDraft(scenario);
  if (!check.ok) return { ok: false, reason: check.errors[0] ?? "generation_invalid" };

  // RACE PROTECTION: only save if the canonical revision is still the one we generated under
  // (the Manager may have edited the boundary in another tab while we generated/reviewed).
  const { data, error } = await admin
    .from("foundry_arena_scenario_drafts")
    .update({
      scenario_draft: scenario,
      generation_source: gen.source,
      revision: generatedUnderRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("revision", generatedUnderRevision)
    .select(DRAFT_COLS)
    .single<ArenaDraftRow>();

  if (error || !data) return { ok: false, reason: "stale_revision" }; // boundary changed mid-generation
  return { ok: true, value: { row: data, warnings: [...gen.warnings, ...check.warnings] } };
}

/**
 * Save the Manager-confirmed practice boundary onto a draft (Slice 3.2I-R5A). This is the
 * ONLY authority for the boundary — generation reads it back from here, never from a client
 * request. Owner-scoped, stale-revision-guarded, and it INVALIDATES the unapproved generated
 * scenario (clears `scenario_draft`) when the boundary MEANINGFULLY changes, so branches made
 * under an old boundary can never be previewed or published. Returns the canonical saved state.
 */
export async function saveDraftBoundary(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  boundaryInput: unknown,
  expectedRevision: number | null,
): Promise<ServiceResult<{ row: ArenaDraftRow; invalidated: boolean }>> {
  const check = validateBoundary(boundaryInput);
  if (!check.ok) return { ok: false, reason: check.errors[0] ?? "boundary_invalid" };
  const boundary = boundaryInput as PracticeBoundary;

  const current = await getOwnerArenaDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "arena_draft_not_found" };
  if (expectedRevision !== null && expectedRevision !== current.revision) {
    return { ok: false, reason: "stale_revision" };
  }

  const changed = boundaryChanged(current.guided_answers.practiceBoundary, boundary);
  const nextGuided: StoredGuidedAnswers = { ...current.guided_answers, practiceBoundary: boundary };
  // R2.23C — a selection made against a different rule set is not a decision about this one. When
  // the available set moves, the scoping is invalidated rather than silently re-applied. The Host's
  // previous selection is preserved for reference; only its `confirmed` flag drops.
  const prevScope = current.guided_answers.practiceBoundaryScope;
  if (prevScope && prevScope.availableKey !== availableSetKey(boundary.constraints)) {
    nextGuided.practiceBoundaryScope = { ...prevScope, confirmed: false };
  }

  const patch: Record<string, unknown> = {
    guided_answers: nextGuided,
    revision: current.revision + 1,
    updated_at: new Date().toISOString(),
  };
  // A meaningful change invalidates the unapproved generated scenario — it must never be
  // previewed or published as current under the new boundary.
  if (changed) {
    patch.scenario_draft = null;
    patch.generation_source = null;
  }

  const { data, error } = await admin
    .from("foundry_arena_scenario_drafts")
    .update(patch)
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("revision", current.revision)
    .select(DRAFT_COLS)
    .single<ArenaDraftRow>();
  if (error || !data) return { ok: false, reason: "stale_revision" };
  return { ok: true, value: { row: data, invalidated: changed } };
}

/**
 * Save the Host's ACTIVE-boundary selection (Slice 3.2I-R2.23C). Owner-scoped and
 * stale-revision-guarded, exactly like the boundary itself.
 *
 * The system NEVER selects for the Host: an out-of-range, unknown or duplicated selection is
 * rejected with its exact code rather than trimmed. Unselected rules are untouched and remain
 * available for another Practice situation. A meaningful change invalidates the unapproved
 * generated scenario for the same reason a boundary change does — it was made under a different
 * set of active rules.
 */
export async function saveDraftBoundaryScope(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  selectedIds: unknown,
  expectedRevision: number | null,
): Promise<ServiceResult<{ row: ArenaDraftRow; invalidated: boolean }>> {
  if (!Array.isArray(selectedIds) || selectedIds.some((x) => typeof x !== "string")) {
    return { ok: false, reason: "unknown_active_boundary" };
  }
  const current = await getOwnerArenaDraft(admin, ownerUserId, draftId);
  if (!current) return { ok: false, reason: "arena_draft_not_found" };
  if (expectedRevision !== null && expectedRevision !== current.revision) return { ok: false, reason: "stale_revision" };

  const boundary = current.guided_answers.practiceBoundary;
  if (!boundary || !boundary.confirmed) return { ok: false, reason: "boundary_confirmation_required" };

  const built = buildBoundaryScope(boundary.constraints, selectedIds as string[]);
  if (!built.ok) return { ok: false, reason: built.errors[0] };

  const prev = current.guided_answers.practiceBoundaryScope;
  const changed = !prev || prev.availableKey !== built.value.availableKey || JSON.stringify([...prev.activeIds].sort()) !== JSON.stringify([...built.value.activeIds].sort());
  const nextGuided: StoredGuidedAnswers = { ...current.guided_answers, practiceBoundaryScope: built.value };

  const patch: Record<string, unknown> = {
    guided_answers: nextGuided,
    revision: current.revision + 1,
    updated_at: new Date().toISOString(),
  };
  if (changed) {
    patch.scenario_draft = null;
    patch.generation_source = null;
  }
  const { data, error } = await admin
    .from("foundry_arena_scenario_drafts")
    .update(patch)
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .eq("revision", current.revision)
    .select(DRAFT_COLS)
    .single<ArenaDraftRow>();
  if (error || !data) return { ok: false, reason: "stale_revision" };
  return { ok: true, value: { row: data, invalidated: changed } };
}

// ---------------------------------------------------------------------------
// Client projection — strips owner id
// ---------------------------------------------------------------------------

export type ClientArenaDraft = {
  id: string;
  source_event_id: string;
  source_module_version: number;
  status: "draft";
  guided_answers: StoredGuidedAnswers;
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
