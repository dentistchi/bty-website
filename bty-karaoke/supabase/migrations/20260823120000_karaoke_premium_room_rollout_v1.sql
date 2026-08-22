-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R2 · PREMIUM ROOM RELEASE-COMPATIBILITY ROLLOUT.
-- Sorts after 20260822120000_karaoke_premium_room_session_entitlement_v1.sql.
-- ADDITIVE + IDEMPOTENT. Applied LOCALLY ONLY; production untouched.
--
-- WHY THIS EXISTS. v1.0 build 109 is public, free, and immutable. R1 makes a hosted Event
-- require Premium Room entitlement. Deploying R1 alone would start returning 402
-- `premium_room_required` to a binary that was approved as free and has no purchase surface
-- to offer. This migration adds the switch that lets R1 be deployed WITHOUT changing anyone's
-- behaviour, and then be turned on deliberately.
--
-- THE ROLLOUT AUTHORITY IS REUSED, NOT INVENTED. `karaoke_usage_policy` is already the
-- product's central switchboard: an undeletable singleton, service_role SELECT+UPDATE only,
-- and it already carries exactly this shape of control (`enforcement_enabled`, and BUILD 20M's
-- three-state `lease_write_mode in ('off','allowlist','on')` which drove the lease cutover).
-- Adding a second config store for the same job would give the product two places to look.
--
-- A CLIENT VERSION IS NOT ENTITLEMENT AUTHORITY. `premium_room_mode` selects which release
-- CONTRACT the server projects. It cannot create, grant, extend or imply a paid entitlement:
-- the legacy contract's only power is to DECLINE TO ASK for one. See §C below, where the legacy
-- branch is proven to touch no grant.
-- ============================================================================

-- ── A. THE ROLLOUT SWITCH — one column on the existing singleton ──
--
-- 'legacy_free' is the DEPLOY-SAFE DEFAULT and is deliberately the column default: applying
-- this migration to production changes no behaviour for any client, on any platform. The
-- rollout then becomes a one-row UPDATE rather than a deploy, which is what makes it
-- reversible in seconds rather than in a build cycle.
alter table public.karaoke_usage_policy
  add column if not exists premium_room_mode text not null default 'legacy_free';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'karaoke_usage_policy_premium_room_mode_chk') then
    alter table public.karaoke_usage_policy
      add constraint karaoke_usage_policy_premium_room_mode_chk
      check (premium_room_mode in ('legacy_free', 'dual', 'premium_all'));
  end if;
end $$;

-- The read. STABLE, total, and it NEVER fails open to a paid state: a missing singleton (which
-- the delete trigger already makes impossible) or an unrecognised value both resolve to
-- 'legacy_free'. The unsafe direction here would be defaulting to 'premium_all' and silently
-- refusing the public app.
create or replace function public.karaoke_premium_room_mode()
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select case when premium_room_mode in ('legacy_free','dual','premium_all')
                 then premium_room_mode else 'legacy_free' end
       from public.karaoke_usage_policy where policy_key = 'default'),
    'legacy_free');
$$;
revoke all on function public.karaoke_premium_room_mode() from public, anon, authenticated;
grant execute on function public.karaoke_premium_room_mode() to service_role;

-- ── B. ROLLOUT TELEMETRY — how we learn when build 109 is gone ──
--
-- Shaped exactly like `karaoke_youtube_search_serves_hourly` (BUILD R2 quota telemetry): an
-- hourly counter per bucket, because the only question it answers is an aggregate one —
-- "how much traffic is still coming from a client that cannot pay?" Per-request rows would
-- store far more than that question needs.
--
-- PRIVACY: no account, room, event, session, token, IP, device id, user agent or fingerprint.
-- The bucket and the hour are the whole record, which is why it can be retained indefinitely.
create table if not exists public.karaoke_release_clients_hourly (
  hour_utc  timestamptz not null,
  bucket    text not null check (bucket in
              ('NATIVE_LEGACY','NATIVE_PREMIUM','WEB','UNIDENTIFIED')),
  requests  integer not null default 0 check (requests >= 0),
  primary key (hour_utc, bucket)
);
alter table public.karaoke_release_clients_hourly enable row level security;
revoke all on table public.karaoke_release_clients_hourly from public, anon, authenticated;
grant select, insert, update on table public.karaoke_release_clients_hourly to service_role;

