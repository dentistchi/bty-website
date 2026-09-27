-- Announcement tracking V1. Additive; NULL mode preserves the legacy conversation contract.
-- No historical open/ack/answer evidence is inferred or backfilled.
-- Apply only after review. See docs/TEAMS_ANNOUNCEMENT_TRACKING_V1.md for rollback/order.
begin;
alter table public.bty_tracked_announcements add column if not exists tracking_mode text;
alter table public.bty_tracked_announcement_recipients
  add column if not exists opened_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists response_submitted_at timestamptz,
  add column if not exists response_text text;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.bty_tracked_announcements'::regclass and conname='announcement_tracking_mode_check') then
    alter table public.bty_tracked_announcements add constraint announcement_tracking_mode_check check (tracking_mode in ('acknowledgment','response'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.bty_tracked_announcement_recipients'::regclass and conname='announcement_response_evidence_check') then
    alter table public.bty_tracked_announcement_recipients add constraint announcement_response_evidence_check check (
      (response_submitted_at is null and response_text is null) or
      (response_submitted_at is not null and response_text is not null and char_length(btrim(response_text)) between 1 and 1000));
  end if;
end $$;
comment on column public.bty_tracked_announcements.tracking_mode is 'NULL is legacy. New runs explicitly require acknowledgment or a written response.';
comment on column public.bty_tracked_announcement_recipients.opened_at is 'First explicit BTY announcement open; never a Teams read receipt or completion.';
comment on column public.bty_tracked_announcement_recipients.acknowledged_at is 'Explicit acknowledgment only. Not inferred from open or a reply.';
comment on column public.bty_tracked_announcement_recipients.response_submitted_at is 'Explicit required written answer submitted in BTY. responded_at is a rollback compatibility shadow, never new response evidence.';

create or replace function public.bty_track_announcement_v1(
 p_owner_user_id uuid, p_actor_oid text, p_source jsonb, p_host_framing text,
 p_recipient_oids text[], p_tracking_mode text, p_service_url text
) returns table(announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql security definer set search_path=pg_catalog, public as $$
declare
 v_tenant text := lower(btrim(p_source->>'tenant_id'));
 v_conversation text := btrim(p_source->>'conversation_id');
 v_message text := btrim(p_source->>'message_id');
 v_guid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
 v_org uuid; v_oid text; v_user uuid; v_ids uuid[] := '{}'; v_oids text[] := '{}';
 v_capture uuid; v_key text; v_run record; v_resolution record;
begin
 -- Service-only does not authorize an audience. Resolve both actor and every target
 -- via the existing tenant+OID authority. No metadata/email/name authorization.
 select * into v_resolution from public.bty_resolve_user_from_microsoft_identity(v_tenant,p_actor_oid);
 if v_resolution.status is distinct from 'RESOLVED' or v_resolution.user_id is distinct from p_owner_user_id then
   raise exception 'invalid_actor' using errcode='42501';
 end if;
 if p_tracking_mode is null or p_tracking_mode not in ('acknowledgment','response') then
   raise exception 'invalid_tracking_mode' using errcode='22023';
 end if;
 if char_length(btrim(coalesce(p_host_framing,''))) not between 1 and 1000 then
   raise exception 'invalid_framing' using errcode='22023';
 end if;
 if p_source->>'provider' is distinct from 'teams' or coalesce(v_tenant,'') !~ v_guid
   or coalesce(v_conversation,'')='' or coalesce(v_message,'')='' then
   raise exception 'missing_source_identity' using errcode='22023';
 end if;
 if exists(select 1 from unnest(p_recipient_oids) o where o is null or lower(btrim(o)) !~ v_guid) then
   raise exception 'invalid_recipients' using errcode='42501';
 end if;
 -- Same active primary organization as the actor. Share locks keep membership
 -- revocation/organization deactivation from racing validation and the first write.
 select m.organization_id into v_org from public.bty_org_memberships m
 join public.bty_organizations o on o.id=m.organization_id
 where m.user_id=p_owner_user_id and m.status='active' and m.is_primary and o.status='active'
 for share of m,o;
 if v_org is null then raise exception 'invalid_actor' using errcode='42501'; end if;
 for v_oid in select distinct lower(btrim(o)) from unnest(p_recipient_oids) o order by 1 loop
   select * into v_resolution from public.bty_resolve_user_from_microsoft_identity(v_tenant,v_oid);
   if v_resolution.status is distinct from 'RESOLVED' then
     raise exception 'invalid_recipients' using errcode='42501';
   end if;
   v_user := v_resolution.user_id;
   if v_user=p_owner_user_id then continue; end if;
   perform 1 from public.bty_org_memberships m
     where m.user_id=v_user and m.organization_id=v_org and m.status='active' for share;
   if not found then raise exception 'invalid_recipients' using errcode='42501'; end if;
   if not (v_user=any(v_ids)) then
     v_ids:=array_append(v_ids,v_user); v_oids:=array_append(v_oids,v_oid);
   end if;
 end loop;
 if cardinality(v_ids)=0 then raise exception 'zero_recipients' using errcode='22023'; end if;

 -- ALL validation precedes ALL writes. Capture, run and audience share this transaction.
 -- Match resolveTeamsCaptureSource exactly; identity lookup normalizes tenant case,
 -- but the existing Save external key preserves the source spelling.
 v_key:='teams:'||btrim(p_source->>'tenant_id')||':'||v_conversation||':'||v_message;
 perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text||':'||v_key,0));
 select c.id into v_capture from public.bty_action_captures c
 where c.user_id=p_owner_user_id and c.source_type='teams_message' and c.external_key=v_key;
 if v_capture is null then
   insert into public.bty_action_captures(user_id,source_type,external_key,preview_text,source_url,source_metadata,status,saved_at)
   values(p_owner_user_id,'teams_message',v_key,left(p_source->>'preview_text',280),
     case when p_source->>'source_url' ~* '^(https:|msteams:)' then p_source->>'source_url' else null end,
     p_source-'preview_text'-'source_url','captured',null)
   on conflict(user_id,source_type,external_key) do nothing returning id into v_capture;
   if v_capture is null then
     select c.id into v_capture from public.bty_action_captures c
     where c.user_id=p_owner_user_id and c.source_type='teams_message' and c.external_key=v_key;
   end if;
 end if;
 select * into v_run from public.bty_track_announcement(p_owner_user_id,v_capture,p_host_framing,v_tenant,v_conversation,p_service_url,v_oids);
 if not v_run.already_existed then
   update public.bty_tracked_announcements set tracking_mode=p_tracking_mode where id=v_run.announcement_id;
   update public.bty_tracked_announcement_recipients r set user_id=v_ids[array_position(v_oids,r.aad_object_id)],bound_at=clock_timestamp()
   where r.announcement_id=v_run.announcement_id;
 end if;
 return query select v_run.announcement_id::uuid,v_run.resolved_count::integer,v_run.already_existed::boolean;
end $$;
revoke all on function public.bty_track_announcement_v1(uuid,text,jsonb,text,text[],text,text) from public,anon,authenticated;
grant execute on function public.bty_track_announcement_v1(uuid,text,jsonb,text,text[],text,text) to service_role;

create or replace function public.bty_record_announcement_evidence(
 p_announcement_id uuid, p_actor_user_id uuid, p_action text, p_response_text text default null
) returns table(result text)
language plpgsql security definer set search_path=pg_catalog, public as $$
declare r record; a record;
begin
 -- Non-member and missing announcement are indistinguishable. Actor comes from verified session.
 if not exists (select 1 from public.bty_tracked_announcement_recipients
   where announcement_id=p_announcement_id and user_id=p_actor_user_id) then
   return query select 'not_a_recipient'::text; return;
 end if;
 -- Lock parent before child, matching host deletion/cascade lock order.
 select * into a from public.bty_tracked_announcements where id=p_announcement_id for share;
 select * into r from public.bty_tracked_announcement_recipients
 where announcement_id=p_announcement_id and user_id=p_actor_user_id for update;
 if not found then return query select 'not_a_recipient'::text; return; end if;
 if a.owner_user_id is null or a.status <> 'active' then return query select 'closed'::text; return; end if;
 if a.tracking_mode is null then return query select 'legacy'::text; return; end if;
 if p_action='open' then
   update public.bty_tracked_announcement_recipients set opened_at=coalesce(opened_at,clock_timestamp()) where id=r.id;
 elsif p_action='acknowledge' and a.tracking_mode='acknowledgment' then
   update public.bty_tracked_announcement_recipients set acknowledged_at=coalesce(acknowledged_at,clock_timestamp()),
     responded_at=coalesce(responded_at,clock_timestamp()),response=coalesce(response,'ACKNOWLEDGED') where id=r.id;
 elsif p_action='respond' and a.tracking_mode='response' then
   if p_response_text is null or char_length(btrim(p_response_text)) not between 1 and 1000 then
     return query select 'invalid_response'::text; return;
   end if;
   -- Write once: retries preserve both original text and timestamp.
   update public.bty_tracked_announcement_recipients
   set response_submitted_at=clock_timestamp(),response_text=btrim(p_response_text),
     responded_at=coalesce(responded_at,clock_timestamp()),response=coalesce(response,'ACKNOWLEDGED')
   where id=r.id and response_submitted_at is null;
 else return query select 'invalid_action'::text; return;
 end if;
 -- Legacy response/responded_at are compatibility shadows only, not written-answer evidence.
 -- The previous Worker also uses personal dismissal versions for its Today list.
 -- Complete actions dismiss only this recipient's card at the observed HOST activity version.
 -- A later host message can still resurface it under the previous conversation contract.
 if p_action in ('acknowledge','respond') then
   insert into public.bty_today_dismissals(user_id,item_kind,item_id,dismissed_activity_version)
   select p_actor_user_id,'track_recipient',r.id,count(*)
   from public.bty_announcement_thread_messages m where m.recipient_id=r.id and m.author_role='HOST'
   on conflict(user_id,item_kind,item_id) do update
     set dismissed_at=clock_timestamp(),dismissed_activity_version=excluded.dismissed_activity_version;
 end if;
 return query select 'recorded'::text;
end $$;
revoke all on function public.bty_record_announcement_evidence(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.bty_record_announcement_evidence(uuid,uuid,text,text) to service_role;
commit;
