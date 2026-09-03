-- ===========================================================================
-- TEAMS PROACTIVE NOTIFICATION — durable state. Slice A0.2.
-- ADDITIVE, plus the retirement of one function that no longer has a caller.
--
-- ORDERING: 20260908, after 20260907000000. The ledger is reconciled through
-- 20260907; this is the next version and the only new one. NONE of the earlier
-- files is edited, renamed, repaired or replayed.
--
-- WHAT THIS IS FOR. A recipient who has never opened BTY is never told that
-- anything was asked of them. A0.1 captured WHERE a Teams message would have to
-- be sent; this slice records WHO already has a conversation with the bot, and
-- WHICH recipients have actually been told. It still sends nothing by itself --
-- sending is application code, and it is inert until a bot credential exists.
--
-- ROLLBACK:
--   drop function if exists public.bty_confirm_recipient_notification(uuid);
--   drop function if exists public.bty_begin_recipient_notification(uuid, uuid);
--   drop function if exists public.bty_upsert_teams_conversation_ref(text, text, text, text);
--   drop table if exists public.bty_teams_conversation_refs;
--   alter table public.bty_tracked_announcement_recipients drop column if exists notified_at;
--   -- and re-create the 6-argument bty_track_announcement from 20260902000000.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. WHO ALREADY HAS A CONVERSATION WITH THE BOT.
--
-- Teams will happily create a second 1:1 conversation, so the only thing that
-- stops a person accumulating threads is remembering the first one. The key is
-- the identity pair BTY already trusts everywhere else -- (tenant, Entra object
-- id) -- and NOTHING here is an email, a UPN or a display name. A display name
-- is not an identity, and storing one would invite a future lookup by it.
--
-- `service_url` is stored ALONGSIDE the conversation, not instead of it: a
-- conversation id is only meaningful against the base URL it was created on,
-- and keeping them together means a stored reference can never be routed
-- somewhere it does not exist.
-- ---------------------------------------------------------------------------

create table if not exists public.bty_teams_conversation_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  aad_object_id text not null,
  service_url text not null,
  conversation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bty_teams_conv_ref_identity_unique unique (tenant_id, aad_object_id)
);

comment on table public.bty_teams_conversation_refs is
  'One 1:1 Teams conversation per trusted Microsoft identity. Keyed ONLY by (tenant_id, aad_object_id) -- never email, UPN or display name. Written after Teams confirms the conversation exists; read before creating one, so a person accumulates a single thread rather than one per announcement.';

alter table public.bty_teams_conversation_refs enable row level security;
-- No policy is defined on purpose: this table is server-only, reachable through
-- the SECURITY DEFINER functions below and nowhere else. RLS with no policy is
-- deny-all for anon and authenticated, which is the intent stated plainly.
revoke all on table public.bty_teams_conversation_refs from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. WHO HAS ACTUALLY BEEN TOLD.
--
-- ONE column, deliberately. `notified_at` NULL means "not successfully
-- delivered" and is the only retryable state; a timestamp means Teams confirmed
-- the send and means it permanently.
--
-- A SECOND "claimed" column was considered and REJECTED as unproven. It would
-- only buy something against two sends overlapping in the same instant, and the
-- actual trigger cannot produce that: a notification is attempted when a Track
-- CREATES an announcement, and two concurrent Tracks for the same owner and
-- source capture already resolve to one create through the existing
-- owner+source_capture key -- the second is told `already_existed`. Sequential
-- retries, which are the real case, are fully covered below. Adding durable
-- state for a race the system cannot currently reach would be inventing.
-- ---------------------------------------------------------------------------

alter table public.bty_tracked_announcement_recipients
  add column if not exists notified_at timestamptz;

comment on column public.bty_tracked_announcement_recipients.notified_at is
  'When Teams CONFIRMED one proactive notification for this recipient. NULL means not delivered and still retryable -- including after a failed send, a failed conversation creation, or a missing credential. Never written before the Connector API returns success, and never cleared.';


-- ---------------------------------------------------------------------------
-- 3. THE THREE WRITES, EACH DOING EXACTLY ONE THING.
--
-- Split into begin/confirm rather than one call because a network send happens
-- BETWEEN them, outside any transaction. A single function could only mark
-- before or after the send, and marking before is how a person is recorded as
-- told when nothing reached them.
-- ---------------------------------------------------------------------------

