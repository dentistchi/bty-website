-- Copy-friendly (LF, no trailing spaces). Select all to copy.
--
-- PROGRAM GENERATION — STRUCTURAL FAILURE DIAGNOSTICS (Slice 3.2L-R3).
--
-- THE LIVE FAILURE THIS EXISTS TO MAKE READABLE. The fourth controlled window burned
-- BOTH authorized provider calls on the same fault and never reached a single safety
-- rule. Everything the ledger could say afterwards was:
--
--   outcome        validation_refused
--   refusal_code   field_type
--   refusal_kind   why_it_matters
--
-- `field_type` means only "some value was not a string". TWO paths inside one element can
-- emit it — `content` and `rationale` — and `refusal_kind` carries a Journey KIND, so it
-- cannot name which. Title, assumptions, warnings and the evidence ceiling refuse with no
-- kind at all. The failure was therefore undiagnosable from durable evidence, and the
-- repair call was handed a code name with no path, so it reproduced the same fault.
--
-- WHY NEW COLUMNS RATHER THAN REUSE. Nothing existing can carry these facts honestly:
--   `refusal_code`           names the RULE that refused, not where.
--   `refusal_kind`           is a Journey kind; a field path is not a Journey kind, and
--                            overloading it would make every existing row ambiguous.
--   `provider_error_category` is transport-level (rate_limited, network); a shape fault
--                            is not a transport fault.
--   `response_sha256`        is a digest; it identifies a response, it cannot explain one.
-- Practice-generation columns are untouched and unrelated.
--
-- STILL NEVER STORED: prompts, provider responses, generated prose, rationales,
-- assumptions, private material contents, credentials. A path, an expected type and a
-- received type describe SHAPE only — `elements[0].content` says nothing about what the
-- content said.
--
-- Additive only. Every column is nullable: existing rows stay exactly as they are, and
-- no backfill is performed or implied.

begin;

alter table public.foundry_program_generation_attempts
  -- Which gate refused: a shape fault the model could repair, or a meaning fault it
  -- must not be asked to "fix" by trying again.
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

  -- Whether one targeted repair call could plausibly have fixed it. Distinguishes
  -- "the model can be told exactly what to correct" from "asking again is spend".
  add column if not exists structural_retryable boolean,

  -- Which provider call carried the fault, so a first-call failure repaired on the second
  -- is distinguishable from both calls failing identically.
  add column if not exists failed_call_sequence integer
    check (failed_call_sequence is null or (failed_call_sequence >= 1 and failed_call_sequence <= 2));

comment on column public.foundry_program_generation_attempts.offending_path is
  'Shape-only path of a refused field (Slice 3.2L-R3), e.g. elements[0].content. Never contains generated prose.';

-- Reading "which shape faults keep recurring" is the whole point of the arc, so it gets
-- an index. Partial: only refused attempts carry a stage.
create index if not exists foundry_program_gen_attempt_structural_idx
  on public.foundry_program_generation_attempts (validation_stage, actual_type, started_at desc)
  where validation_stage is not null;

commit;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed):
--   begin;
--   drop index if exists public.foundry_program_gen_attempt_structural_idx;
--   alter table public.foundry_program_generation_attempts
--     drop column if exists validation_stage,
--     drop column if exists offending_path,
--     drop column if exists expected_type,
--     drop column if exists actual_type,
--     drop column if exists structural_retryable,
--     drop column if exists failed_call_sequence;
--   commit;
-- Additive only — dropping these removes diagnostics and nothing else. No attempt, call,
-- draft, event or practice row is touched by this migration.
-- ---------------------------------------------------------------------------
