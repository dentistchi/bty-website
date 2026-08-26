-- Deferred completion claim V1.
--
-- An anonymous learner finishes a training and leaves. Today the only way to attach that
-- completion to an account is the participant-session cookie: 30 days, one device, HttpOnly and
-- therefore impossible to show them. Measured on 2026-08-26: 45 completions, 15 linked,
-- 30 unclaimed.
--
-- This adds a credential the learner can KEEP. Only its SHA-256 is stored; the raw code is
-- returned once, in the completion response, and never persisted.
--
-- FORWARD ONLY. Every column is nullable with no default, so the 54 existing rows are not
-- rewritten and the historical 30 stay exactly as they are — they predate proof issuance and
-- cannot be claimed safely without it.

alter table public.foundry_event_training_progress
  add column if not exists claim_secret_hash text,
  add column if not exists claim_secret_expires_at timestamptz,
  add column if not exists claim_consumed_at timestamptz;

comment on column public.foundry_event_training_progress.claim_secret_hash is
  'SHA-256 of the deferred completion claim code. The raw code is shown to the learner once and never stored.';
comment on column public.foundry_event_training_progress.claim_secret_expires_at is
  'When the claim code stops working (issued + 90 days).';
comment on column public.foundry_event_training_progress.claim_consumed_at is
  'Set when the code is redeemed. Single use: a consumed code can never link a second account.';

-- Lookup is by hash and only ever for a code that is still usable, so the index carries only
-- those rows. Unique: two completions must never share a secret.
create unique index if not exists foundry_progress_active_claim_hash_uidx
  on public.foundry_event_training_progress (claim_secret_hash)
  where claim_secret_hash is not null and claim_consumed_at is null;

