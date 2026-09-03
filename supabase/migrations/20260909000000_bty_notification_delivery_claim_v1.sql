-- ===========================================================================
-- PROACTIVE NOTIFICATION DELIVERY CLAIM — A0.2R. ADDITIVE REPAIR.
--
-- ORDERING: 20260909, after 20260908000000, which is live production authority.
-- 20260908 is NOT edited, renamed, replayed, or its ledger entry repaired. This
-- file adds three columns and three checks, replaces the three A0.2 function
-- bodies, and adds two functions.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT THIS REPAIRS, AND THE COMMENT IN 20260908 THAT WAS WRONG.
--
-- 20260908 justified a single `notified_at` column like this: "the actual
-- trigger cannot produce that: a notification is attempted when a Track CREATES
-- an announcement". That premise was false when it was written. The SAME slice
-- added a standalone route, POST .../recipients/[id]/notify, precisely so an
-- existing announcement could be notified and a failed delivery retried -- and
-- two calls to it overlap freely:
--
--     A: begin -> ok            B: begin -> ok
--     A: POST to Teams          B: POST to Teams          <-- two messages
--     A: confirm -> notified    B: confirm -> already_notified
--
-- `for update` inside begin ends when begin's transaction commits. It cannot
-- span a network call to Microsoft. `notified_at` therefore protects sequential
-- retries AFTER a confirmed delivery and nothing else.
--
-- ---------------------------------------------------------------------------
-- WHY A LEASE ALONE IS STILL NOT ENOUGH -- THE THIRD COLUMN.
--
-- A lease stops two live senders. It does not survive a dead one:
--
--     A claims -> A POSTs -> Teams ACCEPTS -> A's Worker dies before the
--     response -> the lease expires -> B reclaims -> B sends again.
--
-- The person is messaged twice and nothing in the database ever knew. So the
-- database must be able to tell two states apart that a lease alone conflates:
--
--     CLAIMED, outbound send not yet begun        -> reclaimable, safe to retry
--     OUTBOUND SEND BEGUN, outcome unknown        -> NOT reclaimable, ever
--
-- `notification_send_started_at` is the minimum durable evidence for that
-- boundary. An expired lease whose send had started resolves to
-- `delivery_unknown`, which never sends again on its own.
--
-- A false "maybe sent" is visible and repairable by a person. A silent
-- duplicate message is neither.
--
-- ROLLBACK:
--   -- restore the 20260908 bodies of the three functions, then:
--   drop function if exists public.bty_mark_recipient_notification_sending(uuid, uuid);
--   drop function if exists public.bty_release_recipient_notification_claim(uuid, uuid);
--   drop function if exists public.bty_notification_claim_ttl();
--   alter table public.bty_tracked_announcement_recipients
--     drop constraint if exists bty_tracked_recip_claim_pair_check,
--     drop constraint if exists bty_tracked_recip_sending_needs_claim_check,
--     drop constraint if exists bty_tracked_recip_notified_is_terminal_check,
--     drop column if exists notification_send_started_at,
--     drop column if exists notification_claim_expires_at,
--     drop column if exists notification_claim_token;
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. THE CANONICAL LEASE LENGTH.
--
-- A function, not a literal repeated at each use: the number appears in exactly
-- one place in this schema, and the application reads its own timeouts against
-- the same idea rather than a copy of the number.
--
-- 120 SECONDS, AND WHY. The normal path is a bot token acquisition (usually
-- cached), at most one createConversation, one message POST, and three small
-- database writes. Each outbound fetch carries its own explicit timeout far
-- shorter than this, so a healthy request finishes in seconds and releases or
-- confirms long before the lease matters.
--
-- The lease is therefore NOT a retry interval. It is recovery time for a Worker
-- that died BEFORE it began an outbound send. It is deliberately not permission
-- to repeat a send whose result nobody knows -- that case is gated by
-- notification_send_started_at, not by the clock.
-- ---------------------------------------------------------------------------

create or replace function public.bty_notification_claim_ttl()
returns interval
language sql
immutable
set search_path = pg_catalog
as $$ select interval '120 seconds' $$;

comment on function public.bty_notification_claim_ttl() is
  'Canonical proactive-notification lease length. The single source of the 120-second figure; application fetch timeouts are set substantially shorter so a live request never races its own lease.';


-- ---------------------------------------------------------------------------
-- 2. THE THREE COLUMNS AND THE THREE RULES THAT KEEP THEM HONEST.
--
-- None is client-visible: the recipients table is server-only, and every
-- projection the app builds selects columns explicitly.
-- ---------------------------------------------------------------------------

alter table public.bty_tracked_announcement_recipients
  add column if not exists notification_claim_token uuid,
  add column if not exists notification_claim_expires_at timestamptz,
  add column if not exists notification_send_started_at timestamptz;

