-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 20M · EXTERNAL-PLAYBACK METERING LEASE INTEGRITY (P0) — versioned v2.
-- Sorts after 20260802120000_karaoke_user_saved_songs.sql. Additive + idempotent.
-- MATERIALIZED FOR LOCAL/ISOLATED VALIDATION. NOT approved for production db push.
--
-- Fix: once an external YouTube handoff is authorized for a song of duration D at
-- time T, the account is charged a NON-SHRINKABLE lease [T, T+D]. Finish / Event
-- end / relaunch NEVER shorten it. Consecutive songs charge only the union
-- extension lease_seconds = max(0, N-E). Billing SUMs lease_seconds by the STORED
-- charged window. Timed pass: the whole video must finish inside the pass window.
-- Duration is READ FROM CACHE by the request's canonical videoId (never caller-
-- supplied); unknown/out-of-range fails closed. v1 RPCs are untouched (cutover).
-- ============================================================================

-- ── A. LEASE + CHARGED-WINDOW COLUMNS (nullable → back-compat) ──
alter table public.karaoke_event_usage_segments
  add column if not exists duration_seconds     int,
  add column if not exists lease_ends_at        timestamptz,
  add column if not exists lease_seconds        int,
  add column if not exists charged_window_start timestamptz,   -- FREE window active at authorization
  add column if not exists charged_window_end   timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usage_seg_lease_consistency') then
    alter table public.karaoke_event_usage_segments
      add constraint usage_seg_lease_consistency check (
        (duration_seconds is null and lease_ends_at is null and lease_seconds is null
           and charged_window_start is null and charged_window_end is null)
        or (
          duration_seconds between 1 and 900
          and lease_ends_at >= started_at
          and lease_seconds between 0 and duration_seconds
          and charged_window_start is not null and charged_window_end > charged_window_start
        )
      ) not valid;   -- NOT VALID: legacy all-null rows already satisfy it; no scan/lock
  end if;
end $$;

-- Canonical-account active-lease union read path.
create index if not exists usage_seg_account_active_lease
  on public.karaoke_event_usage_segments (account_id, lease_ends_at desc)
  where lease_ends_at is not null;
-- SUM(lease_seconds)-by-charged-window read path.
create index if not exists usage_seg_account_charged_window
  on public.karaoke_event_usage_segments (account_id, charged_window_start)
  where lease_seconds is not null and metered;

-- ── B. DURABLE videoId → duration CACHE (immutable per video → long TTL) ──
create table if not exists public.karaoke_video_durations (
  video_id         text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  duration_seconds int not null check (duration_seconds between 1 and 900),
  source           text not null default 'youtube_contentDetails',
  resolved_at      timestamptz not null default now()
);
alter table public.karaoke_video_durations enable row level security;
revoke all on table public.karaoke_video_durations from public, anon, authenticated;
grant select, insert, update on table public.karaoke_video_durations to service_role;
-- TTL: durations are immutable → effectively permanent; lazy re-resolve only on a MISS.

-- ── C. CONTROLLED CUTOVER — lease_write_mode gates NEW v2 WRITES only ──
-- Reads always use v2 once a lease exists; a rollback stops new v2 writes but NEVER
-- returns already-issued leases to v1 accounting.
alter table public.karaoke_usage_policy
  add column if not exists lease_write_mode text not null default 'off'
    check (lease_write_mode in ('off', 'allowlist', 'on'));
create table if not exists public.karaoke_lease_rollout (
  account_id uuid primary key references public.karaoke_accounts(id) on delete cascade,
  added_at   timestamptz not null default now()
);
alter table public.karaoke_lease_rollout enable row level security;
revoke all on table public.karaoke_lease_rollout from public, anon, authenticated;
grant select, insert, delete on table public.karaoke_lease_rollout to service_role;

-- May this account ISSUE new v2 leases now? off→never, allowlist→listed only, on→all.
create or replace function public.karaoke_lease_write_enabled_for(p_account_id uuid)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select case (select lease_write_mode from public.karaoke_usage_policy where policy_key='default')
           when 'on' then true
           when 'allowlist' then exists (select 1 from public.karaoke_lease_rollout where account_id = p_account_id)
           else false
         end;
