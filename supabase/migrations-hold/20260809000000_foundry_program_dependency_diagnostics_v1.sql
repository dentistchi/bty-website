-- ============================================================================
-- Foundry — precise dependency diagnostics on the program CALL row (Slice 3.2L-R6)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. The R5 live refusal recorded `dependency_inversion` /
-- `refusal_kind = why_it_matters` / `offending_path = elements.why_it_matters`. From that,
-- the BRANCH happened to be inferable (only `used_before_defined` can fire for a section
-- other than `completion_check`), but three things were not durably observable:
--
--   * which branch fired, as data rather than as an inference;
--   * which operational construct the section depended on;
--   * for `defined_after_use`, which earlier section had already required it.
--
-- Overloading `offending_path`, `expected_type`, `actual_type` or `provider_error_category`
-- to carry these was rejected: each has a precise existing meaning, and a diagnostic column
-- that means two things is how the R3 window became undiagnosable in the first place.
--
-- WHAT IS STORED. Fixed controlled vocabularies only. `construct_kind` is a head noun from
-- the closed CONSTRUCT_NOUNS list, which is diagnostic metadata, not model output. A raw
-- generated noun phrase is prose and is deliberately NOT stored here — no column added by
-- this migration can hold a sentence the provider wrote.
--
-- SCOPE. Additive and nullable. Child call table only. No backfill: historical rows keep
-- NULL, which is the honest value — those attempts predate the diagnosis. No RLS, policy,
-- grant, index or constraint on any existing column is touched, and no row is written.
-- ============================================================================

begin;

alter table public.foundry_program_generation_attempt_calls
  add column if not exists dependency_branch text
    check (dependency_branch is null or dependency_branch in (
      'used_before_defined',
      'defined_after_use',
      'authority_mismatch'
    ));

alter table public.foundry_program_generation_attempt_calls
  add column if not exists dependency_construct_kind text
    check (dependency_construct_kind is null or dependency_construct_kind in (
      'standard', 'process', 'workflow', 'guideline', 'framework',
      'criterion', 'agreement', 'norm', 'rubric',
      'convention', 'routine', 'ritual', 'cadence', 'practice',
      'none'
    ));

-- One Journey element kind, or NULL when the branch has no counterpart.
alter table public.foundry_program_generation_attempt_calls
  add column if not exists dependency_counterpart_kind text
    check (dependency_counterpart_kind is null or dependency_counterpart_kind in (
      'why_it_matters', 'observable_standard', 'scenario', 'reflection',
      'action_decision', 'field_application', 'evidence', 'completion_check', 'follow_up'
    ));

comment on column public.foundry_program_generation_attempt_calls.dependency_branch is
  'Slice 3.2L-R6. Which ordered-dependency rule refused. Fixed vocabulary; never prose.';
comment on column public.foundry_program_generation_attempt_calls.dependency_construct_kind is
  'Slice 3.2L-R6. Closed-vocabulary head noun of the construct depended on. Never a generated phrase.';
comment on column public.foundry_program_generation_attempt_calls.dependency_counterpart_kind is
  'Slice 3.2L-R6. For defined_after_use, the earlier section that already required the construct.';

commit;

-- ROLLBACK (documented, not executed):
--   begin;
--   alter table public.foundry_program_generation_attempt_calls
--     drop column if exists dependency_branch,
--     drop column if exists dependency_construct_kind,
--     drop column if exists dependency_counterpart_kind;
--   commit;
