-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R1 · PREMIUM ROOM BOUNDARY MOVE — session-entitlement authority.
-- Sorts after 20260821120000_karaoke_youtube_search_abuse_containment_v1.sql.
-- ADDITIVE + IDEMPOTENT. No column is dropped, no historical row is rewritten,
-- no previously applied migration is edited.
--
-- WHAT THIS CHANGES, in one sentence: a Timed Access Pass stops meaning "time in
-- which YouTube videos may be played" and starts meaning "wall-clock time in which
-- this account may run a hosted BTY karaoke-room session".
--
-- THE PROBLEM IT SOLVES. BUILD 26T-R1B-R6-R1A (E1, migration 20260817120000)
-- correctly removed pass activation from `karaoke_begin_song_v2` along with every
-- duration-based refusal, because playback must not be metered or gated. But it
-- removed the ONLY activation site in the product. Since E1 shipped, a purchased
-- grant can reach SELECTED and can never reach ACTIVE: `v_activate` is initialised
-- false in begin_song_v2 and is never assigned. The paid product is inert.
--
-- This migration gives activation a new and correct home: the transaction that
-- opens a hosted Event. That is the moment BTY's own coordination service begins,
-- and it is the only thing the customer is actually buying.
--
-- WHAT IS DELIBERATELY NOT HERE:
--   * no change to karaoke_begin_song_v2. Playback stays unmetered and ungated,
--     exactly as E1 left it. This migration must not re-enter that function at all.
--   * no video duration is read, compared, or stored anywhere below.
--   * no change to karaoke_product_catalog (ids, durations, product_kind, is_active
--     are contract data and stay frozen; all three remain is_active = false).
--   * no change to fulfil_apple_purchase, the purchase ledger, issue_timed_access_pass,
--     switch_timed_access_pass, select_timed_access_pass, or end_karaoke_event.
--   * no legacy metering structure is dropped. karaoke_usage_policy,
--     karaoke_event_usage_segments and their lease columns stay exactly as they are,
--     as dormant history. Nothing below reads them.
-- ============================================================================

-- ── A. PREMIUM ROOM ENTITLEMENT — the read (STABLE, no writes, no side effects) ──
--
-- THE one place the server answers "may this account run a hosted room right now, and
-- until when". Every consumer — route guard, expiry sweep, and the session-start
-- transaction itself — resolves through this, so they cannot drift apart.
--
-- `source` is the reason, and the reasons are ordered exactly as BUILD 17 §1.7 orders
-- them: a PRO account never consumes a pass; otherwise an unexpired ACTIVE pass rules;
-- otherwise a SELECTED pass is *armable* but grants nothing until it is activated.
--
-- IT IS STABLE ON PURPOSE. An expired ACTIVE row is reported as expired (server-time
-- truth) but is NOT swept here — a read must never rewrite grant history. The sweep
-- lives in the session-start transaction, under the account lock, where it belongs.
create or replace function public.karaoke_premium_room_entitlement_at(
  p_account_id uuid, p_as_of timestamptz
) returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_plan text; v_plan_n int;
  v_active_id uuid; v_active_expires timestamptz;
  v_sel_id uuid; v_sel_dur int; v_sel_carry int;
begin
  if p_account_id is null then
    return jsonb_build_object('outcome','account_required','entitled',false,'source','NONE');
  end if;

  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments
   where account_id = p_account_id and status = 'active';
  -- Ambiguous or absent plan is FREE. Never a paid promotion (BUILD 17 §1.7).
  if not (v_plan_n = 1 and v_plan in ('FREE','PRO')) then v_plan := 'FREE'; end if;

  if v_plan = 'PRO' then
    return jsonb_build_object(
      'outcome','ok','entitled',true,'source','PRO','basePlan','PRO',
      'passGrantId',null,'expiresAt',null,'remainingSeconds',null,
      'armable',false,'asOf',p_as_of);
  end if;

  select id, expires_at into v_active_id, v_active_expires
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'ACTIVE' and expires_at > p_as_of
   order by expires_at desc limit 1;
  if v_active_id is not null then
    return jsonb_build_object(
      'outcome','ok','entitled',true,'source','ACTIVE_PASS','basePlan','FREE',
      'passGrantId',v_active_id,'expiresAt',v_active_expires,
      'remainingSeconds', greatest(0, floor(extract(epoch from (v_active_expires - p_as_of)))::int),
      'armable',false,'asOf',p_as_of);
  end if;

  -- An armed pass is NOT entitlement. It is permission to BEGIN one, and the clock it
  -- will start is stated here so a client never has to add two numbers to tell a Host
  -- what a session will be worth.
  select id, duration_seconds, coalesce(carryover_seconds, 0)
    into v_sel_id, v_sel_dur, v_sel_carry
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'SELECTED' limit 1;
  if v_sel_id is not null then
    return jsonb_build_object(
      'outcome','ok','entitled',false,'source','SELECTED_PASS','basePlan','FREE',
      'passGrantId',v_sel_id,'expiresAt',null,'remainingSeconds',null,
      'armable',true,'effectiveWindowSeconds', v_sel_dur + v_sel_carry,'asOf',p_as_of);
  end if;

  return jsonb_build_object(
    'outcome','ok','entitled',false,'source','NONE','basePlan','FREE',
    'passGrantId',null,'expiresAt',null,'remainingSeconds',null,
    'armable',false,'asOf',p_as_of);
