-- BUILD 20M-R4 — FREE Final Song Grace V1 (additive; server-authoritative).
--
-- POLICY: a FREE Host who still has SOME remaining time, but not enough to cover the whole
-- next song, may be admitted ONCE per FREE entitlement window when the shortfall is ≤ 90s.
-- The lease still covers the WHOLE song (so external playback stays authorized and the union
-- math protects the next start), but only the remaining balance is CHARGED to the FREE
-- entitlement. The difference is recorded as GRACE, never as ordinary FREE usage.
--
-- WHY IT FITS THE EXISTING MODEL WITHOUT NEW ACCOUNTING: karaoke_free_minutes_entitlement_at_v2
-- sums `lease_seconds` (not the interval, not duration_seconds), and the existing CHECK
-- `usage_seg_lease_consistency` already permits `lease_seconds between 0 and duration_seconds`.
-- So "lease 69s, charge 30s" is expressible in the SHIPPED schema: lease_ends_at = now+69 while
-- lease_seconds = 30. No entitlement function changes, no new sum, no backfill.
--
-- ONCE-PER-WINDOW is enforced durably by karaoke_free_final_song_grace with
-- unique(account_id, charged_window_start) — the same window identity the segments already
-- store. The account advisory lock taken at the top of begin_v2 serialises concurrent
-- attempts; the unique index is the backstop.
--
-- Forward-only: 20260803120000 and 20260804120000 are NOT edited. Rollback = re-run the
-- function body from 20260804120000 and (optionally) drop the ledger table; already-granted
-- rows stay truthful because the grace seconds were never counted as FREE usage.

-- ── A. DURABLE ONCE-PER-WINDOW LEDGER ──
create table if not exists public.karaoke_free_final_song_grace (
  id                      uuid primary key default gen_random_uuid(),
  account_id              uuid not null references public.karaoke_accounts(id) on delete cascade,
  -- The FREE entitlement window this grace belongs to — identical to the value the usage
  -- segment stores, so "same window" means the same thing in both places.
  charged_window_start    timestamptz not null,
  charged_window_end      timestamptz not null,
  request_id              uuid not null references public.karaoke_requests(id) on delete cascade,
  segment_id              uuid references public.karaoke_event_usage_segments(id) on delete set null,
  remaining_before_seconds int not null check (remaining_before_seconds >= 0),
  duration_seconds        int not null check (duration_seconds between 1 and 900),
  charged_seconds         int not null check (charged_seconds >= 0),
  grace_seconds           int not null check (grace_seconds > 0 and grace_seconds <= 90),
  created_at              timestamptz not null default now(),
  -- INVARIANT 1: at most one final-song grace per account per FREE window.
  constraint karaoke_free_final_song_grace_once unique (account_id, charged_window_start)
);
-- INVARIANT 2: a request can back at most one grace row (retry resolves to the same row).
create unique index if not exists karaoke_free_final_song_grace_request
  on public.karaoke_free_final_song_grace (request_id);
create index if not exists karaoke_free_final_song_grace_account
  on public.karaoke_free_final_song_grace (account_id, created_at desc);

alter table public.karaoke_free_final_song_grace enable row level security;
revoke all on table public.karaoke_free_final_song_grace from public, anon, authenticated;
grant select, insert on table public.karaoke_free_final_song_grace to service_role;

