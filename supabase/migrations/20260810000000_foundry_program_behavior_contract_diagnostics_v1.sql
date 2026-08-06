-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — behaviour-contract diagnostics on the program CALL row (Slice 3.2L-R7)
--
-- HELD until a Founder SQL gate. `supabase db push` does not scan this directory.
--
-- WHY IT EXISTS. The first v4 live window refused `non_observable_standard` and the ledger
-- could say only that, plus `refusal_kind = observable_standard` and
-- `offending_path = elements.observable_standard`. The validator had already computed
-- exactly which of the four behavioural roles failed and why — and threw it away. So the
-- reconciliation could not tell a vague verb from a missing confirmation signal, or a
-- genuine model miss from a lexical false positive in the validator. That is the same gap
-- 20260809000000 closed for dependency refusals, one level up.
--
-- WHAT IS STORED. Two closed vocabularies, taken from the domain validator itself:
--
--   behavior_contract_field   which of the four roles failed
--   behavior_contract_reason  which rule it failed
--
-- The REJECTED PHRASE IS NEVER STORED. Neither column can hold a sentence the provider
-- wrote: both are CHECK-constrained to fixed lists, and the field name is the provider's
-- own spelling (`observable_action`), not the Host's or the model's words.
--
-- Overloading `expected_type`, `actual_type`, `offending_path`, the dependency columns or
-- the provider error fields was rejected: each already means something precise, and a
-- diagnostic column that means two things is how the R3 window became undiagnosable.
--
-- SCOPE. Additive and nullable. Child call table only. No backfill — historical rows keep
-- NULL, which is the honest value for calls that predate the diagnosis. No RLS, policy,
-- grant, index or existing constraint is touched, and no row is written.
-- ============================================================================

begin;

alter table public.foundry_program_generation_attempt_calls
  add column if not exists behavior_contract_field text
    check (behavior_contract_field is null or behavior_contract_field in (
      'actor',
      'trigger',
      'observable_action',
      'completion_signal'
    ));

alter table public.foundry_program_generation_attempt_calls
  add column if not exists behavior_contract_reason text
    check (behavior_contract_reason is null or behavior_contract_reason in (
      'missing',
      'too_long',
      'meta_only',
      'not_a_role',
      'no_moment',
      'no_confirmation'
    ));

comment on column public.foundry_program_generation_attempt_calls.behavior_contract_field is
  'Slice 3.2L-R7. Which behaviour-contract role a non_observable_standard refusal failed on. Fixed vocabulary; never prose.';
comment on column public.foundry_program_generation_attempt_calls.behavior_contract_reason is
  'Slice 3.2L-R7. Which validator rule that role failed. Fixed vocabulary; never the rejected phrase.';

commit;

-- ROLLBACK (documented, shadow-tested, not executed):
--   begin;
--   alter table public.foundry_program_generation_attempt_calls
--     drop column if exists behavior_contract_field,
--     drop column if exists behavior_contract_reason;
--   commit;