comment on column public.bty_tracked_announcement_recipients.notification_claim_token is
  'Server-generated lease held by exactly one in-flight notification attempt. Presented back by that attempt to mark sending, confirm or release; a token that no longer owns the row can do none of those. Never accepted from a client.';
comment on column public.bty_tracked_announcement_recipients.notification_claim_expires_at is
  'When the lease stops blocking a new attempt. Expiry alone does NOT authorise a resend -- see notification_send_started_at.';
comment on column public.bty_tracked_announcement_recipients.notification_send_started_at is
  'Set immediately BEFORE the Connector message POST, and durable. Its presence on an expired lease means a message may already have reached the person, which is reported as delivery_unknown and never resent automatically.';

-- Both together or neither: a lease with no expiry never ends, and an expiry
-- with no owner blocks everyone.
alter table public.bty_tracked_announcement_recipients
  drop constraint if exists bty_tracked_recip_claim_pair_check;
alter table public.bty_tracked_announcement_recipients
  add constraint bty_tracked_recip_claim_pair_check
  check ((notification_claim_token is null) = (notification_claim_expires_at is null));

-- A send cannot be in progress on behalf of nobody.
alter table public.bty_tracked_announcement_recipients
  drop constraint if exists bty_tracked_recip_sending_needs_claim_check;
alter table public.bty_tracked_announcement_recipients
  add constraint bty_tracked_recip_sending_needs_claim_check
  check (notification_send_started_at is null or notification_claim_token is not null);

-- `notified_at` is terminal. Once someone has been told, no lease and no
-- in-flight marker may survive to suggest otherwise.
alter table public.bty_tracked_announcement_recipients
  drop constraint if exists bty_tracked_recip_notified_is_terminal_check;
alter table public.bty_tracked_announcement_recipients
  add constraint bty_tracked_recip_notified_is_terminal_check
  check (
    notified_at is null
    or (notification_claim_token is null
        and notification_claim_expires_at is null
        and notification_send_started_at is null)
  );


-- ---------------------------------------------------------------------------
-- 3. BEGIN — the only place a claim is created.
--
-- The 20260908 signature returned no token, so it is DROPPED and recreated
-- rather than replaced: PostgreSQL cannot change a function's return type in
-- place. Safe to drop outright because the A0.2 application code was never
-- committed or deployed -- the live Worker is A0.1 and calls none of this.
-- ---------------------------------------------------------------------------

drop function if exists public.bty_begin_recipient_notification(uuid, uuid);

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
  v_owner uuid;
  v_notified timestamptz;
  v_tenant text;
  v_aad text;
  v_url text;
  v_framing text;
  v_conv text;
  v_claim uuid;
  v_expires timestamptz;
  v_started timestamptz;
  v_new uuid;
  v_now timestamptz := now();
begin
  -- The lock is what makes the read and the decision atomic against another
  -- claimer. It does not, and cannot, span the network send that follows.
  select a.owner_user_id, r.notified_at, r.tenant_id, r.aad_object_id,
         a.service_url, a.host_framing,
         r.notification_claim_token, r.notification_claim_expires_at, r.notification_send_started_at
    into v_owner, v_notified, v_tenant, v_aad, v_url, v_framing, v_claim, v_expires, v_started
    from public.bty_tracked_announcement_recipients r
    join public.bty_tracked_announcements a on a.id = r.announcement_id
   where r.id = p_recipient_id
     for update of r;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  -- A wrong owner is answered exactly like a missing row, so nobody can probe
  -- for the existence of a run they do not own.
  if v_owner is distinct from p_owner_user_id then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  if v_notified is not null then
    return query select 'already_notified'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  if coalesce(btrim(v_url), '') = '' then
    -- A historical announcement has no coordinate. The database refuses what no
    -- caller is permitted to improvise around.
    return query select 'no_service_url'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  if v_claim is not null and v_expires > v_now then
    -- Someone else is mid-attempt. Not an error; just not this caller's turn.
    return query select 'in_progress'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  if v_claim is not null and v_started is not null then
    -- The lease died, but a send had already begun. A message may be sitting in
    -- that person's Teams. Reclaiming here is exactly how they get told twice.
    return query select 'delivery_unknown'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  -- Free, or an expired lease whose owner never reached the network.
  v_new := gen_random_uuid();
  update public.bty_tracked_announcement_recipients
     set notification_claim_token = v_new,
         notification_claim_expires_at = v_now + public.bty_notification_claim_ttl(),
         notification_send_started_at = null
   where id = p_recipient_id;

  select c.conversation_id into v_conv
    from public.bty_teams_conversation_refs c
   where c.tenant_id = v_tenant and c.aad_object_id = v_aad;

  return query select 'ok'::text, v_new, v_tenant, v_aad, v_url, v_framing, v_conv;
