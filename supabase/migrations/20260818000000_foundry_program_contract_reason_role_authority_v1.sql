-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — two more behaviour-contract reasons: who the program is for (Slice 3.2P-R3.2)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. W3 generated successfully for a draft whose Host audience is `leaders`, and
-- the accepted contract read `actor: "a team member"` with `completion.confirmed_by: "the team
-- lead"`. The source names "team members" only as the people who REPORT problems and leave
-- without naming an owner — the population the training is ABOUT, not the one it is FOR — and
-- "team lead" appears nowhere. The Host's evidence sentence is agentless; nobody was named as
-- the recorder. Both fields passed every check, because `audienceType` reached the prompt and
-- never reached a validator, and one invented word then rendered into all four derived
-- instructional sections.
--
-- The floor added in 3.2P-R3.2 produces two new closed-vocabulary reasons on the EXISTING
-- `non_observable_standard` refusal family:
--
--   actor_unauthorized       the actor speaks for a population the host did not choose
--   confirmer_unauthorized   the confirmer is a responsibility-bearing person nobody named
--
-- This widens the CHECK so the ledger can store them. The floor itself does not depend on it:
-- the refusal fires today, and `refusal_code` = `non_observable_standard` plus
-- `behavior_contract_field` = `actor` / `completion_signal` are already legal. Only the
-- fine-grained REASON is withheld until this runs — `storableContractReason` writes NULL for
-- any value the live CHECK would refuse, so no insert can ever fail on it.
--
-- SO THE ORDER IS: ship the floor (done), apply this, then widen `LIVE_CONTRACT_REASONS` in
-- `programGenerationRecorder.ts`. The same discipline every diagnostic column here followed.
--
-- SCOPE. One CHECK constraint replaced on one column. No column added or dropped, no RLS,
-- policy, grant or index touched, no row written, no backfill. Every existing row holds a value
-- from the smaller vocabulary, so the widened constraint accepts all of them.
-- ============================================================================

begin;

-- The constraint name is looked up rather than guessed: 20260816000000 replaced the original
-- auto-generated (and truncated) name, so neither spelling can be assumed here.
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
      'interrogative_action',
      'actor_unauthorized',
      'confirmer_unauthorized'
    ));

comment on column public.foundry_program_generation_attempt_calls.behavior_contract_reason is
  'Slice 3.2L-R7, widened 3.2P-R2.1 and 3.2P-R3.2. Which validator rule the behaviour-contract '
  'role failed. Fixed vocabulary; never the rejected phrase.';

commit;

-- ROLLBACK (documented, not executed) — restores the seven-value vocabulary. Safe only while no
-- row holds either new reason; check first:
--   select count(*) from public.foundry_program_generation_attempt_calls
--     where behavior_contract_reason in ('actor_unauthorized', 'confirmer_unauthorized');
