-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — one more behaviour-contract reason: the action reclaimed an authority
-- (Slice 3.2P-R3.7)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. W6 (`6872d6db`) generated successfully under v13 and was unusable. The model
-- wrote the host's own occasion into `observable_action`, and the renderer — which owns the
-- moment since v13 — prepended it again:
--
--   "During morning huddles, you must state the owner, action, and deadline for each agreed
--    item DURING MORNING HUDDLES."
--
-- A follow-up audit found every server-owned role leaking the same way and being accepted:
-- "you state the owner…" rendered as "you must you state…", "the leader states…" as "you must
-- the leader states…". The prompt had said not to since v13; nothing checked.
--
-- v14 refuses both, under ONE reason on the EXISTING `non_observable_standard` family:
--
--   action_reclaims_authority   the action wrote WHO or WHEN, which the server composes
--
-- One reason rather than two because it is one fault — the model writing a part of the sentence
-- it does not own — and neither the host nor the product could act on the difference.
--
-- This widens the CHECK so the ledger can store it. The floor does not depend on it: the
-- refusal fires today, and `refusal_code` = `non_observable_standard` plus
-- `behavior_contract_field` = `observable_action` are already legal. Only the fine-grained
-- REASON is withheld until this runs — `storableContractReason` writes NULL for any value the
-- live CHECK would refuse, so no insert can fail on it.
--
-- SO THE ORDER IS: ship the floor (done), apply this, then widen `LIVE_CONTRACT_REASONS` in
-- `programGenerationRecorder.ts`. The same discipline every diagnostic column here followed.
--
-- SCOPE. One CHECK constraint replaced on one column. No column added or dropped, no RLS,
-- policy, grant or index touched, no row written, no backfill. Every existing row holds a value
-- from the smaller vocabulary, so the widened constraint accepts all of them.
-- ============================================================================

begin;

-- The constraint name is looked up rather than guessed: two earlier migrations replaced it and
-- the original was auto-generated, so no spelling can be assumed here.
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
      'confirmer_unauthorized',
      'action_reclaims_authority'
    ));

comment on column public.foundry_program_generation_attempt_calls.behavior_contract_reason is
  'Slice 3.2L-R7, widened 3.2P-R2.1, 3.2P-R3.2 and 3.2P-R3.7. Which validator rule the '
  'behaviour-contract role failed. Fixed vocabulary; never the rejected phrase.';

commit;

-- ROLLBACK (documented, not executed) — restores the eight-value vocabulary. Safe only while no
-- row holds the new reason; check first:
--   select count(*) from public.foundry_program_generation_attempt_calls
--     where behavior_contract_reason = 'action_reclaims_authority';