/*
  May this recipient be notified, and with what?

  Returns everything the sender needs in one locked read -- the identity, the
  announcement's own stored routing URL, the Host's framing -- so the caller
  cannot assemble a message from a different row than the one it checked.

  `for update of r` holds the row for the rest of THIS transaction. It does not
  span the send, and is not pretended to: its job is to make the read and the
  eligibility decision atomic against another writer.

  Refusals are typed rather than empty, because "already told" and "this
  announcement has no routing coordinate" need different answers from a human.
*/
create or replace function public.bty_begin_recipient_notification(
  p_recipient_id uuid,
  p_owner_user_id uuid
)
returns table (
  result text,
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
  v_owner uuid;
  v_notified timestamptz;
  v_tenant text;
  v_aad text;
  v_url text;
  v_framing text;
  v_conv text;
begin
  select a.owner_user_id, r.notified_at, r.tenant_id, r.aad_object_id, a.service_url, a.host_framing
    into v_owner, v_notified, v_tenant, v_aad, v_url, v_framing
    from public.bty_tracked_announcement_recipients r
    join public.bty_tracked_announcements a on a.id = r.announcement_id
   where r.id = p_recipient_id
     for update of r;

  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  -- Same shape as "not found": ownership of someone else's run is not probeable.
  if v_owner is distinct from p_owner_user_id then
    return query select 'not_found'::text, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  if v_notified is not null then
    return query select 'already_notified'::text, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  -- A historical announcement has no coordinate and must never be routed by
  -- guesswork. This is the database refusing what no caller is allowed to
  -- improvise around.
  if coalesce(btrim(v_url), '') = '' then
    return query select 'no_service_url'::text, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  select c.conversation_id into v_conv
    from public.bty_teams_conversation_refs c
   where c.tenant_id = v_tenant and c.aad_object_id = v_aad;

  return query select 'ok'::text, v_tenant, v_aad, v_url, v_framing, v_conv;
end;
$$;

/*
  Teams confirmed the send. Conditional on purpose: `where notified_at is null`
  means a second confirmation for the same recipient changes nothing and reports
  it, so a duplicated confirm cannot move the timestamp or be mistaken for a
  second delivery.
*/
create or replace function public.bty_confirm_recipient_notification(p_recipient_id uuid)
returns table (result text, notified_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_now timestamptz := now();
  v_rows integer;
begin
  update public.bty_tracked_announcement_recipients
     set notified_at = v_now
   where id = p_recipient_id
     and notified_at is null;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    return query select 'notified'::text, v_now;
  else
    return query select 'already_notified'::text, null::timestamptz;
  end if;
end;
$$;

/*
  Remember the conversation Teams just confirmed.

  `on conflict (tenant_id, aad_object_id) do update` keeps ONE row per person:
  if the routing base ever moves, the reference follows it rather than becoming
  a second thread. Nothing here touches a recipient, a response or a user.
*/
create or replace function public.bty_upsert_teams_conversation_ref(
  p_tenant_id text,
  p_aad_object_id text,
  p_service_url text,
  p_conversation_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(btrim(p_tenant_id), '') = ''
     or coalesce(btrim(p_aad_object_id), '') = ''
     or coalesce(btrim(p_service_url), '') = ''
     or coalesce(btrim(p_conversation_id), '') = '' then
    raise exception 'incomplete_conversation_ref' using errcode = 'P0001';
  end if;

  insert into public.bty_teams_conversation_refs
    (tenant_id, aad_object_id, service_url, conversation_id)
  values
    (lower(btrim(p_tenant_id)), lower(btrim(p_aad_object_id)), btrim(p_service_url), btrim(p_conversation_id))
  on conflict (tenant_id, aad_object_id) do update
    set service_url = excluded.service_url,
        conversation_id = excluded.conversation_id,
        updated_at = now();
end;
$$;

revoke all on function public.bty_begin_recipient_notification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_begin_recipient_notification(uuid, uuid) to service_role;
revoke all on function public.bty_confirm_recipient_notification(uuid) from public, anon, authenticated;
grant execute on function public.bty_confirm_recipient_notification(uuid) to service_role;
revoke all on function public.bty_upsert_teams_conversation_ref(text, text, text, text) from public, anon, authenticated;
grant execute on function public.bty_upsert_teams_conversation_ref(text, text, text, text) to service_role;


-- ---------------------------------------------------------------------------
-- 4. RETIRE THE SUPERSEDED TRACK CONTRACT.
--
-- 20260907 introduced the seven-argument form and production kept the
-- six-argument one alive so the Worker deployed AT THAT MOMENT would survive
-- the window between apply and deploy. That deploy has happened. Measured
-- across the repo, the only caller of this RPC is trackAnnouncement.server.ts
-- and it now passes p_service_url -- zero callers need the old arity.
--
-- 20260907000000 is NOT edited to do this. An applied migration describes what
-- already ran; the correction belongs in the next one.
-- ---------------------------------------------------------------------------

drop function if exists public.bty_track_announcement(uuid, uuid, text, text, text, text[]);
