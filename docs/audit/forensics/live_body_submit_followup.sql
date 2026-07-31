-- GENERATED FORENSIC EVIDENCE — not migration authority. Do not apply to any database.
-- Live body of public.bty_foundry_submit_followup(p_followup_id uuid, p_auth_user_id uuid, p_outcome text)
-- raw prosrc SHA-256: 21cdd472fd38a9cc7414eabeda1d028857aeddccb057f9ae956b52f793f43958
-- verified against the r2.6-attested audit digest: 21cdd472fd38a9cc7414eabeda1d028857aeddccb057f9ae956b52f793f43958
create or replace function public.bty_foundry_submit_followup(p_followup_id uuid, p_auth_user_id uuid, p_outcome text)
returns table(result text, status text, outcome text)
language plpgsql
security definer
  set search_path = pg_catalog, public
as $bodyfx$
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
      return query select 'unchanged'::text, v_row.status, v_row.outcome;
    else
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
$bodyfx$;