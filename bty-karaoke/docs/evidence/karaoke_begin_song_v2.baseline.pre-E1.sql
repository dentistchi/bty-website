CREATE OR REPLACE FUNCTION public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
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

  select duration_seconds into v_dur from public.karaoke_video_durations where video_id = v_video;
  if v_dur is null or v_dur < 1 or v_dur > 900 then
    return jsonb_build_object('outcome','duration_unavailable'); end if;

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
  v_song_end := v_now + make_interval(secs => v_dur);
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
    else
      select id, duration_seconds, carryover_seconds into v_sel_pass, v_sel_dur, v_sel_carry
        from public.timed_access_pass_grants
        where account_id=v_account and status='SELECTED' for update limit 1;
      if v_sel_pass is not null then
        v_pass_covered := true; v_activate := true; v_pass_grant := v_sel_pass;
        -- BUILD 26M-R2: base duration PLUS server-transferred carryover. This is the ONLY
        -- place a pass window is minted, and timed_pass_expiry_math_chk now requires exactly
        -- this sum -- so an activation path that ignored the carry would ABORT, not shorten it.
        v_pass_expires := v_now + make_interval(secs => v_sel_dur + coalesce(v_sel_carry, 0));
      end if;
    end if;
  end if;

  if v_pass_covered then
    if v_song_end > v_pass_expires then
      return jsonb_build_object('outcome','pass_insufficient','passExpiresAt',v_pass_expires,
        'durationSeconds',v_dur,
        'remainingSeconds', greatest(0, floor(extract(epoch from (v_pass_expires - v_now)))::int)); end if;
  elsif v_enf and v_plan='FREE' then
    v_ent := public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now);
    v_remaining := (v_ent->>'remainingSeconds')::int;
    if v_charge > v_remaining then
      v_shortfall := v_charge - v_remaining;
      -- (b) BUILD 26E / F-5: grace is once per window per PERSON, not per account row.
      -- The carryover clause makes delete-and-recreate unable to re-arm it.
      if v_remaining > 0 and v_shortfall <= 90 and not exists (
           select 1 from public.karaoke_free_final_song_grace g
            where g.account_id = v_account and g.charged_window_start = v_ws)
        and not exists (
           select 1 from public.karaoke_free_window_carryover c
            where c.account_id = v_account and c.charged_window_start = v_ws and c.grace_consumed)
      then
        v_grace := true;
        v_grace_secs := v_shortfall;
        v_charged := v_remaining;
      else
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
end; $function$

