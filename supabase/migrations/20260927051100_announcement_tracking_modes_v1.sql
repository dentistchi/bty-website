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
comment on column public.bty_tracked_announcement_recipients.response_submitted_at is 'Explicit required written answer submitted in BTY. Legacy responded_at remains unchanged.';

create or replace function public.bty_track_announcement_v1(
 p_owner_user_id uuid, p_source_capture_id uuid, p_host_framing text,
 p_tenant_id text, p_conversation_id text, p_service_url text,
 p_recipient_oids text[], p_tracking_mode text
) returns table(announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql security definer set search_path=pg_catalog, public as $$
declare r record;
begin
 if p_tracking_mode is null or p_tracking_mode not in ('acknowledgment','response') then
   raise exception 'invalid_tracking_mode' using errcode='22023';
 end if;
 if not exists (select 1 from public.bty_action_captures c where c.id=p_source_capture_id and c.user_id=p_owner_user_id) then
   raise exception 'invalid_source_owner' using errcode='42501';
 end if;
 -- Serialize retries before the existing idempotency check. No recipient set/mode rewrite on retry.
 perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text || ':' || p_source_capture_id::text, 0));
 select * into r from public.bty_track_announcement(p_owner_user_id,p_source_capture_id,p_host_framing,p_tenant_id,p_conversation_id,p_service_url,p_recipient_oids);
 if not r.already_existed then
   update public.bty_tracked_announcements set tracking_mode=p_tracking_mode where id=r.announcement_id;
 end if;
 return query select r.announcement_id::uuid,r.resolved_count::integer,r.already_existed::boolean;
end $$;
revoke all on function public.bty_track_announcement_v1(uuid,uuid,text,text,text,text,text[],text) from public,anon,authenticated;
grant execute on function public.bty_track_announcement_v1(uuid,uuid,text,text,text,text,text[],text) to service_role;

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
   update public.bty_tracked_announcement_recipients set acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) where id=r.id;
 elsif p_action='respond' and a.tracking_mode='response' then
   if p_response_text is null or char_length(btrim(p_response_text)) not between 1 and 1000 then
     return query select 'invalid_response'::text; return;
   end if;
   -- Write once: retries preserve both original text and timestamp.
   update public.bty_tracked_announcement_recipients
   set response_submitted_at=clock_timestamp(),response_text=btrim(p_response_text)
   where id=r.id and response_submitted_at is null;
 else return query select 'invalid_action'::text; return;
 end if;
 return query select 'recorded'::text;
end $$;
revoke all on function public.bty_record_announcement_evidence(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.bty_record_announcement_evidence(uuid,uuid,text,text) to service_role;
commit;
