-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- BUILD 24 — LIVE PLAYBACK CLOCK & FREE BALANCE TRUTH V1 (server-truth half).
--
-- Three proven regressions introduced when BUILD 20M cut FREE accounting over to the
-- lease model. All three are in `karaoke_free_minutes_entitlement_at_v2` (20260803120000),
-- which was written as a fresh function rather than a port of the v1 body and therefore
-- silently dropped fields and moved a policy boundary. `lease_write_mode='on'` GLOBAL
-- means every FREE Host reads through it.
--
--  D1  `activePlaybackCount` was omitted. domain/usage.ts coerces the missing key to 0, so
--      `isPlaying` is ALWAYS false and the `zero_playing` banner is UNREACHABLE. A Host who
--      exhausts FREE mid-song — including every FREE Final Song Grace admission, whose whole
--      point is "this song plays, the next cannot" — is shown the red `zero_idle` block
--      ("다음 곡을 시작할 수 없어요") instead of "이 곡은 끝까지 부를 수 있어요". The server
--      already admitted the song; the UI called it blocked. That is the dishonesty.
--
--  D2  `nextResetAt` was omitted, so "N시에 초기화돼요" silently vanished from both the
--      normal and the exhausted copy on web and native.
--
--  D3  The FREE window anchor moved from `karaoke_usage_policy.reset_hour_local` (= 4) to
--      `date_trunc('day', ...)` — local MIDNIGHT. v1 still honours 04:00, so the two models
--      disagreed by four hours and a Host got a fresh 15 minutes at 00:00. The repo's own
--      integration test asserts the midnight behaviour under a section titled "04:00
--      America/Los_Angeles attribution", which is why this never surfaced.
--      FOUNDER DECISION (BUILD 24): the v1 policy is canonical. 04:00 is restored.
--
-- ATTRIBUTION CHANGE (required by D3, and a strict improvement on its own):
-- lease rows were summed by `charged_window_start = v_ws` — exact equality against a value
-- frozen at write time. That is correct only while the window DEFINITION never changes, and
-- it is changing here: rows already written carry a midnight anchor and would stop matching,
-- silently refunding real usage. Lease charges are committed at admission, so the segment's
-- own `started_at` identifies its window exactly as well and is invariant to the definition.
-- Summing by `started_at` in [v_ws, v_we) is therefore identical for every row under a stable
-- definition, and correct across this one. `charged_window_start` is still WRITTEN (it stays
-- the audit record of the window in force at authorization); it is no longer the sum key.
--
-- KNOWN ONE-TIME SEAM (documented, bounded, accepted): the FREE Final Song Grace ledger keys
-- once-per-window on `unique(account_id, charged_window_start)`. Rows written under the
-- midnight anchor will not collide with the restored 04:00 anchor, so on the changeover day
-- an account that already used grace can receive one more. Bound: one grace, <= 90 seconds,
-- once, per account.
--
-- No refund or double-charge occurs. During the one-time transition from the midnight-based
-- window key to the canonical 04:00 America/Los_Angeles window key, an account that already
-- consumed Final Song Grace under the prior key may regain eligibility for one additional
-- grace admission whose shortfall is no more than 90 seconds.
--
-- This is NOT a bypass of authorization: every start still passes the whole begin_v2 gate --
-- trusted duration, union charge, the once-per-window NOT EXISTS under the account advisory
-- lock, and the unique index as the durable backstop. The seam exists solely because the
-- once-per-window rule is KEYED on the window, and this migration changes what "the window"
-- means exactly once. The rule itself is unchanged, and no historical grace-ledger row or
-- charged_window_start value is rewritten. See
-- docs/BUILD24_LIVE_PLAYBACK_CLOCK_FREE_BALANCE_TRUTH_V1.md section 4.
--
-- Forward-only: 20260803120000 / 20260804120000 / 20260805120000 are NOT edited. No schema
-- change, no backfill, no data migration. Rollback = re-run the two function bodies from
-- 20260803120000 (entitlement) and 20260805120000 (begin_v2).