end;
$$;

/*
  4. THE SEND BOUNDARY.

  Called immediately before the Connector message POST and at no other moment.
  Everything upstream of it -- a missing credential, a rejected bot token, a
  conversation that could not be created -- has not risked delivering anything,
  so marking there would strand a recipient in `delivery_unknown` for failures
  that provably sent nothing.

  Every refusal is typed, because the caller must be able to tell "my lease was
  taken" from "someone already sent" without guessing.
*/
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
  v_notified timestamptz;
  v_claim uuid;
  v_expires timestamptz;
  v_started timestamptz;
  v_now timestamptz := now();
begin
  select r.notified_at, r.notification_claim_token, r.notification_claim_expires_at, r.notification_send_started_at
    into v_notified, v_claim, v_expires, v_started
    from public.bty_tracked_announcement_recipients r
   where r.id = p_recipient_id
     for update;

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

/*
  5. CONFIRM. Teams accepted the message.

  Requires BOTH the matching claim and evidence that a send had begun: a confirm
  arriving for a row that never marked sending did not come from a real
  delivery, and must not be able to write a terminal state.

  Success clears the lease entirely, so the terminal representation is
  `notified_at` alone and the CHECK above stays satisfiable.
*/
create or replace function public.bty_confirm_recipient_notification(
  p_recipient_id uuid,
  p_claim_token uuid
)
returns table (result text, notified_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_notified timestamptz;
  v_claim uuid;
  v_started timestamptz;
  v_now timestamptz := now();
begin
  select r.notified_at, r.notification_claim_token, r.notification_send_started_at
    into v_notified, v_claim, v_started
    from public.bty_tracked_announcement_recipients r
   where r.id = p_recipient_id
     for update;

  if not found then return query select 'not_found'::text, null::timestamptz; return; end if;
  if v_notified is not null then return query select 'already_notified'::text, v_notified; return; end if;
  if v_claim is null or v_claim is distinct from p_claim_token then
    return query select 'claim_mismatch'::text, null::timestamptz; return;
  end if;
  if v_started is null then return query select 'send_not_started'::text, null::timestamptz; return; end if;

  update public.bty_tracked_announcement_recipients
     set notified_at = v_now,
         notification_claim_token = null,
         notification_claim_expires_at = null,
         notification_send_started_at = null
   where id = p_recipient_id;
  return query select 'notified'::text, v_now;
end;
$$;

/*
  6. RELEASE. ONLY for failures that prove nothing was delivered.

  The caller decides which failures qualify -- it is the only party that knows
  how far the request got -- but the function still refuses a token that does
  not own the row, so a zombie cannot free a newer owner's lease.

  Deliberately permitted even when notification_send_started_at is set: a
  Connector response that DEFINITIVELY rejects the message (a 4xx that proves no
  message was accepted) is proof of non-delivery, and stranding that recipient
  in delivery_unknown would be a false alarm. An ambiguous outcome must simply
  never reach this function.
*/
create or replace function public.bty_release_recipient_notification_claim(
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
  v_notified timestamptz;
  v_claim uuid;
begin
  select r.notified_at, r.notification_claim_token
    into v_notified, v_claim
    from public.bty_tracked_announcement_recipients r
   where r.id = p_recipient_id
     for update;

  if not found then return query select 'not_found'::text; return; end if;
  if v_notified is not null then return query select 'already_notified'::text; return; end if;
  if v_claim is null or v_claim is distinct from p_claim_token then
    return query select 'claim_mismatch'::text; return;
  end if;

  update public.bty_tracked_announcement_recipients
     set notification_claim_token = null,
         notification_claim_expires_at = null,
         notification_send_started_at = null
   where id = p_recipient_id;
  return query select 'released'::text;
end;
$$;

revoke all on function public.bty_notification_claim_ttl() from public, anon, authenticated;
grant execute on function public.bty_notification_claim_ttl() to service_role;
revoke all on function public.bty_begin_recipient_notification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_begin_recipient_notification(uuid, uuid) to service_role;
revoke all on function public.bty_mark_recipient_notification_sending(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_mark_recipient_notification_sending(uuid, uuid) to service_role;
revoke all on function public.bty_confirm_recipient_notification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_confirm_recipient_notification(uuid, uuid) to service_role;
revoke all on function public.bty_release_recipient_notification_claim(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_release_recipient_notification_claim(uuid, uuid) to service_role;

-- The 20260908 single-argument confirm cannot survive: a confirm without a
-- token would bypass the entire claim contract this file exists to create.
drop function if exists public.bty_confirm_recipient_notification(uuid);
