-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- DRAFT — NOT a numbered migration yet, NOT applied to production. Rename to
-- 20260726120000_karaoke_shadow_metering_b1.sql at approved shadow-apply time.
-- btyNorebang — DAILY FREE KARAOKE MINUTES · B1 SHADOW METERING FOUNDATION (final corrected).
-- enforcement_enabled=false. Lock order EVERYWHERE: Room → exactly-one owner → Account
-- (recovery uses the segment's STORED account for the account lock). v_now := clock_timestamp()
-- AFTER locks. FKs NO ACTION (never CASCADE). service_role-only incl. trigger functions.

-- ── A. POLICY SINGLETON (undeletable) ──
create table if not exists public.karaoke_usage_policy (
  policy_key text primary key default 'default',
  free_limit_seconds int not null default 900 check (free_limit_seconds > 0),
  reset_hour_local int not null default 4 check (reset_hour_local between 0 and 23),
  warning_first_seconds int not null default 300 check (warning_first_seconds > 0),
  warning_second_seconds int not null default 120 check (warning_second_seconds > 0),
  enforcement_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint karaoke_usage_policy_singleton check (policy_key = 'default'),
  constraint karaoke_usage_policy_warn_order check (warning_first_seconds >= warning_second_seconds)
);
insert into public.karaoke_usage_policy (policy_key) values ('default') on conflict (policy_key) do nothing;
create or replace function public.karaoke_usage_policy_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'karaoke_usage_policy row is not deletable'; end; $$;
revoke all on function public.karaoke_usage_policy_guard() from public, anon, authenticated;   -- FIX 7
drop trigger if exists karaoke_usage_policy_no_delete on public.karaoke_usage_policy;
create trigger karaoke_usage_policy_no_delete before delete on public.karaoke_usage_policy
  for each row execute function public.karaoke_usage_policy_guard();
alter table public.karaoke_usage_policy enable row level security;
revoke all on table public.karaoke_usage_policy from public, anon, authenticated;
grant select, update on table public.karaoke_usage_policy to service_role;

-- ── B. ACCOUNT TIMEZONE + validation trigger + backfill ──
alter table public.karaoke_accounts add column if not exists timezone text not null default 'America/Los_Angeles';
alter table public.karaoke_accounts add column if not exists timezone_source text not null default 'default'
  check (timezone_source in ('default','browser'));
alter table public.karaoke_accounts add column if not exists timezone_captured_at timestamptz;
update public.karaoke_accounts set timezone='America/Los_Angeles' where timezone is null or btrim(timezone)='';
create or replace function public.karaoke_validate_timezone() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.timezone is null or not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone: %', coalesce(new.timezone,'(null)') using errcode='22023';
  end if; return new;
end; $$;
revoke all on function public.karaoke_validate_timezone() from public, anon, authenticated;      -- FIX 7
drop trigger if exists karaoke_accounts_tz_validate on public.karaoke_accounts;
create trigger karaoke_accounts_tz_validate before insert or update of timezone
  on public.karaoke_accounts for each row execute function public.karaoke_validate_timezone();

-- ── C. USAGE SEGMENT LEDGER (NO CASCADE) ──
create table if not exists public.karaoke_event_usage_segments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.karaoke_accounts(id),
  event_id   uuid not null references public.karaoke_events(id),
  room_id    uuid not null references public.karaoke_rooms(id),
  request_id uuid not null references public.karaoke_requests(id),
  plan_snapshot text not null check (plan_snapshot in ('FREE','PRO')),
  metered boolean not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  timezone_snapshot text not null,
  close_reason text check (close_reason in ('completed','skipped','passed','replaced','event_ended','recovery')),
  created_at timestamptz not null default now(),
  constraint usage_seg_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint usage_seg_reason_iff_ended check
    ((ended_at is null and close_reason is null) or (ended_at is not null and close_reason is not null)),
  constraint usage_seg_metered_matches_plan check (metered = (plan_snapshot = 'FREE')),
  constraint usage_seg_unique_request unique (request_id)
);
create unique index if not exists usage_seg_one_open_per_room  on public.karaoke_event_usage_segments (room_id)  where ended_at is null;
create unique index if not exists usage_seg_one_open_per_event on public.karaoke_event_usage_segments (event_id) where ended_at is null;
create index if not exists usage_seg_account_metered_time on public.karaoke_event_usage_segments (account_id, started_at, ended_at) where metered;
create index if not exists usage_seg_open_by_account on public.karaoke_event_usage_segments (account_id) where ended_at is null;
alter table public.karaoke_event_usage_segments enable row level security;
revoke all on table public.karaoke_event_usage_segments from public, anon, authenticated;
grant select, insert, update on table public.karaoke_event_usage_segments to service_role;