-- ── A. ENTITLEMENT v2 — restore the 04:00 window and the three dropped fields ──
--
-- Field parity with v1 is deliberate: domain/usage.ts is the ONE projection both clients
-- render, and it reads activePlaybackCount / nextResetAt / warnLevel. A v2 read must therefore
-- answer the same questions a v1 read does, or the shared projection silently degrades.
create or replace function public.karaoke_free_minutes_entitlement_at_v2(p_account_id uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
  p record; v_tz text; v_ws timestamptz; v_we timestamptz; v_local timestamp; v_anchor date;
  v_new numeric := 0; v_legacy numeric := 0; v_used numeric; v_limit int; v_remaining int;
  v_plan text; v_plan_n int; v_active int := 0; v_warn text := 'none';
begin
  select * into p from public.karaoke_usage_policy where policy_key='default';
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=p_account_id and status='active';
  if not (v_plan_n=1 and v_plan in ('FREE','PRO')) then v_plan:='FREE'; end if;

  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz
    from public.karaoke_accounts where id=p_account_id;

  -- D3 — the CANONICAL FREE window: [reset_hour_local, +1 day) in the account timezone,
  -- identical to karaoke_free_minutes_entitlement_at (20260726120000). The `+1 day` interval
  -- (not `+24 hours`) is what keeps the window exactly one calendar day across both DST
  -- transitions. Computed for PRO too, so windowStart/nextResetAt are answerable on every plan.
  v_local  := p_as_of at time zone v_tz;
  v_anchor := date(v_local - make_interval(hours => p.reset_hour_local));
  v_ws := ((v_anchor::timestamp     + make_interval(hours => p.reset_hour_local))) at time zone v_tz;
  v_we := (((v_anchor+1)::timestamp + make_interval(hours => p.reset_hour_local))) at time zone v_tz;

  -- D1 — the count domain/usage.ts turns into `isPlaying`. Same predicate as v1: an OPEN
  -- segment whose request is still on stage in a live event. Under the lease model the charge
  -- is already committed, so this answers only "is a song on stage right now" — it is never
  -- an accrual signal and never affects remainingSeconds.
  select count(*) into v_active from public.karaoke_event_usage_segments s
    join public.karaoke_requests r on r.id=s.request_id
    join public.karaoke_events   e on e.id=s.event_id
   where s.account_id=p_account_id and s.ended_at is null and r.status='playing'
     and e.status not in ('ended','archived');

  if v_plan='PRO' then
    return jsonb_build_object('plan','PRO','unlimited',true,'enforcementEnabled',p.enforcement_enabled,
      'limitSeconds',null,'usedSeconds',0,'remainingSeconds',null,'activePlaybackCount',v_active,
      'asOf',p_as_of,'windowStart',v_ws,'windowEnd',v_we,'nextResetAt',v_we,'timezone',v_tz,
      'warnLevel','none','model','lease_v2');
  end if;

  -- NEW rows: charge = lease_seconds, attributed by the segment's own start instant. See the
  -- ATTRIBUTION CHANGE note above — equivalent to the previous charged_window_start equality
  -- under a stable window definition, and correct across the D3 restoration.
  select coalesce(sum(lease_seconds), 0) into v_new
    from public.karaoke_event_usage_segments
   where account_id=p_account_id and metered and lease_seconds is not null
     and started_at >= v_ws and started_at < v_we;

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

  -- D2/parity — the RPC-computed warning level. domain/usage.ts re-resolves bannerKind from
  -- remainingSeconds, so this does not change any client decision today; it is restored so a
  -- v2 read is not a lossy answer and the thresholds stay policy-driven in one place.
  if p.enforcement_enabled then
    v_warn := case when v_remaining<=0 then 'zero'
                   when v_remaining<=p.warning_second_seconds then 'two_min'
                   when v_remaining<=p.warning_first_seconds then 'five_min' else 'none' end;
  end if;

  return jsonb_build_object('plan','FREE','unlimited',false,'enforcementEnabled',p.enforcement_enabled,
    'limitSeconds',v_limit,'usedSeconds',floor(v_used)::int,'remainingSeconds',v_remaining,
    'activePlaybackCount',v_active,'asOf',p_as_of,'windowStart',v_ws,'windowEnd',v_we,
    'nextResetAt',v_we,'timezone',v_tz,'warnLevel',v_warn,'model','lease_v2');
end; $$;
revoke all on function public.karaoke_free_minutes_entitlement_at_v2(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_free_minutes_entitlement_at_v2(uuid, timestamptz) to service_role;

-- ── B. BEGIN v2 — byte-identical to 20260805120000 except the charged-window anchor ──
--
-- The window written into karaoke_event_usage_segments / karaoke_free_final_song_grace must
-- be the SAME window the entitlement function bills against, or the grace ledger's
-- once-per-window key drifts from the balance it guards. Only v_ws/v_we change here; every
-- admission decision, lock order, gate, and returned field is unchanged.
create or replace function public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_status text; v_event uuid; v_ready timestamptz; v_req_room uuid;
  v_ev_room uuid; v_ev_status text; v_first uuid; v_plan text; v_plan_n int; v_enf boolean; v_tz text; v_upd int; v_ent jsonb;
  v_video text; v_dur int; v_cur_end timestamptz; v_active timestamptz; v_song_end timestamptz; v_new_end timestamptz; v_charge int; v_remaining int;
  v_ws timestamptz; v_we timestamptz; v_reset_hour int; v_local timestamp; v_anchor date;
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
  select coalesce((select reset_hour_local from public.karaoke_usage_policy where policy_key='default'), 4) into v_reset_hour;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz from public.karaoke_accounts where id=v_account;
  -- D3 — charged window @ authorization, on the CANONICAL reset_hour_local anchor (was
  -- date_trunc('day') = local midnight). Must match karaoke_free_minutes_entitlement_at_v2.
  v_local  := v_now at time zone v_tz;
  v_anchor := date(v_local - make_interval(hours => v_reset_hour));
  v_ws := ((v_anchor::timestamp     + make_interval(hours => v_reset_hour))) at time zone v_tz;
  v_we := (((v_anchor+1)::timestamp + make_interval(hours => v_reset_hour))) at time zone v_tz;

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

-- ── C. ACCOUNT-LEVEL ACTIVE LEASE END (read-only; BUILD 24 D5) ──
--
-- The Host clients learned `leaseEndsAt` ONLY from a start response and never re-read it, so
-- the honest "외부 재생 시간 차감 중" note vanished on foreground / relaunch / a second device
-- while the lease was still open. This is the canonical poll-time read of the same value
-- begin_v2 computes its union against: the MAX lease end across ALL the account's rooms.
-- Null when no lease is currently open. Never mutates, never opens a segment.
create or replace function public.karaoke_active_lease_ends_at(p_account_id uuid, p_as_of timestamptz)
returns timestamptz language sql stable set search_path = public, pg_temp as $$
  select max(lease_ends_at) from public.karaoke_event_usage_segments
   where account_id = p_account_id and lease_ends_at is not null and lease_ends_at > p_as_of;
$$;
revoke all on function public.karaoke_active_lease_ends_at(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_active_lease_ends_at(uuid, timestamptz) to service_role;

-- ── D. ROOM PLAYBACK AUTHORITY (read-only; the anchor every client clock projects from) ──
--
-- Everything a client needs to render a TRUTHFUL live song clock, resolved server-side in ONE
-- round trip so the four values cannot be stitched together from four differently-timed reads:
--
--   serverNow         the server's own clock, so a client never anchors on its device clock
--   requestId         the canonical song on stage (a change RESETS the client's clock)
--   startedAt         when the server flipped it to 'playing'
--   durationSeconds   the TRUSTED duration — preferentially the exact `v_dur` the admission gate
--                     compared (stored on the segment), falling back to the durable cache. Null
--                     when unresolved, and null MUST render as an honest unknown, never 0:00.
--   leaseEndsAt       the account-level external-playback window (D5). Published on EVERY poll,
--                     not just a start response, because a lease is non-shrinkable and therefore
--                     outlives Finish, foreground/relaunch, and a second device.
--
-- Read-only: no lifecycle mutation, no segment, no lease, no pass. Ambiguous room ownership
-- yields a null lease rather than a guess, exactly like every other account-scoped read.
create or replace function public.karaoke_room_playback_authority(p_room_id uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare v_account uuid; v_req uuid; v_started timestamptz; v_video text; v_dur int; v_lease timestamptz;
begin
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is not null then
    v_lease := public.karaoke_active_lease_ends_at(v_account, p_as_of);
  end if;

  select r.id, r.started_at, r.youtube_video_id into v_req, v_started, v_video
    from public.karaoke_requests r
    join public.karaoke_events e on e.id = r.event_id
   where r.room_id = p_room_id and r.status = 'playing' and e.status = 'active'
   limit 1;

  if v_req is not null then
    -- The segment's duration is what the admission gate ACTUALLY used for this start; the cache
    -- is the fallback for rows written before the lease path (or if the segment is gone).
    select coalesce(
             (select s.duration_seconds from public.karaoke_event_usage_segments s where s.request_id = v_req),
             (select d.duration_seconds from public.karaoke_video_durations d where d.video_id = v_video))
      into v_dur;
    if v_dur is not null and (v_dur < 1 or v_dur > 900) then v_dur := null; end if;   -- fail honest
  end if;

  return jsonb_build_object(
    'serverNow', p_as_of,
    'requestId', v_req,
    'startedAt', v_started,
    'durationSeconds', v_dur,
    'leaseEndsAt', v_lease);
end; $$;
revoke all on function public.karaoke_room_playback_authority(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_room_playback_authority(uuid, timestamptz) to service_role;