/*
  THE WHOLE CLAIM, OR NONE OF IT.

  V1 first shipped this as an ownership UPDATE followed by four service calls from TypeScript —
  six transactions. A failure in any of them left the completion linked, the credential spent, and
  the same code refused on retry: partial state with no route forward, and no repair for the
  cross-device learner this feature exists for. Idempotent downstream functions do not help
  something that can never be retried.

  So the claim is one function, and one transaction. Every nested call below is an existing
  plpgsql function invoked in-process, which means it shares this transaction: `raise` anywhere
  rolls back the ownership, the linkage, the ledger row and the consumption together, and the
  learner's code is still unspent.

  WHAT TYPESCRIPT DOES FIRST, AND WHY IT IS SAFE. The two materializers need day arithmetic and
  timezone resolution that live in TypeScript (`resolveUserTzContext`, `computeFollowUpDue`,
  `computeApplyWindow`), exactly as the room path already computes them. Those are READ-ONLY
  lookups plus pure computation, performed before this call and passed in. They can be computed
  from a read because nothing here depends on a value that only exists after the mutation. A row
  consumed between that read and this call simply fails the predicate below and nothing commits.

  ELIGIBILITY IS DECIDED BY THE CALLER, ENFORCEMENT BY THIS FUNCTION. A null `p_follow_up_days`
  or `p_apply_days` means "this training owes none" and the call is skipped. When one IS owed and
  the nested function does not report `created` or `exists`, that is an unexpected downstream
  result and the whole claim is refused — a skipped obligation must never be mistaken for a
  converged one.
*/
create or replace function public.bty_foundry_redeem_completion_claim(
  p_claim_hash text,
  p_user_id uuid,
  p_timezone text,
  p_source_training_title text,
  p_assignment_id uuid,
  p_organization_id uuid,
  p_follow_up_days integer,
  p_fu_completion_bty_day date,
  p_fu_due_bty_day date,
  p_fu_due_at timestamptz,
  p_apply_days integer,
  p_ap_completion_bty_day date,
  p_ap_due_bty_day date,
  p_ap_due_at timestamptz,
  p_xp integer,
  p_xp_eligible boolean,
  p_day_start timestamptz,
  p_day_end timestamptz
)
returns table (
  progress_id uuid,
  event_id uuid,
  xp_result text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_progress_id uuid;
  v_event_id uuid;
  v_participant_id uuid;
  v_completed_at timestamptz;
  v_xp_awarded_at timestamptz;
  v_participant_user uuid;
  v_result text;
  v_xp_result text := 'not_attempted';
begin
  /*
    1. LOCATE AND LOCK. Every precondition is in this predicate, so a concurrent redemption is
       decided by the row lock: one caller holds it, the other finds nothing and is refused.
  */
  select p.id, p.event_id, p.participant_id, p.completed_at, p.xp_awarded_at
    into v_progress_id, v_event_id, v_participant_id, v_completed_at, v_xp_awarded_at
    from public.foundry_event_training_progress p
   where p.claim_secret_hash = p_claim_hash
     and p.completed_at is not null
     and p.linked_user_id is null
     and p.claim_consumed_at is null
     and p.claim_secret_expires_at is not null
     and p.claim_secret_expires_at > now()
   for update;

  if v_progress_id is null then
    return;  -- no row, nothing locked, nothing written
  end if;

  /*
    2. ACCOUNT ATTRIBUTION, unchanged from `mayAttributeToAccount`: an anonymous participant is
       never a conflict, the same account is allowed, a different account is refused. No Host
       override exists here and none is added. Refusal happens before any mutation.
  */
  select fp.user_id into v_participant_user
    from public.foundry_event_participants fp
   where fp.id = v_participant_id;

  if v_participant_user is not null and v_participant_user <> p_user_id then
    return;
  end if;

  -- 3. OWNERSHIP.
  update public.foundry_event_training_progress
     set linked_user_id = p_user_id, updated_at = now()
   where id = v_progress_id;

  -- 4. ASSIGNMENT. `not_applicable` is a truthful outcome for open-link learning, not a failure.
  perform public.bty_foundry_claim_assignment(v_event_id, v_participant_id, p_user_id);

  -- 5. FOLLOW-UP, when this training owes one.
  if p_follow_up_days is not null then
    select result into v_result from public.bty_foundry_materialize_followup(
      v_event_id, v_progress_id, p_assignment_id, p_organization_id, p_user_id,
      p_source_training_title, p_follow_up_days, v_completed_at, p_timezone,
      p_fu_completion_bty_day, p_fu_due_bty_day, p_fu_due_at
    );
    if v_result is distinct from 'created' and v_result is distinct from 'exists' then
      raise exception 'claim_followup_unexpected: %', coalesce(v_result, 'null');
    end if;
  end if;

  -- 6. APPLY WINDOW, when this training owes one.
  if p_apply_days is not null then
    select result into v_result from public.bty_foundry_materialize_apply_window(
      v_event_id, v_progress_id, p_assignment_id, p_organization_id, p_user_id,
      p_source_training_title, p_apply_days, v_completed_at, p_timezone,
      p_ap_completion_bty_day, p_ap_due_bty_day, p_ap_due_at
    );
    if v_result is distinct from 'created' and v_result is distinct from 'exists' then
      raise exception 'claim_apply_unexpected: %', coalesce(v_result, 'null');
    end if;
  end if;

  /*
    7. XP, ONCE. The existing daily-capped ledger function is the only authority; `daily_limit`,
       `already_awarded` and `event_already_awarded` are all truthful non-awards under the shipped
       contract and must not fail the claim. `xp_awarded_at` is stamped only on a real award, by
       the same predicate the room path uses.
  */
  if p_xp_eligible and v_xp_awarded_at is null then
    v_xp_result := public.bty_foundry_award_daily_capped(
      p_user_id, v_event_id, v_progress_id::text, p_xp, p_day_start, p_day_end
    );
    if v_xp_result = 'awarded' then
      update public.foundry_event_training_progress
         set xp_awarded_at = now()
       where id = v_progress_id and xp_awarded_at is null;
    end if;
  elsif v_xp_awarded_at is not null then
    v_xp_result := 'already_awarded';
  else
    v_xp_result := 'owner_ineligible';
  end if;

  /*
    8. CONSUME LAST. A code is terminally spent if and only if the claim has fully converged —
       every statement above committed, or this one never runs.
  */
  update public.foundry_event_training_progress
     set claim_consumed_at = now()
   where id = v_progress_id;

  return query select v_progress_id, v_event_id, v_xp_result;
end;
$$;

drop function if exists public.bty_foundry_redeem_completion_claim(text, uuid);

revoke all on function public.bty_foundry_redeem_completion_claim(
  text, uuid, text, text, uuid, uuid, integer, date, date, timestamptz,
  integer, date, date, timestamptz, integer, boolean, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.bty_foundry_redeem_completion_claim(
  text, uuid, text, text, uuid, uuid, integer, date, date, timestamptz,
  integer, date, date, timestamptz, integer, boolean, timestamptz, timestamptz
) to service_role;
