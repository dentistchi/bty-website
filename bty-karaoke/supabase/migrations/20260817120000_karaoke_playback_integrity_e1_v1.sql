-- BUILD 26T-R1B-R6-R1A — E1: YouTube playback integrity.
--
-- WHY. BUILD 26T-R1B-R5-R4 measured that a paid pass was metered in seconds of YouTube video,
-- which collides with YouTube Developer Policies III.F.3 and III.G.1. R6 contained the PAID half
-- at the binary (build 104). This removes the remaining half: the FREE meter was the same
-- duration-based authorization minus the money, and Founder decision E1 retires it entirely.
--
-- WHAT CHANGES. karaoke_begin_song_v2 no longer refuses a structurally valid queued song because
-- of the video's duration, the FREE remainder, a pass window, carryover, MAX_LEASE_SECONDS, or
-- the account's plan. PRO confers no playback privilege because there is no privilege left to
-- confer. A SELECTED pass is no longer activated by playback.
--
-- WHAT DOES NOT CHANGE. Every security/structure refusal is preserved byte-for-byte: invalid
-- mode, retired room, ownership_state_invalid, not_found, not_waiting, event_state_invalid,
-- already_playing, not_next, not_ready, request_state_changed. Advisory locks, the row-level
-- FOR UPDATE, and the write order are untouched. Lease, usage-segment, grant, audit and ledger
-- rows are preserved — historical records stay, they simply stop gating playback.
--
-- AUTHORED FROM THE CANONICAL DEFINITION, not from memory: the pre-repair
-- pg_get_functiondef md5 was verified as ef281fd84a6e59726d94c37af70aa509 before this was
-- written, and a production apply must re-verify that same md5 first (BUILD 26T-R1B-R6-R1A §H).
--
-- Edits applied to the canonical body:
--   * duration gate removed (incl. >900)
--   * lease arithmetic NULL-safe
--   * SELECTED pass no longer activates
--   * pass_insufficient + upgrade_required refusals deleted

create or replace function public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_account uuid; v_now timestamptz; v_status text; v_event uuid; v_ready timestamptz; v_req_room uuid;
  v_ev_room uuid; v_ev_status text; v_first uuid; v_plan text; v_plan_n int; v_enf boolean; v_tz text; v_upd int; v_ent jsonb;
  v_video text; v_dur int; v_cur_end timestamptz; v_active timestamptz; v_song_end timestamptz; v_new_end timestamptz; v_charge int; v_remaining int;
  v_ws timestamptz; v_we timestamptz; v_reset_hour int; v_local timestamp; v_anchor date;
  v_active_pass uuid; v_active_expires timestamptz; v_sel_pass uuid; v_sel_dur int; v_sel_carry int; v_pass_grant uuid;
  v_pass_covered boolean := false; v_activate boolean := false; v_upd2 int; v_pass_expires timestamptz;
  v_grace boolean := false; v_grace_secs int; v_charged int; v_shortfall int; v_seg_id uuid;
  v_room_status text;
begin
  if p_mode not in ('guest','promote') then return jsonb_build_object('outcome','invalid_mode'); end if;

  -- (a) BUILD 26E / F-1: a retired room answers explicitly and terminally.
  select status into v_room_status from public.karaoke_rooms where id = p_room_id;
  if v_room_status = 'retired' then return jsonb_build_object('outcome','room_retired'); end if;

  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account));
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_now := clock_timestamp();
  select r.status, r.event_id, r.ready_at, r.room_id, r.youtube_video_id
    into v_status, v_event, v_ready, v_req_room, v_video
    from public.karaoke_requests r where r.id=p_request_id and r.room_id=p_room_id for update;
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

  -- BUILD 26T-R1B-R6-R1A (E1): duration is a RECORD, never an authority.
  -- The 900-second ceiling and the unknown-duration refusal were BOTH duration-caused refusals,
  -- and both are removed: a video's length can no longer decide whether it may be sung.
  -- v_dur may now be NULL (unpriceable) and every use of it below is NULL-safe.
  select duration_seconds into v_dur from public.karaoke_video_durations where video_id = v_video;
  if v_dur is not null and v_dur < 1 then v_dur := null; end if;

  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=v_account and status='active';
  if not (v_plan_n=1 and v_plan in ('FREE','PRO')) then v_plan:='FREE'; end if;
  select coalesce((select enforcement_enabled from public.karaoke_usage_policy where policy_key='default'), false) into v_enf;
  select coalesce((select reset_hour_local from public.karaoke_usage_policy where policy_key='default'), 4) into v_reset_hour;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz from public.karaoke_accounts where id=v_account;
  v_local  := v_now at time zone v_tz;
  v_anchor := date(v_local - make_interval(hours => v_reset_hour));
  v_ws := ((v_anchor::timestamp     + make_interval(hours => v_reset_hour))) at time zone v_tz;
  v_we := (((v_anchor+1)::timestamp + make_interval(hours => v_reset_hour))) at time zone v_tz;

  select max(lease_ends_at) into v_cur_end from public.karaoke_event_usage_segments
    where account_id=v_account and lease_ends_at is not null and lease_ends_at > v_now;
  v_active   := greatest(coalesce(v_cur_end, v_now), v_now);
  v_song_end := v_now + make_interval(secs => coalesce(v_dur, 0));   -- E1: NULL-safe
  v_new_end  := greatest(v_active, v_song_end);
  v_charge   := ceil(extract(epoch from (v_new_end - v_active)))::int;

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
    -- BUILD 26T-R1B-R6-R1A (E1): a SELECTED pass is NO LONGER ACTIVATED by playback.
    -- After E1 a pass confers no playback privilege, so starting its paid window when a song
    -- begins would spend a customer's purchased time for nothing. The grant stays SELECTED,
    -- untouched, and remains available for a future compliant paid product.
    -- The ACTIVE-pass sweep above is retained: expiring an already-expired grant is truthful
    -- housekeeping, not an authority decision.
    end if;
  end if;

  -- BUILD 26T-R1B-R6-R1A (E1) -- THE REPAIR.
  --
  -- Removed here, in one place: the pass_insufficient refusal (song end vs pass expiry, which
  -- also carried the carryover comparison) and the FREE upgrade_required refusal (charge vs
  -- remaining) together with the grace branch that existed only to soften it.
  --
  -- Nothing about the selected YouTube song's DURATION, the account's FREE remainder, its pass
  -- window, its carryover or its plan can refuse a start any more. What still refuses is above:
  -- mode, room retirement, ownership, request/event identity and state, already-playing, and
  -- queue order.
  --
  -- v_grace therefore stays false and the grace ledger insert below never fires; the lease and
  -- usage segment are still written, as RECORDS of what was played rather than as a gate.

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
          v_dur, v_new_end, (case when v_pass_covered then 0 when v_grace then v_charged else v_charge end),
          v_ws, v_we)
  returning id into v_seg_id;

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
end; $function$;