$$;
revoke all on function public.karaoke_lease_write_enabled_for(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_lease_write_enabled_for(uuid) to service_role;

-- One deterministic canonical-account advisory lock key across ALL v2 start paths.
create or replace function public.karaoke_account_lock_key(p_account_id uuid)
returns bigint language sql immutable set search_path = public, pg_temp as $$
  select hashtextextended('acct:' || p_account_id::text, 0);
$$;
revoke all on function public.karaoke_account_lock_key(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_account_lock_key(uuid) to service_role;

-- ── D. ENTITLEMENT v2 — SUM(lease_seconds) by STORED charged window; legacy fallback; no event-end refund ──
create or replace function public.karaoke_free_minutes_entitlement_at_v2(p_account_id uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
  p record; v_tz text; v_ws timestamptz; v_we timestamptz;
  v_new numeric := 0; v_legacy numeric := 0; v_used numeric; v_limit int; v_remaining int;
  v_plan text; v_plan_n int;
begin
  select * into p from public.karaoke_usage_policy where policy_key='default';
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=p_account_id and status='active';
  if not (v_plan_n=1 and v_plan in ('FREE','PRO')) then v_plan:='FREE'; end if;
  if v_plan='PRO' then
    return jsonb_build_object('plan','PRO','unlimited',true,'enforcementEnabled',p.enforcement_enabled,
      'limitSeconds',null,'usedSeconds',0,'remainingSeconds',null,'asOf',p_as_of,'model','lease_v2');
  end if;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz
    from public.karaoke_accounts where id=p_account_id;
  v_ws := date_trunc('day', p_as_of at time zone v_tz) at time zone v_tz;   -- DST-correct daily reset
  v_we := v_ws + interval '1 day';

  -- NEW rows: charge = lease_seconds, summed by the STORED charged window (immutable at write).
  select coalesce(sum(lease_seconds), 0) into v_new
    from public.karaoke_event_usage_segments
   where account_id=p_account_id and metered and lease_seconds is not null
     and charged_window_start = v_ws;

  -- LEGACY rows (pre-cutover, lease_seconds NULL): original interval calc clamped to the window.
  select coalesce(sum(greatest(0, extract(epoch from (
             least(coalesce(s.ended_at, p_as_of),
                   case when r.status<>'playing' then coalesce(r.completed_at, p_as_of) else p_as_of end,
                   v_we) - greatest(s.started_at, v_ws))))), 0)
    into v_legacy
    from public.karaoke_event_usage_segments s
    join public.karaoke_requests r on r.id=s.request_id
   where s.account_id=p_account_id and s.metered and s.lease_seconds is null
     and s.started_at < v_we and coalesce(s.ended_at, p_as_of) > v_ws;

  v_used := v_new + v_legacy;
  v_limit := p.free_limit_seconds; v_remaining := greatest(0, v_limit - floor(v_used)::int);
  return jsonb_build_object('plan','FREE','unlimited',false,'enforcementEnabled',p.enforcement_enabled,
    'limitSeconds',v_limit,'usedSeconds',floor(v_used)::int,'remainingSeconds',v_remaining,
    'asOf',p_as_of,'windowStart',v_ws,'windowEnd',v_we,'timezone',v_tz,'model','lease_v2');
end; $$;
revoke all on function public.karaoke_free_minutes_entitlement_at_v2(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_free_minutes_entitlement_at_v2(uuid, timestamptz) to service_role;

-- ── E. BEGIN v2 — account lock FIRST; cache-read duration; union charge; pass full-video gate ──
create or replace function public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_status text; v_event uuid; v_ready timestamptz; v_req_room uuid;
  v_ev_room uuid; v_ev_status text; v_first uuid; v_plan text; v_plan_n int; v_enf boolean; v_tz text; v_upd int; v_ent jsonb;
  v_video text; v_dur int; v_cur_end timestamptz; v_active timestamptz; v_song_end timestamptz; v_new_end timestamptz; v_charge int; v_remaining int;
  v_ws timestamptz; v_we timestamptz;
  v_active_pass uuid; v_active_expires timestamptz; v_sel_pass uuid; v_sel_dur int; v_pass_grant uuid;
  v_pass_covered boolean := false; v_activate boolean := false; v_upd2 int; v_pass_expires timestamptz;
begin
  if p_mode not in ('guest','promote') then return jsonb_build_object('outcome','invalid_mode'); end if;
  -- Resolve the canonical owner (read), then take the ACCOUNT advisory lock FIRST (before the
  -- room lock and before any request/event ROW lock) via the one shared deterministic key fn.
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account));   -- canonical account lock
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));                    -- then room
  v_now := clock_timestamp();
  select r.status, r.event_id, r.ready_at, r.room_id, r.youtube_video_id
    into v_status, v_event, v_ready, v_req_room, v_video
    from public.karaoke_requests r where r.id=p_request_id and r.room_id=p_room_id for update;   -- then row lock
  if v_status is null then return jsonb_build_object('outcome','not_found'); end if;
  if v_status <> 'waiting' then return jsonb_build_object('outcome','not_waiting'); end if;
  select e.room_id, e.status into v_ev_room, v_ev_status from public.karaoke_events e where e.id=v_event;
  if v_event is null or v_ev_room is distinct from p_room_id or v_req_room is distinct from p_room_id
     or v_ev_status is distinct from 'active' then
    return jsonb_build_object('outcome','event_state_invalid'); end if;
  if exists (select 1 from public.karaoke_requests where room_id=p_room_id and status='playing') then
    return jsonb_build_object('outcome','already_playing'); end if;
  if p_mode='guest' then
    select id into v_first from public.karaoke_requests
      where room_id=p_room_id and event_id=v_event and status='waiting' order by position,created_at,id limit 1;
    if v_first is distinct from p_request_id then return jsonb_build_object('outcome','not_next'); end if;
  else
    if v_ready is null then return jsonb_build_object('outcome','not_ready'); end if;
    select id into v_first from public.karaoke_requests
      where room_id=p_room_id and event_id=v_event and status='waiting' and ready_at is not null
      order by position,created_at,id limit 1;
    if v_first is distinct from p_request_id then return jsonb_build_object('outcome','not_next'); end if;
  end if;

  -- DURATION from the durable cache by the request's canonical videoId. FAIL CLOSED otherwise.
  select duration_seconds into v_dur from public.karaoke_video_durations where video_id = v_video;
  if v_dur is null or v_dur < 1 or v_dur > 900 then
    return jsonb_build_object('outcome','duration_unavailable'); end if;

  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=v_account and status='active';
  if not (v_plan_n=1 and v_plan in ('FREE','PRO')) then v_plan:='FREE'; end if;
  select coalesce((select enforcement_enabled from public.karaoke_usage_policy where policy_key='default'), false) into v_enf;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz from public.karaoke_accounts where id=v_account;
  v_ws := date_trunc('day', v_now at time zone v_tz) at time zone v_tz;   -- charged window @ authorization
  v_we := v_ws + interval '1 day';

  -- Account-level union: the current lease end across ALL the account's rooms (never shrinks).
  select max(lease_ends_at) into v_cur_end from public.karaoke_event_usage_segments
    where account_id=v_account and lease_ends_at is not null and lease_ends_at > v_now;
  v_active   := greatest(coalesce(v_cur_end, v_now), v_now);
  v_song_end := v_now + make_interval(secs => v_dur);
  v_new_end  := greatest(v_active, v_song_end);
  v_charge   := ceil(extract(epoch from (v_new_end - v_active)))::int;   -- union extension max(0, N-E)

  -- Timed Access Pass resolution (BUILD 17 semantics) + full-video window gate.
  if v_plan <> 'PRO' then
    with exp as (
      update public.timed_access_pass_grants set status='EXPIRED', expired_at=v_now, updated_at=now()
       where account_id=v_account and status='ACTIVE' and expires_at <= v_now returning id)
    insert into public.timed_access_pass_audit (pass_grant_id, account_id, actor_type, action, from_status, to_status)
    select id, v_account, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED' from exp;

    select id, expires_at into v_active_pass, v_active_expires from public.timed_access_pass_grants
      where account_id=v_account and status='ACTIVE' and expires_at > v_now for update limit 1;
    if v_active_pass is not null then
      v_pass_covered := true; v_pass_grant := v_active_pass; v_pass_expires := v_active_expires;
    else
      select id, duration_seconds into v_sel_pass, v_sel_dur from public.timed_access_pass_grants
        where account_id=v_account and status='SELECTED' for update limit 1;
      if v_sel_pass is not null then
        v_pass_covered := true; v_activate := true; v_pass_grant := v_sel_pass;
        v_pass_expires := v_now + make_interval(secs => v_sel_dur);
      end if;
    end if;
  end if;

  -- PRE-HANDOFF gate. Pass-covered: whole video must finish inside the pass window.
  if v_pass_covered then
    if v_song_end > v_pass_expires then
      return jsonb_build_object('outcome','pass_insufficient','passExpiresAt',v_pass_expires); end if;
  elsif v_enf and v_plan='FREE' then
    v_ent := public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now);
    v_remaining := (v_ent->>'remainingSeconds')::int;
    if v_charge > v_remaining then
      return jsonb_build_object('outcome','upgrade_required','entitlement',v_ent); end if;
  end if;

  update public.karaoke_requests set status='playing', started_at=v_now
    where id=p_request_id and room_id=p_room_id and status='waiting';
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;

  if v_activate then
    update public.timed_access_pass_grants
       set status='ACTIVE', activated_at=v_now, expires_at=v_pass_expires, updated_at=now()
     where id=v_sel_pass and status='SELECTED';
    get diagnostics v_upd2 = row_count;
    if v_upd2 <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status, metadata)
    values (v_sel_pass, v_account, 'SYSTEM', 'dj_start', 'ACTIVATED', 'SELECTED', 'ACTIVE',
            jsonb_build_object('requestId', p_request_id, 'roomId', p_room_id, 'eventId', v_event));
  end if;

  insert into public.karaoke_event_usage_segments
    (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot,
     pass_grant_id,metering_paused_by_pass, duration_seconds, lease_ends_at, lease_seconds,
     charged_window_start, charged_window_end)
  values (v_account, v_event, p_room_id, p_request_id, v_plan,
          (v_plan='FREE' and not v_pass_covered), v_now, v_tz,
          v_pass_grant, v_pass_covered,
          v_dur, v_new_end, (case when v_pass_covered then 0 else v_charge end),
          v_ws, v_we);   -- unique(request_id) → replay-safe

  return jsonb_build_object('outcome','ok','leaseEndsAt',v_new_end,
    'chargeSeconds',(case when v_pass_covered then 0 else v_charge end),
    'durationSeconds',v_dur,'chargedWindowStart',v_ws,'passActivated',v_activate,'passCovered',v_pass_covered,
    'passGrantId',v_pass_grant,'passExpiresAt',v_pass_expires,
    'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
end; $$;
revoke all on function public.karaoke_begin_song_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_begin_song_v2(uuid, uuid, text) to service_role;

-- ── F. END v2 — close the QUEUE request; NEVER modify lease_ends_at (non-shrink) ──
create or replace function public.karaoke_end_song_v2(p_room_id uuid, p_request_id uuid, p_action text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_new_status text; v_reason text; v_status text; v_seg_open boolean; v_upd int;
begin
  if p_action not in ('complete','skip','pass','replace') then return jsonb_build_object('outcome','invalid_action'); end if;
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account));
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_now := clock_timestamp();
  select status into v_status from public.karaoke_requests where id=p_request_id and room_id=p_room_id for update;
  if v_status is null then return jsonb_build_object('outcome','not_found'); end if;
  select exists(select 1 from public.karaoke_event_usage_segments where request_id=p_request_id and ended_at is null) into v_seg_open;
  v_new_status := case p_action when 'complete' then 'completed' else 'skipped' end;
  v_reason     := case p_action when 'complete' then 'completed' when 'skip' then 'skipped'
                                when 'pass' then 'passed' else 'replaced' end;
  if v_status='playing' then
    update public.karaoke_requests
       set status=v_new_status, completed_at = case when v_new_status='completed' then v_now else completed_at end
     where id=p_request_id and room_id=p_room_id and status='playing';
    get diagnostics v_upd = row_count;
    if v_upd <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;
    if v_seg_open then
      -- Close for provenance; lease_ends_at is NEVER modified → Finish cannot shrink the lease.
      update public.karaoke_event_usage_segments set ended_at=v_now, close_reason=v_reason
        where request_id=p_request_id and ended_at is null;
    end if;
    return jsonb_build_object('outcome','ok','segmentClosed',v_seg_open,
      'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
  elsif v_status in ('completed','skipped') then
    if v_seg_open then
      update public.karaoke_event_usage_segments set ended_at=v_now, close_reason='recovery'
        where request_id=p_request_id and ended_at is null;
    end if;
    return jsonb_build_object('outcome','recovered',
      'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
  end if;
  return jsonb_build_object('outcome','request_state_changed');
end; $$;
revoke all on function public.karaoke_end_song_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_end_song_v2(uuid, uuid, text) to service_role;

-- ── G. PREFLIGHT (read-only, before cutover) ──
--   Per-allowlist-account (before adding an account to karaoke_lease_rollout):
--     select count(*) from public.karaoke_event_usage_segments s
--       join public.karaoke_room_ownership o on o.room_id = s.room_id
--      where s.account_id = :account and s.ended_at is null and s.lease_ends_at is null;  -- must be 0
--   Global (before lease_write_mode='on'):
--     select count(*) from public.karaoke_event_usage_segments
--      where ended_at is null and lease_ends_at is null;                                  -- must be 0

-- ── H. ROLLBACK — stop new v2 WRITES; NEVER return issued leases to v1 accounting ──
--   update public.karaoke_usage_policy set lease_write_mode='off' where policy_key='default';
--   -- v2 entitlement READS remain in force; issued lease rows keep their lease_seconds/charged_window.
--   -- (Full teardown only if BUILD 20M is abandoned — would refund in-flight leases → reopens bypass.)
