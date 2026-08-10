-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — widen the behaviour-contract reason vocabulary by ONE (Slice 3.2P-R2.1)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. Migration 20260810000000 pinned `behavior_contract_reason` to six values in
-- a CHECK constraint. Slice 3.2P-R2.1 adds a seventh reason to the domain validator —
-- `interrogative_action` — because the live pilot proved a QUESTION could be supplied as
-- `behavior_contract.observable_action` and pass every existing rule, reaching the learner as
-- "…the huddle leader must at the next huddle, what exact words will you use…?".
--
-- The validator repair does NOT depend on this migration: the refusal fires today, and the
-- ledger still records `refusal_code = non_observable_standard` and
-- `behavior_contract_field = observable_action`, both already legal. Only the fine-grained
-- REASON is withheld — the recorder stores NULL for any reason this CHECK would refuse
-- (`storableContractReason`), because writing an illegal value would fail the entire child
-- update and lose every other diagnostic on that row to record one.
--
-- SO THE ORDER IS: ship the validator (done), apply this, then widen
-- `LIVE_CONTRACT_REASONS` in `programGenerationRecorder.ts` to include the new value. That is
-- the same deploy-order discipline the dependency, behaviour-contract and child-refusal
-- diagnostics each followed.
--
-- WHY NOT DROP THE CHECK ENTIRELY. It is doing real work: this column exists so a refusal is
-- diagnosable from a closed vocabulary rather than from prose, and an unconstrained column
-- invites exactly the prose it was created to keep out. The parent's `refusal_code` is
-- deliberately unconstrained for a different reason — it mirrors a much larger and faster-
-- moving vocabulary. Six-to-seven is a vocabulary change, not a policy change.
--
-- SCOPE. One CHECK constraint replaced on one column. No column added or dropped, no RLS,
-- policy, grant or index touched, no row written, no backfill. Existing rows all hold values
-- from the old vocabulary, so the widened constraint accepts every one of them.
-- ============================================================================

begin;

-- The existing constraint was auto-named by Postgres and its name is TRUNCATED to 63 bytes,
-- so it is looked up rather than guessed. Guessing a truncated identifier is how a migration
-- silently no-ops (`drop ... if exists` on a wrong name) and then fails on the add.
do $$
declare
  c text;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join pg_attribute att
        on att.attrelid = rel.oid and att.attnum = any (con.conkey)
     where ns.nspname = 'public'
       and rel.relname = 'foundry_program_generation_attempt_calls'
       and con.contype = 'c'
       and att.attname = 'behavior_contract_reason'
  loop
    execute format('alter table public.foundry_program_generation_attempt_calls drop constraint %I', c);
  end loop;
end $$;

alter table public.foundry_program_generation_attempt_calls
  add constraint foundry_program_call_behavior_contract_reason_check
    check (behavior_contract_reason is null or behavior_contract_reason in (
      'missing',
      'too_long',
      'meta_only',
      'not_a_role',
      'no_moment',
      'no_confirmation',
      'interrogative_action'
    ));

comment on column public.foundry_program_generation_attempt_calls.behavior_contract_reason is
  'Slice 3.2L-R7, widened 3.2P-R2.1. Which validator rule the behaviour-contract role failed. '
  'Fixed vocabulary; never the rejected phrase.';

commit;

-- ROLLBACK (documented, not executed) — restores the six-value vocabulary. Safe only while no
-- row holds 'interrogative_action'; check first:
--   select count(*) from public.foundry_program_generation_attempt_calls
--     where behavior_contract_reason = 'interrogative_action';
--
--   begin;
--   alter table public.foundry_program_generation_attempt_calls
--     drop constraint if exists foundry_program_call_behavior_contract_reason_check;
--   alter table public.foundry_program_generation_attempt_calls
--     add constraint foundry_program_call_behavior_contract_reason_check
--       check (behavior_contract_reason is null or behavior_contract_reason in (
--         'missing', 'too_long', 'meta_only', 'not_a_role', 'no_moment', 'no_confirmation'));
--   commit;