-- ── B. BEGIN v2 — identical to 20260804120000 except the FREE branch ──
create or replace function public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_status text; v_event uuid; v_ready timestamptz; v_req_room uuid;
  v_ev_room uuid; v_ev_status text; v_first uuid; v_plan text; v_plan_n int; v_enf boolean; v_tz text; v_upd int; v_ent jsonb;
  v_video text; v_dur int; v_cur_end timestamptz; v_active timestamptz; v_song_end timestamptz; v_new_end timestamptz; v_charge int; v_remaining int;
  v_ws timestamptz; v_we timestamptz;
  v_active_pass uuid; v_active_expires timestamptz; v_sel_pass uuid; v_sel_dur int; v_pass_grant uuid;
  v_pass_covered boolean := false; v_activate boolean := false; v_upd2 int; v_pass_expires timestamptz;
  -- R4 FREE Final Song Grace
  v_grace boolean := false; v_grace_secs int; v_charged int; v_shortfall int; v_seg_id uuid;
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
      -- R1: additive detail so the client can explain the boundary concretely. remainingSeconds
      -- uses the SAME semantics as the canonical pass projection (20260728120000):
      -- greatest(0, floor(epoch(expires_at - as_of))). No admission value changes.
      return jsonb_build_object('outcome','pass_insufficient','passExpiresAt',v_pass_expires,
        'durationSeconds',v_dur,
        'remainingSeconds', greatest(0, floor(extract(epoch from (v_pass_expires - v_now)))::int)); end if;
  elsif v_enf and v_plan='FREE' then
    v_ent := public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now);
    v_remaining := (v_ent->>'remainingSeconds')::int;
    if v_charge > v_remaining then
      -- ── R4 FREE FINAL SONG GRACE ──
      -- All eight conditions must hold. `v_remaining > 0` keeps a fully exhausted account
      -- blocked (grace tops up a partial balance; it never grants a free song from zero).
      -- The NOT EXISTS is evaluated while this transaction holds the account advisory lock
      -- taken at the top of this function, so two concurrent attempts cannot both pass it;
      -- the unique(account_id, charged_window_start) index is the final backstop.
      v_shortfall := v_charge - v_remaining;
      if v_remaining > 0 and v_shortfall <= 90 and not exists (
           select 1 from public.karaoke_free_final_song_grace g
            where g.account_id = v_account and g.charged_window_start = v_ws)
      then
        v_grace := true;
        v_grace_secs := v_shortfall;
        v_charged := v_remaining;   -- consume EXACTLY the remaining balance → remaining becomes 0
      else
        -- R1: requiredChargeSeconds is the value ACTUALLY compared with remainingSeconds above
        -- (the non-overlapping union extension), which is <= durationSeconds whenever an active
        -- lease already covers part of this song. Both are returned so the client never presents
        -- raw song length as the required time.
        return jsonb_build_object('outcome','upgrade_required','entitlement',v_ent,
          'durationSeconds',v_dur,
          'requiredChargeSeconds',v_charge,
          'remainingSeconds',v_remaining); end if;
    end if;
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
          -- R4: on grace the lease still covers the WHOLE song (v_new_end unchanged) but only
          -- the remaining balance is charged, so the entitlement sum lands on exactly the limit.
          -- CHECK usage_seg_lease_consistency already allows lease_seconds < duration_seconds.
          v_dur, v_new_end, (case when v_pass_covered then 0 when v_grace then v_charged else v_charge end),
          v_ws, v_we)   -- unique(request_id) → replay-safe
  returning id into v_seg_id;

  -- R4: durably burn the once-per-window grace. Inside the SAME transaction as the queue
  -- transition and the segment, so a rollback anywhere leaves no grace consumed.
  if v_grace then
    insert into public.karaoke_free_final_song_grace
      (account_id, charged_window_start, charged_window_end, request_id, segment_id,
       remaining_before_seconds, duration_seconds, charged_seconds, grace_seconds)
    values (v_account, v_ws, v_we, p_request_id, v_seg_id,
            v_remaining, v_dur, v_charged, v_grace_secs);
  end if;

  return jsonb_build_object('outcome','ok','leaseEndsAt',v_new_end,
    'chargeSeconds',(case when v_pass_covered then 0 when v_grace then v_charged else v_charge end),
    'finalSongGraceApplied', v_grace,
    'finalSongGraceSeconds', (case when v_grace then v_grace_secs else null end),
    'finalSongChargedSeconds', (case when v_grace then v_charged else null end),
    'remainingBeforeSeconds', (case when v_grace then v_remaining else null end),
    'durationSeconds',v_dur,'chargedWindowStart',v_ws,'passActivated',v_activate,'passCovered',v_pass_covered,
    'passGrantId',v_pass_grant,'passExpiresAt',v_pass_expires,
    'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
end; $$;
revoke all on function public.karaoke_begin_song_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_begin_song_v2(uuid, uuid, text) to service_role;