-- Fail-open by construction: the caller's own error handling swallows failures, and the upsert
-- is idempotent per (hour, bucket). A telemetry problem must never convert a working hosted
-- room into an outage.
create or replace function public.karaoke_record_release_client(p_bucket text)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  if p_bucket not in ('NATIVE_LEGACY','NATIVE_PREMIUM','WEB','UNIDENTIFIED') then return; end if;
  insert into public.karaoke_release_clients_hourly (hour_utc, bucket, requests)
  values (date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC', p_bucket, 1)
  on conflict (hour_utc, bucket) do update
    set requests = public.karaoke_release_clients_hourly.requests + 1;
end; $$;
revoke all on function public.karaoke_record_release_client(text) from public, anon, authenticated;
grant execute on function public.karaoke_record_release_client(text) to service_role;

-- ── C. THE SESSION-START AUTHORITY GAINS A CONTRACT PARAMETER ──
--
-- §16 of R2 forbids rewriting the R1 activation RPC "unless a measured compatibility defect
-- requires it". The defect was measured: under R1 as written, a build-109 Host with no
-- entitlement receives 402 `premium_room_required` from `/dj/start-event` — an endpoint the
-- approved free v1.0 app calls as ordinary operation. The alternatives were both worse than a
-- parameter: a second `karaoke_start_legacy_free_room_session` would duplicate the Event write
-- path (two places to get the lock order and the collision retry right), and a client-side skip
-- would put the decision outside the transaction that enforces it.
--
-- DROP-AND-RECREATE IS SAFE HERE, AND ONLY HERE. Postgres cannot add a parameter through
-- CREATE OR REPLACE (it would create an overload, and a 5-argument call would then be
-- ambiguous). The 5-argument function was introduced by the IMMEDIATELY PRECEDING migration
-- (20260822120000) and has never been deployed to any environment, so nothing can be holding a
-- reference to it. R1 and R2 must therefore be applied together, in order — R2 is not valid
-- against a database that has R1 in production traffic.
drop function if exists public.karaoke_start_premium_room_session(uuid, text, text, text, text);

create or replace function public.karaoke_start_premium_room_session(
  p_room_id      uuid,
  p_name         text,
  p_public_code  text,
  p_guest_slug   text,
  p_created_by   text,
  -- 'premium' (R1 behaviour) or 'legacy' (pre-R1 behaviour, for a client that cannot be
  -- updated). Anything else is treated as 'premium': an unrecognised contract must never be
  -- able to talk its way into the free path.
  p_contract     text default 'premium'
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_room_status text; v_account uuid; v_now timestamptz;
  v_live_id uuid;
  v_ent jsonb; v_source text; v_entitled boolean; v_armable boolean;
  v_grant uuid; v_expires timestamptz; v_activated boolean := false;
  v_sel_dur int; v_sel_carry int;
  v_event_id uuid; v_upd int;
  -- MEASURED DEFECT, caught by the R2 hardening gate before this ever ran anywhere.
  --
  -- The obvious spelling, `(p_contract = 'legacy')`, yields NULL for a NULL argument. `if not
  -- NULL` is NULL, so the IF is not taken, control falls into the ELSE — and a NULL contract
  -- silently selected the FREE path. Every malformed STRING was already refused correctly; only
  -- the three-valued case slipped through, which is exactly the shape that survives review.
  --
  -- `coalesce` makes the absent case explicit and points it at the gated contract, so the only
  -- way to reach the legacy path is to ask for it by name.
  v_legacy boolean := (coalesce(p_contract, 'premium') = 'legacy');
begin
  select status into v_room_status from public.karaoke_rooms where id = p_room_id;
  if v_room_status is null then return jsonb_build_object('outcome','room_not_found'); end if;
  if v_room_status = 'retired' then return jsonb_build_object('outcome','room_retired'); end if;

  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;

  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account));
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_now := clock_timestamp();

  -- (2) IDEMPOTENT, identically on both contracts.
  select id into v_live_id from public.karaoke_events
   where room_id = p_room_id and status in ('draft','active') limit 1;
  if v_live_id is not null then
    return jsonb_build_object('outcome','already_live','eventId',v_live_id,'activated',false,
                              'contract', case when v_legacy then 'legacy' else 'premium' end);
  end if;

  -- (3) SWEEP. Runs on BOTH contracts, because an expired grant is expired regardless of which
  -- client asked. It is the one grant write the legacy path performs, and it can only ever
  -- record a lapse that already happened — it never creates, extends or consumes entitlement.
  with exp as (
    update public.timed_access_pass_grants
       set status = 'EXPIRED', expired_at = v_now, updated_at = now()
     where account_id = v_account and status = 'ACTIVE' and expires_at <= v_now
     returning id)
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, action, from_status, to_status)
  select id, v_account, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED' from exp;

  -- (4) RESOLVE — PREMIUM CONTRACT ONLY.
  --
  -- THE LEGACY BRANCH ASKS NOTHING AND ARMS NOTHING. It does not read entitlement, does not
  -- select a grant, and above all does not ACTIVATE one. A build-109 Host who happens to own an
  -- armed pass must keep it: their hosted rooms are free under the contract they installed, so
  -- spending their purchased window on one would take something they did not agree to give.
  if not v_legacy then
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
        return jsonb_build_object('outcome','premium_room_required','source','NONE');
      end if;
      v_expires   := v_now + make_interval(secs => v_sel_dur + v_sel_carry);
      v_activated := true;
      v_source    := 'ACTIVATED_PASS';
    else
      return jsonb_build_object('outcome','premium_room_required','source',v_source);
    end if;
  else
    v_source := 'LEGACY_FREE';
  end if;

  -- (5) CREATE. Identical on both contracts, and still before any activation.
  begin
    insert into public.karaoke_events
      (room_id, name, public_code, guest_slug, status, starts_at, created_by)
    values
      (p_room_id, p_name, p_public_code, p_guest_slug, 'active', v_now,
       coalesce(nullif(btrim(p_created_by), ''), 'admin-hub'))
    returning id into v_event_id;
  exception when unique_violation then
    select id into v_live_id from public.karaoke_events
     where room_id = p_room_id and status in ('draft','active') limit 1;
    if v_live_id is not null then
      return jsonb_build_object('outcome','already_live','eventId',v_live_id,'activated',false,
                                'contract', case when v_legacy then 'legacy' else 'premium' end);
    end if;
    return jsonb_build_object('outcome','code_conflict');
  end;

  -- (6) ACTIVATE. Unreachable on the legacy contract (`v_activated` stays false there).
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
    'contract', case when v_legacy then 'legacy' else 'premium' end,
    'passGrantId',v_grant,'expiresAt',v_expires,
    'remainingSeconds',
      case when v_expires is null then null
           else greatest(0, floor(extract(epoch from (v_expires - v_now)))::int) end);
end; $$;
revoke all on function public.karaoke_start_premium_room_session(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.karaoke_start_premium_room_session(uuid, text, text, text, text, text)
  to service_role;

-- ── D. WHAT IS DELIBERATELY NOT HERE ──
--
-- 1. No sunset is armed. `premium_room_mode` ships as 'legacy_free'. Moving to 'dual' and then
--    to 'premium_all' is an operational decision made on the telemetry in §B, not a migration.
--
-- 2. No minimum-supported-build enforcement, and no force-update mechanism. None exists in this
--    product today (see the R2 report §L). Under 'premium_all' an un-updatable client receives
--    an explicit CLIENT_UPDATE_REQUIRED refusal rather than a silent failure — but a refusal is
--    not an update PROMPT, and building one is R3/R4 work.
--
-- 3. No change to karaoke_begin_song_v2. Playback stays unmetered and ungated on every contract
--    and in every rollout mode: the free Search -> Open on YouTube path is not addressed here
--    because it is not gated anywhere, by anything, in the first place.
--
-- 4. No change to the commerce catalog. All three products remain is_active = false.