end; $$;
revoke all on function public.karaoke_premium_room_entitlement_at(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.karaoke_premium_room_entitlement_at(uuid, timestamptz) to service_role;

-- Room-scoped convenience: room -> canonical owner account -> entitlement. Returns the
-- SAME shape with `ownership_state_invalid` when the room has no unambiguous active
-- owner, so a caller that cannot resolve an owner fails closed rather than defaulting.
create or replace function public.karaoke_room_premium_entitlement_at(
  p_room_id uuid, p_as_of timestamptz
) returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare v_account uuid;
begin
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then
    return jsonb_build_object('outcome','ownership_state_invalid','entitled',false,'source','NONE');
  end if;
  return public.karaoke_premium_room_entitlement_at(v_account, p_as_of);
end; $$;
revoke all on function public.karaoke_room_premium_entitlement_at(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.karaoke_room_premium_entitlement_at(uuid, timestamptz) to service_role;

-- ── B. START A HOSTED PREMIUM ROOM SESSION — entitlement + activation + Event, atomically ──
--
-- THE WRITE ORDER IS THE WHOLE DESIGN, and it is forced:
--
--   1. locks           account advisory lock FIRST (the one shared key function), then room.
--                      Identical ordering to karaoke_begin_song_v2, so the two can never
--                      deadlock against each other.
--   2. idempotency     a live Event already exists -> return it and ACTIVATE NOTHING.
--                      Double-tap safety is preserved exactly as startNewEvent had it, and
--                      a second tap can never spend a second pass.
--   3. sweep           expire this account's past-expiry ACTIVE grants, under the lock.
--                      Truthful regardless of what happens next, so it is allowed to
--                      survive a later refusal.
--   4. resolve         PRO / ACTIVE pass / SELECTED pass / nothing. A refusal returns HERE,
--                      before anything is created and before any grant is activated.
--   5. INSERT event    a public_code / guest_slug collision is caught and reported so the
--                      caller can retry with a fresh code. Because activation has NOT
--                      happened yet, a collision cannot spend the customer's pass.
--   6. ACTIVATE        SELECTED -> ACTIVE, and only now. A lost race RAISES rather than
--                      returning, which rolls back the Event too: we must never open a
--                      session whose clock failed to start.
--
-- expires_at = now + (duration_seconds + carryover_seconds). That is exactly the arithmetic
-- timed_pass_expires_matches_duration enforces (BUILD 26M-R2 carryover), so a transferred
-- residual is honoured here identically to how the retired playback activation honoured it.
--
-- NO VIDEO DURATION IS READ. There is no reference to karaoke_video_durations, no
-- karaoke_requests read, and no comparison against any media length anywhere in this
-- function. A song longer than the remaining session time is not this function's business,
-- and is not anyone's business any more.
create or replace function public.karaoke_start_premium_room_session(
  p_room_id      uuid,
  p_name         text,
  p_public_code  text,
  p_guest_slug   text,
  p_created_by   text
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_room_status text; v_account uuid; v_now timestamptz;
  v_live_id uuid;
  v_ent jsonb; v_source text; v_entitled boolean; v_armable boolean;
  v_grant uuid; v_expires timestamptz; v_activated boolean := false;
  v_sel_dur int; v_sel_carry int;
  v_event_id uuid; v_upd int;
begin
  select status into v_room_status from public.karaoke_rooms where id = p_room_id;
  if v_room_status is null then return jsonb_build_object('outcome','room_not_found'); end if;
  -- BUILD 26E parity: a retired room answers explicitly and terminally.
  if v_room_status = 'retired' then return jsonb_build_object('outcome','room_retired'); end if;

  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;

  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account));
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_now := clock_timestamp();

  -- (2) IDEMPOTENT. The one-live-Event-per-room invariant is upheld by returning the
  -- incumbent, and nothing is activated: a running session already has a running clock.
  select id into v_live_id from public.karaoke_events
   where room_id = p_room_id and status in ('draft','active') limit 1;
  if v_live_id is not null then
    return jsonb_build_object('outcome','already_live','eventId',v_live_id,'activated',false);
  end if;

  -- (3) SWEEP. Held account lock makes this race-safe. An expired grant is expired whether
  -- or not this call goes on to succeed, so this write is correct even on the refusal path.
  with exp as (
    update public.timed_access_pass_grants
       set status = 'EXPIRED', expired_at = v_now, updated_at = now()
     where account_id = v_account and status = 'ACTIVE' and expires_at <= v_now
     returning id)
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, action, from_status, to_status)
  select id, v_account, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED' from exp;

  -- (4) RESOLVE, through the single read authority.
  v_ent      := public.karaoke_premium_room_entitlement_at(v_account, v_now);
  v_source   := v_ent->>'source';
  v_entitled := (v_ent->>'entitled')::boolean;
  v_armable  := coalesce((v_ent->>'armable')::boolean, false);

  if v_entitled then
    v_grant   := nullif(v_ent->>'passGrantId','')::uuid;
    v_expires := nullif(v_ent->>'expiresAt','')::timestamptz;
  elsif v_armable then
    v_grant := nullif(v_ent->>'passGrantId','')::uuid;
    select duration_seconds, coalesce(carryover_seconds, 0) into v_sel_dur, v_sel_carry
      from public.timed_access_pass_grants
     where id = v_grant and account_id = v_account and status = 'SELECTED'
     for update;
    if not found then
      -- It moved between the read and the lock. Refuse; never guess.
      return jsonb_build_object('outcome','premium_room_required','source','NONE');
    end if;
    v_expires   := v_now + make_interval(secs => v_sel_dur + v_sel_carry);
    v_activated := true;
    v_source    := 'ACTIVATED_PASS';
  else
    return jsonb_build_object('outcome','premium_room_required','source',v_source);
  end if;

  -- (5) CREATE. Still no activation, so a code collision costs the customer nothing.
  begin
    insert into public.karaoke_events
      (room_id, name, public_code, guest_slug, status, starts_at, created_by)
    values
      (p_room_id, p_name, p_public_code, p_guest_slug, 'active', v_now,
       coalesce(nullif(btrim(p_created_by), ''), 'admin-hub'))
    returning id into v_event_id;
  exception when unique_violation then
    -- Either a concurrent winner (impossible while we hold the room lock, but checked
    -- rather than assumed) or a public_code / guest_slug collision the caller must retry.
    select id into v_live_id from public.karaoke_events
     where room_id = p_room_id and status in ('draft','active') limit 1;
    if v_live_id is not null then
      return jsonb_build_object('outcome','already_live','eventId',v_live_id,'activated',false);
    end if;
    return jsonb_build_object('outcome','code_conflict');
  end;

  -- (6) ACTIVATE. Last, and fail-closed: a raise rolls the Event back with it.
  if v_activated then
    update public.timed_access_pass_grants
       set status = 'ACTIVE', activated_at = v_now, expires_at = v_expires, updated_at = now()
     where id = v_grant and status = 'SELECTED';
    get diagnostics v_upd = row_count;
    if v_upd <> 1 then
      raise exception 'premium_room_activation_conflict'
        using hint = 'the armed grant changed status inside the session-start transaction';
    end if;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status, metadata)
    values (v_grant, v_account, 'SYSTEM', 'premium_room_session', 'ACTIVATED', 'SELECTED', 'ACTIVE',
            jsonb_build_object('roomId', p_room_id, 'eventId', v_event_id,
                               'anchor', 'event_active', 'expiresAt', v_expires));
  end if;

  return jsonb_build_object(
    'outcome','ok','eventId',v_event_id,'source',v_source,'activated',v_activated,
    'passGrantId',v_grant,'expiresAt',v_expires,
    'remainingSeconds',
      case when v_expires is null then null
           else greatest(0, floor(extract(epoch from (v_expires - v_now)))::int) end);
