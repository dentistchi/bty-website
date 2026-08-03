-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2I-R5B2-R5C-4A1 — canonical GENERATION-INPUT revision.
-- ============================================================================
-- WHY
-- R5C-4A measured that the existing `revision` column is an OPTIMISTIC-CONCURRENCY
-- token, not a version of the generation input. It increments on writes that leave
-- the generation input identical:
--
--   * `saveArenaDraftEdits`      — edits the generated scenario OUTPUT
--   * successful regeneration    — persists the scenario
--   * an IDEMPOTENT boundary or scope save — changes nothing at all
--
-- Same-input retry governance built on that field would ship a live bypass: re-saving
-- the same boundary bumps `revision`, the earlier refusals appear to belong to a
-- different revision, and identical input becomes eligible to spend again.
--
-- So the two meanings are separated rather than overloaded. `revision` keeps its
-- concurrency contract EXACTLY as it is — every `.eq("revision", …)` guard and every
-- `stale_revision` response depends on it bumping on every write. This new column
-- answers a different question: has the input the model actually receives changed?
--
-- THE CANONICAL GENERATION INPUT, measured from the production call site:
--   guided setup answers, the confirmed practice boundary, and the active-rule scope.
-- The module facts are frozen at creation by source identity and cannot drift.
--
-- LEGACY BASELINE. Existing drafts read 1. That does NOT claim their input never
-- changed; it declares the CURRENT stored input to be baseline epoch 1 for future
-- governance. Existing attempts stay NULL — they predate the contract, and a NULL is
-- honest where a fabricated number would not be.
--
-- ADDITIVE ONLY: two columns. No row is updated, no attempt is backfilled, no child
-- row is touched, no business content is rewritten, and no trigger is defined.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DRAFT — the authority for the current input epoch.
--
-- NOT NULL with a constant default. On PostgreSQL 11+ this is a CATALOG-ONLY change:
-- existing rows read 1 without a table rewrite, so no business column and no
-- `updated_at` is touched. The default REMAINS for future inserts as a safety net,
-- but `createArenaDraft` supplies the value explicitly so the application never
-- depends on a database default to establish semantics.
-- ---------------------------------------------------------------------------
alter table public.foundry_arena_scenario_drafts
  add column if not exists generation_input_revision integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foundry_arena_scenario_drafts'::regclass
      and conname = 'foundry_arena_draft_gen_input_rev_chk'
  ) then
    alter table public.foundry_arena_scenario_drafts
      add constraint foundry_arena_draft_gen_input_rev_chk
      check (generation_input_revision >= 1);
  end if;
end $$;

comment on column public.foundry_arena_scenario_drafts.generation_input_revision is
  'Semantic version of the CANONICAL GENERATION INPUT (guided setup answers + confirmed boundary + active-rule scope). Increments once per MEANINGFUL input change; unchanged by idempotent saves, scenario edits, generation outcomes and reads. Distinct from `revision`, which is the optimistic-concurrency row token and must keep its own behaviour.';

-- ---------------------------------------------------------------------------
-- PARENT ATTEMPT — which input epoch this attempt was made against.
--
-- NULLABLE on purpose. The two historical attempts were recorded before this
-- contract existed; writing 1 into them would assert something never measured.
-- NULL means "predates the contract", and the later governance slice reads it that
-- way explicitly rather than by coincidence.
-- ---------------------------------------------------------------------------
alter table public.foundry_practice_generation_attempts
  add column if not exists generation_input_revision integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foundry_practice_generation_attempts'::regclass
      and conname = 'foundry_practice_gen_attempt_input_rev_chk'
  ) then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_input_rev_chk
      check (generation_input_revision is null or generation_input_revision >= 1);
  end if;
end $$;

comment on column public.foundry_practice_generation_attempts.generation_input_revision is
  'The draft generation_input_revision this attempt was started against. NULL ONLY for attempts predating Slice R5C-4A1 — never backfilled, because a fabricated epoch would be indistinguishable from a measured one. `draft_revision` remains the concurrency token recorded alongside it.';

-- Same-epoch attempt lookup for the governance slice that follows.
create index if not exists foundry_practice_gen_attempt_input_rev_idx
  on public.foundry_practice_generation_attempts (draft_id, generation_input_revision)
  where generation_input_revision is not null;

-- ---------------------------------------------------------------------------
-- RLS and grants are deliberately UNTOUCHED. Adding a column changes neither, and
-- restating them here would risk widening a posture this migration has no business
-- changing.
--
-- ROLLBACK (reviewed, NOT executed). Dropping the columns loses every recorded input
-- epoch and returns governance to the ambiguity R5C-4A measured:
--
--   drop index if exists public.foundry_practice_gen_attempt_input_rev_idx;
--   alter table public.foundry_practice_generation_attempts
--     drop constraint if exists foundry_practice_gen_attempt_input_rev_chk,
--     drop column if exists generation_input_revision;
--   alter table public.foundry_arena_scenario_drafts
--     drop constraint if exists foundry_arena_draft_gen_input_rev_chk,
--     drop column if exists generation_input_revision;
-- ---------------------------------------------------------------------------
