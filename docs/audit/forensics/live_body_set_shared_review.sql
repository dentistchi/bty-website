-- GENERATED FORENSIC EVIDENCE — not migration authority. Do not apply to any database.
-- Live body of public.bty_foundry_set_shared_review(p_event_id uuid, p_participant_id uuid, p_owner_user_id uuid, p_status text, p_note text)
-- raw prosrc SHA-256: 52cc335a92cf65351cfc5b2378ba9c587af51e35bfd02273a26dce71909c753b
-- verified against the r2.6-attested audit digest: 52cc335a92cf65351cfc5b2378ba9c587af51e35bfd02273a26dce71909c753b
create or replace function public.bty_foundry_set_shared_review(p_event_id uuid, p_participant_id uuid, p_owner_user_id uuid, p_status text, p_note text)
returns table(result text)
language plpgsql
security definer
  set search_path = pg_catalog, public
as $bodyfx$
declare
  v_owner uuid;
  v_prog record;
  v_note text;
begin
  if p_status not in ('ALIGNED', 'PARTIALLY_CLEAR', 'FOLLOW_UP_NEEDED') then
    return query select 'invalid_status'::text; return;
  end if;
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  select owner_user_id into v_owner from public.foundry_events where id = p_event_id;
  if v_owner is null or v_owner <> p_owner_user_id then
    return query select 'not_owner'::text; return;
  end if;
  select id, shared_understanding_response, host_review_status, host_review_note
    into v_prog
    from public.foundry_event_training_progress
   where event_id = p_event_id and participant_id = p_participant_id
   for update;
  if v_prog.id is null then return query select 'no_progress'::text; return; end if;
  if v_prog.shared_understanding_response is null then
    return query select 'no_shared_response'::text; return;
  end if;
  if v_prog.host_review_status = p_status
     and coalesce(v_prog.host_review_note, '') = coalesce(v_note, '') then
    return query select 'unchanged'::text; return;
  end if;
  update public.foundry_event_training_progress
     set host_review_status = p_status, host_reviewed_at = now(),
         host_reviewed_by = p_owner_user_id, host_reviewed_by_snapshot = p_owner_user_id,
         host_review_note = v_note, updated_at = now()
   where id = v_prog.id;
  insert into public.foundry_shared_review_audit
    (event_id, participant_id, prev_status, new_status, reviewed_by, reviewed_by_snapshot, note)
  values
    (p_event_id, p_participant_id, v_prog.host_review_status, p_status, p_owner_user_id, p_owner_user_id, v_note);
  return query select 'reviewed'::text;
end
$bodyfx$;