end; $$;
revoke all on function public.karaoke_start_premium_room_session(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.karaoke_start_premium_room_session(uuid, text, text, text, text)
  to service_role;

-- ── C. NOTES ON WHAT WAS NOT DONE, so a future reader does not "finish" it by mistake ──
--
-- 1. karaoke_begin_song_v2 is NOT redefined. Its E1 body (20260817120000) is the current
--    and correct one: playback is unmetered, ungated, and mutates no grant. Its dead
--    `v_activate` local is left exactly where E1 left it; removing it would mean
--    re-emitting the whole function body, which is a drift risk with no behavioural gain.
--
-- 2. Session EXPIRY is deliberately NOT a new RPC. An expired session is ended through the
--    already-proven `end_karaoke_event`, whose canonical close policy is precisely what is
--    wanted here — WAITING -> removed, PLAYING -> skipped, event -> ended, "the room is NOT
--    closed and current media is NOT stopped". Reimplementing that would duplicate a
--    reviewed guarantee in order to say the same thing twice.
--
-- 3. karaoke_usage_policy.free_limit_seconds (900), enforcement_enabled and lease_write_mode
--    are UNTOUCHED, and so are the lease columns on karaoke_event_usage_segments. They are
--    dormant history after E1: nothing reads them to authorize a start, and nothing below
--    reads them at all. They are retained because deleting historical accounting to tidy a
--    boundary move would destroy the record of what was charged before it.
