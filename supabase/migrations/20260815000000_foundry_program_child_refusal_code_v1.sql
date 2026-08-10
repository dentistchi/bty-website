-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — each generation CALL keeps its own refusal reason (Slice 3.2P-R0)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. The fourth pilot window ran two calls: an authorship call refused on
-- `elements.reflection`, then a bounded repair that dropped an element and was refused
-- `missing_required_kind`. The PARENT records one refusal — the last one — so the first
-- call's code was unrecoverable afterwards. Measured: `refusal_code` and `refusal_kind`
-- exist on `foundry_program_generation_attempts` and on NO child column, while the child
-- already carries `validation_stage`, `offending_path`, `expected_type`, `actual_type`,
-- `structural_retryable`, the three dependency columns and the two behaviour-contract
-- columns. So the gap is the schema's, not the recorder's — classification C.
--
-- The R0 repair envelope narrows the damage: a repair that leaves its licence is now
-- discarded and the parent terminates on the ORIGINAL refusal, so that specific case is
-- already diagnosable. What remains unrecoverable is the first call's code when the repair
-- SUCCEEDS, or when it fails validation honestly inside its licence. Those are the cases
-- these columns exist for.
--
-- WHAT IS STORED. The same closed vocabularies the parent already stores, per call. No
-- proposal prose, no model words, no new kind of fact — only which named refusal that call
-- produced. The R7 privacy rule is unchanged: a rejected proposal body is still never
-- persisted anywhere.
--
-- NO CHECK CONSTRAINT ON THE CODE. The parent's own `refusal_code` is unconstrained text,
-- and adding a stricter vocabulary here than the column it mirrors would refuse a
-- legitimate future code at write time — the exact failure the dependency-diagnostics
-- migration warned about. `refusal_kind` mirrors the parent for the same reason.
--
-- SCOPE. Additive and nullable. Child call table only. No backfill: historical rows keep
-- NULL, which is honest — those calls predate the column. No RLS, policy, grant, index or
-- constraint on any existing column is touched, and no row is written.
--
-- DEPLOY ORDER. The write path is NOT in the deployed build. Code that writes an absent
-- column would break every generation, so the recorder is left untouched until this
-- migration is applied; wiring it is a separate, smaller slice.
-- ============================================================================

begin;

alter table public.foundry_program_generation_attempt_calls
  add column if not exists refusal_code text;

alter table public.foundry_program_generation_attempt_calls
  add column if not exists refusal_kind text;

comment on column public.foundry_program_generation_attempt_calls.refusal_code is
  'Slice 3.2P-R0 — the refusal THIS call produced, independent of the parent''s final '
  'outcome. Needed because a repaired parent records only the last refusal. Never prose.';
comment on column public.foundry_program_generation_attempt_calls.refusal_kind is
  'Slice 3.2P-R0 — the Journey element kind THIS call''s refusal named, or NULL.';

commit;

-- ROLLBACK (documented, not executed):
--   begin;
--   alter table public.foundry_program_generation_attempt_calls
--     drop column if exists refusal_code,
--     drop column if exists refusal_kind;
--   commit;
