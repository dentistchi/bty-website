-- Recover an initial Track notice when the inline Worker cannot finish delivery.
-- Apply before the Worker that runs the new scheduled handler.
begin;

-- Existing recipients stay NULL. Setting the default separately only enrolls
-- future inserts, in the same transaction as their Track.
alter table public.bty_tracked_announcement_recipients
  add column if not exists initial_notice_retry_at timestamptz;
alter table public.bty_tracked_announcement_recipients
  alter column initial_notice_retry_at set default (now() + interval '1 minute');

create index if not exists bty_track_initial_notice_due_idx
  on public.bty_tracked_announcement_recipients (initial_notice_retry_at, id)
  where initial_notice_retry_at is not null
    and notified_at is null
    and notification_send_started_at is null;

create or replace function public.bty_track_initial_notice_pending(
  p_mode text,
  p_acknowledged_at timestamptz,
  p_response_submitted_at timestamptz,
  p_legacy_response text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select case p_mode
    when 'acknowledgment' then p_acknowledged_at is null
    when 'response' then p_response_submitted_at is null
    else p_legacy_response is null
  end;
$$;

-- This reserves a bounded batch for the scheduled Worker. The separate, existing
-- send claim is still required for every delivery, including HTTP callbacks and
-- manual retries. If the Worker dies before a safe send, the next due time
-- survives. A send whose outcome is ambiguous stays out of future batches.
create or replace function public.bty_reserve_due_track_initial_notices(p_limit integer)
returns table (recipient_id uuid, owner_user_id uuid)
language sql
security invoker
set search_path = pg_catalog
as $$
  with due as (
    select r.id, a.owner_user_id
    from public.bty_tracked_announcement_recipients r
    join public.bty_tracked_announcements a on a.id = r.announcement_id
    where r.initial_notice_retry_at <= statement_timestamp()
      and r.notified_at is null
      and r.notification_send_started_at is null
      and (r.notification_claim_expires_at is null or r.notification_claim_expires_at <= statement_timestamp())
      and a.status = 'active'
      and a.owner_user_id is not null
      and public.bty_track_initial_notice_pending(
        a.tracking_mode, r.acknowledged_at, r.response_submitted_at, r.response
      )
    order by r.initial_notice_retry_at, r.id
    limit greatest(0, least(24, coalesce(p_limit, 0)))
    for update of r skip locked
  )
  update public.bty_tracked_announcement_recipients r
  set initial_notice_retry_at = statement_timestamp() + interval '15 minutes'
  from due
  where r.id = due.id
  returning r.id, due.owner_user_id;
$$;

-- Recheck activity and completion when claiming and at the send boundary, for
-- both the scheduled Worker and existing callers. Keep the RPC signatures and
-- claim/confirmation rules.
create or replace function public.bty_begin_recipient_notification(
  p_recipient_id uuid,
  p_owner_user_id uuid
)
returns table (
  result text,
  claim_token uuid,
  tenant_id text,
  aad_object_id text,
  service_url text,
  host_framing text,
  conversation_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_announcement uuid;
  v_mode text;
  v_notified timestamptz;
  v_tenant text;
  v_aad text;
  v_ann_url text;
  v_framing text;
  v_ref_url text;
  v_ref_conv text;
  v_claim uuid;
  v_expires timestamptz;
  v_started timestamptz;
  v_new uuid;
  v_now timestamptz := now();
begin
  -- Lock parent before recipient, as in evidence and deletion flows.
  select a.id, a.tracking_mode, a.service_url, a.host_framing
    into v_announcement, v_mode, v_ann_url, v_framing
    from public.bty_tracked_announcements a
   where a.id = (select r.announcement_id from public.bty_tracked_announcement_recipients r where r.id = p_recipient_id)
     and a.status = 'active' and a.owner_user_id = p_owner_user_id
   for share;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  select r.notified_at, r.tenant_id, r.aad_object_id,
         r.notification_claim_token, r.notification_claim_expires_at, r.notification_send_started_at
    into v_notified, v_tenant, v_aad, v_claim, v_expires, v_started
    from public.bty_tracked_announcement_recipients r
   where r.id = p_recipient_id
     and r.announcement_id = v_announcement
     and public.bty_track_initial_notice_pending(
       v_mode, r.acknowledged_at, r.response_submitted_at, r.response
     )
     for update of r;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if v_notified is not null then
    return query select 'already_notified'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if coalesce(btrim(v_ann_url), '') = '' then
    return query select 'no_service_url'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if v_claim is not null and v_expires > v_now then
    return query select 'in_progress'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if v_claim is not null and v_started is not null then
    return query select 'delivery_unknown'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  v_new := gen_random_uuid();
  update public.bty_tracked_announcement_recipients
     set notification_claim_token = v_new,
         notification_claim_expires_at = v_now + public.bty_notification_claim_ttl(),
         notification_send_started_at = null
   where id = p_recipient_id;

  -- THE PAIR. Both halves from the confirmed reference, or neither.
  select c.service_url, c.conversation_id into v_ref_url, v_ref_conv
    from public.bty_teams_conversation_refs c
   where c.tenant_id = v_tenant and c.aad_object_id = v_aad;

  if v_ref_conv is not null then
    return query select 'ok'::text, v_new, v_tenant, v_aad, v_ref_url, v_framing, v_ref_conv; return;
  end if;
  return query select 'ok'::text, v_new, v_tenant, v_aad, v_ann_url, v_framing, null::text;
end;
$$;

create or replace function public.bty_mark_recipient_notification_sending(
  p_recipient_id uuid,
  p_claim_token uuid
)
returns table (result text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_announcement uuid;
  v_mode text;
  v_notified timestamptz;
  v_claim uuid;
  v_expires timestamptz;
  v_started timestamptz;
  v_now timestamptz := now();
begin
  select a.id, a.tracking_mode into v_announcement, v_mode
    from public.bty_tracked_announcements a
   where a.id = (select r.announcement_id from public.bty_tracked_announcement_recipients r where r.id = p_recipient_id)
     and a.status = 'active' and a.owner_user_id is not null
   for share;
  if not found then return query select 'not_found'::text; return; end if;

  select r.notified_at, r.notification_claim_token, r.notification_claim_expires_at, r.notification_send_started_at
    into v_notified, v_claim, v_expires, v_started
    from public.bty_tracked_announcement_recipients r
   where r.id = p_recipient_id
     and r.announcement_id = v_announcement
     and public.bty_track_initial_notice_pending(
       v_mode, r.acknowledged_at, r.response_submitted_at, r.response
     )
     for update of r;

  if not found then return query select 'not_found'::text; return; end if;
  if v_notified is not null then return query select 'already_notified'::text; return; end if;
  -- A stale token belongs to a reclaimed attempt. It may not act on the row.
  if v_claim is null or v_claim is distinct from p_claim_token then
    return query select 'claim_mismatch'::text; return;
  end if;
  if v_expires <= v_now then return query select 'claim_expired'::text; return; end if;
  if v_started is not null then return query select 'already_sending'::text; return; end if;

  update public.bty_tracked_announcement_recipients
     set notification_send_started_at = v_now
   where id = p_recipient_id;
  return query select 'sending'::text;
end;
$$;

revoke all on function public.bty_track_initial_notice_pending(text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.bty_track_initial_notice_pending(text, timestamptz, timestamptz, text)
  to service_role;
revoke all on function public.bty_reserve_due_track_initial_notices(integer) from public, anon, authenticated;
grant execute on function public.bty_reserve_due_track_initial_notices(integer) to service_role;

commit;