-- ── D. OWNER RESOLVER (exactly one active owner, else NULL) ──
create or replace function public.karaoke_room_owner_account(p_room_id uuid)
returns uuid language plpgsql stable set search_path = public, pg_temp as $$
declare v_ids uuid[];
begin
  select array_agg(distinct m.account_id) into v_ids
    from public.karaoke_room_ownership o
    join public.karaoke_workspace_members m on m.workspace_id = o.workspace_id
   where o.room_id = p_room_id and m.status='active' and m.role='owner';
  if v_ids is null or array_length(v_ids,1) is distinct from 1 then return null; end if;
  return v_ids[1];
end; $$;
revoke all on function public.karaoke_room_owner_account(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_room_owner_account(uuid) to service_role;

-- ── E. ENTITLEMENT _at (LEAST effective-end; canonical-active counts; explicit guards) ──
create or replace function public.karaoke_free_minutes_entitlement_at(p_account_id uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare v_tz text; v_plan text; v_plan_n int; p record;
  v_local timestamp; v_anchor date; v_ws timestamptz; v_we timestamptz;
  v_used numeric := 0; v_active int := 0; v_burn int := 0; v_limit int; v_remaining int; v_warn text := 'none';
begin
  if p_as_of is null then return jsonb_build_object('outcome','invalid_as_of'); end if;
  select * into p from public.karaoke_usage_policy where policy_key='default';
  if not found then return jsonb_build_object('outcome','policy_unavailable'); end if;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz
    from public.karaoke_accounts where id=p_account_id;
  if not found then return jsonb_build_object('outcome','account_not_found'); end if;
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=p_account_id and status='active';
  if v_plan_n=1 and v_plan in ('FREE','PRO') then null; else v_plan:='FREE'; end if;
  v_local  := p_as_of at time zone v_tz;
  v_anchor := date(v_local - make_interval(hours => p.reset_hour_local));
  v_ws := ((v_anchor::timestamp     + make_interval(hours => p.reset_hour_local))) at time zone v_tz;
  v_we := (((v_anchor+1)::timestamp + make_interval(hours => p.reset_hour_local))) at time zone v_tz;
  select count(*) into v_active from public.karaoke_event_usage_segments s
    join public.karaoke_requests r on r.id=s.request_id
    join public.karaoke_events e   on e.id=s.event_id
   where s.account_id=p_account_id and s.ended_at is null and r.status='playing' and e.status not in ('ended','archived');
  select count(*) into v_burn from public.karaoke_event_usage_segments s
    join public.karaoke_requests r on r.id=s.request_id
    join public.karaoke_events e   on e.id=s.event_id
   where s.account_id=p_account_id and s.ended_at is null and s.metered and r.status='playing' and e.status not in ('ended','archived');
  if v_plan='PRO' then
    return jsonb_build_object('plan','PRO','unlimited',true,'enforcementEnabled',p.enforcement_enabled,
      'limitSeconds',null,'usedSeconds',0,'remainingSeconds',null,'activePlaybackCount',v_active,
      'burnRatePerSecond',0,'asOf',p_as_of,'windowStart',v_ws,'nextResetAt',v_we,'timezone',v_tz,
      'warnLevel','none','anomaly',(v_plan_n>1));
  end if;
  select coalesce(sum(greatest(0, extract(epoch from (
           least(
             coalesce(s.ended_at, p_as_of),
             case when r.status<>'playing' then coalesce(r.completed_at, p_as_of) else p_as_of end,
             case when e.status in ('ended','archived') then coalesce(e.ended_at, p_as_of) else p_as_of end,
             p_as_of, v_we
           ) - greatest(s.started_at, v_ws)
         )))), 0)
    into v_used
    from public.karaoke_event_usage_segments s
    join public.karaoke_events   e on e.id=s.event_id
    join public.karaoke_requests r on r.id=s.request_id
   where s.account_id=p_account_id and s.metered
     and s.started_at < v_we and coalesce(s.ended_at, p_as_of) > v_ws;
  v_limit := p.free_limit_seconds; v_remaining := greatest(0, v_limit - floor(v_used)::int);
  if p.enforcement_enabled then
    v_warn := case when v_remaining<=0 then 'zero'
                   when v_remaining<=p.warning_second_seconds then 'two_min'
                   when v_remaining<=p.warning_first_seconds then 'five_min' else 'none' end;
  end if;
  return jsonb_build_object('plan','FREE','unlimited',false,'enforcementEnabled',p.enforcement_enabled,
    'limitSeconds',v_limit,'usedSeconds',floor(v_used)::int,'remainingSeconds',v_remaining,
    'activePlaybackCount',v_active,'burnRatePerSecond',v_burn,'asOf',p_as_of,
    'windowStart',v_ws,'nextResetAt',v_we,'timezone',v_tz,'warnLevel',v_warn,'anomaly',(v_plan_n>1));
end; $$;
revoke all on function public.karaoke_free_minutes_entitlement_at(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_free_minutes_entitlement_at(uuid, timestamptz) to service_role;
create or replace function public.karaoke_free_minutes_entitlement(p_account_id uuid)
returns jsonb language sql volatile set search_path = public, pg_temp as $$
  select public.karaoke_free_minutes_entitlement_at(p_account_id, clock_timestamp()); $$;
revoke all on function public.karaoke_free_minutes_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_free_minutes_entitlement(uuid) to service_role;

-- ── F. TIMEZONE CAPTURE (atomic) ──
create or replace function public.capture_karaoke_account_timezone(p_account_id uuid, p_timezone text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_source text; v_has_usage boolean;
begin
  perform pg_advisory_xact_lock(hashtext('acct:' || p_account_id::text));
  select timezone_source into v_source from public.karaoke_accounts where id=p_account_id for update;
  if not found then return jsonb_build_object('outcome','account_not_found'); end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name=p_timezone) then
    return jsonb_build_object('outcome','invalid_timezone'); end if;
  if v_source <> 'default' then return jsonb_build_object('outcome','already_captured'); end if;
  select exists(select 1 from public.karaoke_event_usage_segments where account_id=p_account_id) into v_has_usage;
  if v_has_usage then return jsonb_build_object('outcome','locked_usage_started'); end if;
  update public.karaoke_accounts set timezone=p_timezone, timezone_source='browser', timezone_captured_at=now()
   where id=p_account_id;
  return jsonb_build_object('outcome','ok','timezone',p_timezone);
end; $$;
revoke all on function public.capture_karaoke_account_timezone(uuid, text) from public, anon, authenticated;
grant execute on function public.capture_karaoke_account_timezone(uuid, text) to service_role;

-- ── G. ATOMIC BEGIN — stage-open parity + EVENT-SCOPED canonical + event/room relationship ──
create or replace function public.karaoke_begin_song(p_room_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_status text; v_event uuid; v_ready timestamptz; v_req_room uuid;
  v_ev_room uuid; v_ev_status text; v_first uuid; v_plan text; v_plan_n int; v_enf boolean; v_tz text; v_upd int; v_ent jsonb;
begin
  if p_mode not in ('guest','promote') then return jsonb_build_object('outcome','invalid_mode'); end if;
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('acct:' || v_account::text));
  v_now := clock_timestamp();
  select r.status, r.event_id, r.ready_at, r.room_id into v_status, v_event, v_ready, v_req_room
    from public.karaoke_requests r where r.id=p_request_id and r.room_id=p_room_id for update;
  if v_status is null then return jsonb_build_object('outcome','not_found'); end if;
  if v_status <> 'waiting' then return jsonb_build_object('outcome','not_waiting'); end if;
  -- FIX 3: request↔event↔room relationship must be consistent + event active
  select e.room_id, e.status into v_ev_room, v_ev_status from public.karaoke_events e where e.id=v_event;
  if v_event is null or v_ev_room is distinct from p_room_id or v_req_room is distinct from p_room_id
     or v_ev_status is distinct from 'active' then
    return jsonb_build_object('outcome','event_state_invalid'); end if;
  -- FIX 1: STAGE-OPEN parity (room-scoped; matches the one-playing-per-room index)
  if exists (select 1 from public.karaoke_requests where room_id=p_room_id and status='playing') then
    return jsonb_build_object('outcome','already_playing'); end if;
  -- FIX 2: canonical selection is EVENT-SCOPED (stale old-Event waiting rows can't block)
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
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=v_account and status='active';
  if v_plan_n=1 and v_plan in ('FREE','PRO') then null; else v_plan:='FREE'; end if;
  select coalesce((select enforcement_enabled from public.karaoke_usage_policy where policy_key='default'), false) into v_enf;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz from public.karaoke_accounts where id=v_account;
  if v_enf and v_plan='FREE' then
    v_ent := public.karaoke_free_minutes_entitlement_at(v_account, v_now);
    if (v_ent->>'outcome') is not null then return jsonb_build_object('outcome','shadow_metering_error','detail',v_ent->>'outcome'); end if;
    if (v_ent->>'remainingSeconds')::int <= 0 then
      return jsonb_build_object('outcome','upgrade_required','entitlement',v_ent); end if;
  end if;
  update public.karaoke_requests set status='playing', started_at=v_now
    where id=p_request_id and room_id=p_room_id and status='waiting';
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;
  insert into public.karaoke_event_usage_segments
    (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot)
  values (v_account, v_event, p_room_id, p_request_id, v_plan, (v_plan='FREE'), v_now, v_tz);  -- conflict → rollback (fail closed)
  return jsonb_build_object('outcome','ok','entitlement', public.karaoke_free_minutes_entitlement_at(v_account, v_now));
end; $$;
revoke all on function public.karaoke_begin_song(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_begin_song(uuid, uuid, text) to service_role;

-- ── H. ATOMIC END — parity + recovery anomaly + FIX 8 segment-missing observability ──
create or replace function public.karaoke_end_song(p_room_id uuid, p_request_id uuid, p_action text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_new_status text; v_reason text; v_status text; v_seg_open boolean; v_upd int;
begin
  if p_action not in ('complete','skip','pass','replace') then return jsonb_build_object('outcome','invalid_action'); end if;
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('acct:' || v_account::text));
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
      update public.karaoke_event_usage_segments set ended_at=v_now, close_reason=v_reason
        where request_id=p_request_id and ended_at is null;
      return jsonb_build_object('outcome','ok','segmentClosed',true,'shadowAnomaly','none',
        'entitlement', public.karaoke_free_minutes_entitlement_at(v_account, v_now));
    end if;
    -- FIX 8: playing terminal'd but NO open segment (cutover gap after B1) → observable anomaly, do not block
    return jsonb_build_object('outcome','ok','segmentClosed',false,'shadowAnomaly','segment_missing',
      'entitlement', public.karaoke_free_minutes_entitlement_at(v_account, v_now));
  elsif v_status in ('completed','skipped') then   -- already terminal (a prior complete/skip)
    if v_seg_open then
      update public.karaoke_event_usage_segments set ended_at=v_now, close_reason='recovery'
        where request_id=p_request_id and ended_at is null;
      return jsonb_build_object('outcome','recovered','entitlement', public.karaoke_free_minutes_entitlement_at(v_account, v_now));
    end if;
    return jsonb_build_object('outcome','already_done');
  else                                             -- 'waiting'/'removed': invalid terminal source
    return jsonb_build_object('outcome','not_playing');
  end if;
end; $$;
revoke all on function public.karaoke_end_song(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_end_song(uuid, uuid, text) to service_role;

-- ── I. EVENT END — owner-invalid writes nothing; re-read after locks; FIX 4 ended-cap ──
create or replace function public.end_karaoke_event(p_event_id uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare v_room_id uuid; v_status text; v_ended_at timestamptz; v_now timestamptz; v_account uuid;
  v_closed int:=0; v_n int:=0; v_completed int:=0; v_rec int:=0; v_anom boolean:=false;
begin
  select room_id into v_room_id from public.karaoke_events where id=p_event_id;
  if v_room_id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext(v_room_id::text));
  v_account := public.karaoke_room_owner_account(v_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('acct:' || v_account::text));
  v_now := clock_timestamp();
  select status, ended_at into v_status, v_ended_at from public.karaoke_events where id=p_event_id for update;
  if v_status in ('ended','archived') then
    if v_ended_at is null then v_anom := true; end if;   -- abnormal ended-without-ts
    -- FIX 4: cap recovery close at the event's real ended_at (not v_now), clamped >= started_at
    with rc as (
      update public.karaoke_event_usage_segments s
         set ended_at = greatest(s.started_at, least(v_now, coalesce(v_ended_at, v_now))),
             close_reason = 'recovery'
       where s.event_id = p_event_id and s.ended_at is null returning 1)
    select count(*) into v_rec from rc;
    select count(*) into v_completed from public.karaoke_requests where event_id=p_event_id and status='completed';
    return jsonb_build_object('eventId',p_event_id,'status',v_status,'endedAt',v_ended_at,
      'completedCount',coalesce(v_completed,0),'unfinishedClosedCount',0,'recoveryClosedCount',v_rec,'anomaly',v_anom);
  end if;
  -- Active→ended: closing NOW is correct (event ends now).
  update public.karaoke_event_usage_segments set ended_at=v_now, close_reason='event_ended'
    where event_id=p_event_id and ended_at is null;
  update public.karaoke_sessions set status='ended', ended_at=v_now where room_id=v_room_id and status='active';
  with w  as (update public.karaoke_requests set status='removed', ready_at=null, youtube_queued_at=null
              where event_id=p_event_id and status='waiting' returning 1) select count(*) into v_n from w;  v_closed:=v_closed+coalesce(v_n,0);
  with pl as (update public.karaoke_requests set status='skipped', ready_at=null, youtube_queued_at=null
              where event_id=p_event_id and status='playing' returning 1) select count(*) into v_n from pl; v_closed:=v_closed+coalesce(v_n,0);
  update public.karaoke_events set status='ended', ended_at=v_now
    where id=p_event_id and status in ('draft','active') returning status, ended_at into v_status, v_ended_at;
  select count(*) into v_completed from public.karaoke_requests where event_id=p_event_id and status='completed';
  return jsonb_build_object('eventId',p_event_id,'status',v_status,'endedAt',v_ended_at,
    'completedCount',coalesce(v_completed,0),'unfinishedClosedCount',v_closed);
end; $$;
revoke all on function public.end_karaoke_event(uuid) from public, anon, authenticated;
grant execute on function public.end_karaoke_event(uuid) to service_role;

-- ── J. PER-REQUEST CUTOVER — FIX 6 stronger validation ──
create or replace function public.karaoke_cutover_open_segment(p_request_id uuid, p_cutover_at timestamptz)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_room uuid; v_event uuid; v_status text; v_started timestamptz; v_account uuid; v_now timestamptz;
  v_plan text; v_plan_n int; v_tz text; v_start timestamptz; v_exists boolean; v_ev_room uuid; v_ev_status text;
begin
  if p_cutover_at is null then return jsonb_build_object('outcome','invalid_cutover'); end if;
  if p_cutover_at > clock_timestamp() then return jsonb_build_object('outcome','invalid_cutover'); end if;  -- no future cutover
  select room_id, event_id into v_room, v_event from public.karaoke_requests where id=p_request_id;
  if v_room is null then return jsonb_build_object('outcome','not_found'); end if;
  perform pg_advisory_xact_lock(hashtext(v_room::text));
  v_account := public.karaoke_room_owner_account(v_room);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('acct:' || v_account::text));
  v_now := clock_timestamp();
  select status, started_at, event_id into v_status, v_started, v_event
    from public.karaoke_requests where id=p_request_id and room_id=v_room for update;
  if v_status <> 'playing' then return jsonb_build_object('outcome','not_playing'); end if;
  select room_id, status into v_ev_room, v_ev_status from public.karaoke_events where id=v_event;
  if v_ev_room is distinct from v_room or v_ev_status is distinct from 'active' then
    return jsonb_build_object('outcome','event_state_invalid'); end if;                 -- ended/broken event → no cutover
  select exists(select 1 from public.karaoke_event_usage_segments where request_id=p_request_id) into v_exists;
  if v_exists then return jsonb_build_object('outcome','already_segmented'); end if;      -- replay no-op
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=v_account and status='active';
  if v_plan_n=1 and v_plan in ('FREE','PRO') then null; else v_plan:='FREE'; end if;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz from public.karaoke_accounts where id=v_account;
  v_start := greatest(coalesce(v_started, p_cutover_at), p_cutover_at);                   -- never future, no history
  insert into public.karaoke_event_usage_segments
    (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot)
  values (v_account, v_event, v_room, p_request_id, v_plan, (v_plan='FREE'), v_start, v_tz);
  return jsonb_build_object('outcome','ok','startedAt',v_start);
end; $$;
revoke all on function public.karaoke_cutover_open_segment(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_cutover_open_segment(uuid, timestamptz) to service_role;

-- ── K. PER-SEGMENT RECOVERY — FIX 2 stored-account lock + FIX 5 re-read after locks ──
create or replace function public.karaoke_reconcile_segment(p_segment_id uuid)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_room uuid; v_acct_stored uuid; v_owner uuid; v_now timestamptz; v_open boolean;
  v_request uuid; v_event uuid; v_started timestamptz; v_rstatus text; v_estatus text;
  v_rcompleted timestamptz; v_eended timestamptz; v_end timestamptz; v_upd int; v_anom text := 'none';
begin
  select room_id, account_id into v_room, v_acct_stored
    from public.karaoke_event_usage_segments where id=p_segment_id;              -- pre-read ONLY room/account
  if v_room is null then return jsonb_build_object('outcome','not_found'); end if;
  perform pg_advisory_xact_lock(hashtext(v_room::text));                         -- ROOM
  v_owner := public.karaoke_room_owner_account(v_room);
  perform pg_advisory_xact_lock(hashtext('acct:' || v_acct_stored::text));       -- ACCOUNT = STORED (consistent order)
  v_now := clock_timestamp();
  select request_id, event_id, started_at, (ended_at is null)                    -- FOR UPDATE re-read
    into v_request, v_event, v_started, v_open
    from public.karaoke_event_usage_segments where id=p_segment_id for update;
  if not v_open then return jsonb_build_object('outcome','already_closed'); end if;
  if v_owner is not null and v_owner = v_acct_stored then v_anom := 'none';
  elsif v_owner is null then v_anom := 'ownership_anomaly';
  else return jsonb_build_object('outcome','ownership_mismatch'); end if;         -- write 0
  select status, completed_at into v_rstatus, v_rcompleted from public.karaoke_requests where id=v_request;
  select status, ended_at    into v_estatus, v_eended     from public.karaoke_events   where id=v_event;
  if v_rstatus='playing' and v_estatus not in ('ended','archived') then
    return jsonb_build_object('outcome','still_active'); end if;
  v_end := least(v_now,
    case when v_rstatus<>'playing' then coalesce(v_rcompleted, v_now) else v_now end,
    case when v_estatus in ('ended','archived') then coalesce(v_eended, v_now) else v_now end);
  if v_end < v_started then v_end := v_started; end if;
  update public.karaoke_event_usage_segments set ended_at=v_end, close_reason='recovery'
    where id=p_segment_id and ended_at is null;
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then return jsonb_build_object('outcome','state_changed'); end if;
  return jsonb_build_object('outcome',
    case when v_anom='none' then 'recovered' else 'recovered_with_ownership_anomaly' end, 'endedAt', v_end);
end; $$;
revoke all on function public.karaoke_reconcile_segment(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_reconcile_segment(uuid) to service_role;
