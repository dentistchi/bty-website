-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Foundry Follow-up SUBMIT RPC — plpgsql ambiguity HOTFIX (Slice 3.1B-3K).
-- ===========================================================================
-- DEFECT (live, device gate B): bty_foundry_submit_followup raised
--   42702 "column reference \"status\" is ambiguous" on EVERY valid-outcome
--   call, because its OUT parameters (status, outcome) share names with the
--   foundry_participant_followups columns referenced UNQUALIFIED in the
--   SELECT ... INTO and UPDATE ... SET, and plpgsql's default
--   variable_conflict = error refuses to resolve them. The error fires at the
--   SELECT (before any write), so submissions failed with NO row change and NO
--   RESPONDED audit — exactly the observed "That couldn't be saved" with the row
--   still PENDING. materialize (OUT=result only) and get_my_followup (LANGUAGE
--   sql, fully qualified) were unaffected.
--
-- FIX: add `#variable_conflict use_column` so an ambiguous bare name resolves to
--   the COLUMN (the intended target of the SELECT/UPDATE). The signature, return
--   shape (result, status, outcome), grants, and all result semantics are
--   UNCHANGED — this is a create-or-replace of the body only, so the deployed
--   Worker (which calls the same RPC) needs NO change. First-response-wins,
--   idempotent-unchanged, and never-overwrite behaviors are preserved verbatim.
--
-- ROLLBACK: re-apply the original (buggy) definition from 20260728000000. There
--   is nothing to undo in data — this migration touches no rows.
-- ===========================================================================

create or replace function public.bty_foundry_submit_followup(
  p_followup_id uuid,
  p_auth_user_id uuid,
  p_outcome text
)
returns table (result text, status text, outcome text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_row record;
begin
  if p_outcome not in ('APPLIED', 'PARTLY_APPLIED', 'NOT_YET', 'BLOCKED') then
    return query select 'invalid_outcome'::text, null::text, null::text;
    return;
  end if;

  select f.id, f.user_id_snapshot, f.status, f.outcome, f.event_id
    into v_row
    from public.foundry_participant_followups f
   where f.id = p_followup_id
   for update;

  if v_row.id is null then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;
  if v_row.user_id_snapshot is distinct from p_auth_user_id then
    return query select 'not_owner'::text, null::text, null::text;
    return;
  end if;

  if v_row.status = 'RESPONDED' then
    if v_row.outcome = p_outcome then
      -- idempotent identical resubmission
      return query select 'unchanged'::text, v_row.status, v_row.outcome;
    else
      -- conflicting second outcome must NOT silently overwrite the first
      return query select 'already_responded'::text, v_row.status, v_row.outcome;
    end if;
  end if;

  update public.foundry_participant_followups
     set status = 'RESPONDED',
         outcome = p_outcome,
         responded_at = now(),
         updated_at = now()
   where id = p_followup_id;

  insert into public.foundry_participant_followup_audit
    (followup_id, event_id, user_id_snapshot, event_type, previous_status, new_status, outcome, actor_user_id)
  values
    (p_followup_id, v_row.event_id, p_auth_user_id, 'RESPONDED', 'PENDING', 'RESPONDED', p_outcome, p_auth_user_id);

  return query select 'responded'::text, 'RESPONDED'::text, p_outcome;
end
$$;

revoke all on function public.bty_foundry_submit_followup(uuid, uuid, text)
  from anon, public, authenticated;
grant execute on function public.bty_foundry_submit_followup(uuid, uuid, text)
  to service_role;
