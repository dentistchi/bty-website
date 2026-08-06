-- Copy-friendly (LF, no trailing spaces). Select all to copy.
--
-- PROGRAM GENERATION — PER-CALL STRUCTURAL DIAGNOSTICS (Slice 3.2L-R3).
--
-- THE LIVE FAILURE THIS EXISTS TO MAKE READABLE. The fourth controlled window burned BOTH
-- authorized provider calls on the same fault and never reached a single safety rule.
-- Everything the ledger could say afterwards was:
--
--   outcome        validation_refused
--   refusal_code   field_type
--   refusal_kind   why_it_matters
--
-- `field_type` means only "some value was not a string". TWO paths inside one element can
-- emit it — `content` and `rationale` — and `refusal_kind` carries a Journey KIND, so it
-- cannot name which. Title, assumptions, warnings and the evidence ceiling refuse with no
-- kind at all.
--
-- WHY THE CHILD TABLE, and only the child table. A structural fault is a property of ONE
-- PROVIDER CALL, not of the attempt. An attempt makes up to two calls, and they can fail
-- differently — call 1 at `elements[0].content` as an object, call 2 at
-- `elements[0].rationale` as an array. Columns on the parent can hold exactly one of
-- those, so the second write would either overwrite the first or silently disagree with
-- it. Neither is evidence. `foundry_program_generation_attempt_calls` already carries
-- `call_sequence`, which identifies precisely which call produced each diagnosis, so no
-- `failed_call_sequence` column is needed or added.
--
-- The parent table is deliberately UNCHANGED. Its existing terminal summary —
-- lifecycle_state, outcome, refusal_code, refusal_kind, started_at, finished_at — already
-- says how the attempt ended, and every structural fact is derivable from its child rows.
-- Duplicating a diagnosis upward would create two sources of truth that can contradict
-- each other, with no principled rule for which call "wins".
--
-- STILL NEVER STORED: prompts, provider responses, generated prose, rationales,
-- assumptions, private material contents, credentials. A path, an expected type and a
-- received type describe SHAPE only — `elements[0].content` says nothing about what the
-- content said.
--
-- Additive only. Every column is nullable: existing rows stay exactly as they are, and no
-- backfill is performed or implied.

begin;

alter table public.foundry_program_generation_attempt_calls
  -- Which gate refused THIS call: a shape fault the model could repair, or a meaning
  -- fault it must not be asked to "fix" by trying again.
  add column if not exists validation_stage text
    check (validation_stage is null or validation_stage in ('structural', 'semantic')),

  -- Exact location, e.g. `elements[0].content`. Bounded, and shape-only by construction.
  add column if not exists offending_path text
    check (offending_path is null or length(offending_path) <= 120),

  -- What the contract required at that path, e.g. `string`.
  add column if not exists expected_type text
    check (expected_type is null or length(expected_type) <= 60),

  -- What the provider actually sent there. The distinction the old ledger could not make:
  -- a MISSING field and an OBJECT where a string belonged are different faults with
  -- different repairs.
  add column if not exists actual_type text
    check (actual_type is null or actual_type in
      ('missing', 'null', 'string', 'object', 'array', 'number', 'boolean')),

  -- Whether one targeted repair call could plausibly have fixed THIS call's fault.
  add column if not exists structural_retryable boolean;

comment on column public.foundry_program_generation_attempt_calls.offending_path is
  'Shape-only path of a refused field (Slice 3.2L-R3), e.g. elements[0].content. Never contains generated prose.';

-- "Which shape faults keep recurring, and on which call" is the operational question this
-- arc exists to answer, and the facts live here. Partial: only refused calls carry a stage.
create index if not exists foundry_program_gen_call_structural_idx
  on public.foundry_program_generation_attempt_calls (validation_stage, actual_type, call_sequence)
  where validation_stage is not null;

commit;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed):
--   begin;
--   drop index if exists public.foundry_program_gen_call_structural_idx;
--   alter table public.foundry_program_generation_attempt_calls
--     drop column if exists validation_stage,
--     drop column if exists offending_path,
--     drop column if exists expected_type,
--     drop column if exists actual_type,
--     drop column if exists structural_retryable;
--   commit;
-- Additive only — dropping these removes diagnostics and nothing else. No attempt, call,
-- draft, event or practice row is touched by this migration.
-- ---------------------------------------------------------------------------
