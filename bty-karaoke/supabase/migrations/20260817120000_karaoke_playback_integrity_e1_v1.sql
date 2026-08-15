-- BUILD 26T-R1B-R6-R1A — E1: unmetered YouTube playback (App Store 1.0).
--
-- WHY. A paid pass was metered in seconds of YouTube video, colliding with YouTube Developer
-- Policies III.F.3 / III.G.1 (26T-R1B-R5-R4). R6 contained the PAID half at the binary (build
-- 104). This removes the remaining half: the FREE meter was the same duration-based authorization
-- minus the money. Founder decision E1 retires playback metering entirely for 1.0.
--
-- THE RECORD SHAPE, and why it needs no schema change. A successful 1.0 start writes
-- `metered = false` with ALL FIVE columns governed by usage_seg_lease_consistency NULL together.
-- That is the constraint's EXISTING back-compat arm: BUILD 20M added those columns "nullable ->
-- back-compat", so all-five-NULL already means "a started song carrying no lease semantics".
-- The §A reader audit proved no reader treats it as not-started, corrupt or incomplete.
-- usage_seg_lease_consistency is NOT amended and its `duration_seconds <= 900` bound remains an
-- invariant over METERED rows — BUILD 20M's historical protection is preserved, not weakened.
--
-- WHAT DOES NOT CHANGE. Every security/structure refusal is preserved byte-for-byte: invalid_mode,
-- room_retired, ownership_state_invalid, not_found, not_waiting, event_state_invalid,
-- already_playing, not_next, not_ready, request_state_changed. Advisory locks, the row-level FOR
-- UPDATE and the write order are untouched. No grant, pass, purchase, audit or historical segment
-- row is modified — playback no longer mutates grant state at all.
--
-- AUTHORED BY TRANSFORMING pg_get_functiondef output, not handwritten. The canonical pre-repair
-- md5 was re-verified as ef281fd84a6e59726d94c37af70aa509 immediately before this was generated,
-- and a production apply must re-verify that same md5 first (§L).
--
-- Edits applied to the canonical body:
--   * duration refusal + 900 ceiling removed
--   * lease computation removed (no lease minted)
--   * pass sweep + activation + both quota refusals removed
--   * segment written unmetered: metered=false + five NULLs
--   * grace ledger insert removed
--   * response reports an unmetered start

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

  -- BUILD 26T-R1B-R6-R1A (E1): duration is INFORMATIONAL. It is still read so the response can
  -- report it, but it authorizes nothing: neither the 900-second ceiling nor the
  -- unknown-duration refusal survives, because both were duration-caused refusals.
  select duration_seconds into v_dur from public.karaoke_video_durations where video_id = v_video;

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

  -- E1: NO LEASE IS COMPUTED OR MINTED. 1.0 playback carries no meter, so there is nothing to
  -- charge, extend or protect. BUILD 20M's non-shrinkable lease remains intact for the historical
  -- metered rows it was built for; it simply has no new rows to govern.

  -- E1 -- THE REPAIR, in one place.
  --
  -- Deleted: the pass_insufficient refusal (song end vs pass expiry, carrying the carryover
  -- comparison), the FREE upgrade_required refusal (charge vs remaining) and the grace branch that
  -- existed only to soften it. Nothing about the video's duration, the FREE remainder, a pass
  -- window, carryover or the account's plan can refuse a start any more.
  --
  -- Also deleted: the pass expiry SWEEP and the SELECTED-pass ACTIVATION. Playback must not mutate
  -- grant state at all. Activating a pass that confers no privilege would spend a customer's
  -- purchased window for nothing, and sweeping an expired grant would make playback rewrite grant
  -- history. Grants are left exactly as they were found.
  --
  -- What still refuses is entirely above this point: mode, room retirement, ownership, request and
  -- event identity/state, already-playing, and queue order.

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

  -- E1 -- THE UNMETERED RECORD. `metered=false` and ALL FIVE columns governed by
  -- usage_seg_lease_consistency are NULL together, which is that constraint's existing
  -- back-compat arm: BUILD 20M added them nullable for exactly this shape — a started song
  -- carrying no lease semantics. The CHECK is NOT amended; its `duration_seconds <= 900` bound
  -- stays an invariant over METERED rows, so the historical protection is untouched.
  --
  -- The duration is deliberately NOT written even though it is known: populating a metering
  -- structure for playback that is not metered would be a fabricated record.
  insert into public.karaoke_event_usage_segments
    (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot,
     pass_grant_id,metering_paused_by_pass, duration_seconds, lease_ends_at, lease_seconds,
     charged_window_start, charged_window_end)
  values (v_account, v_event, p_room_id, p_request_id, v_plan,
          false, v_now, v_tz,
          null, false,
          null, null, null,
          null, null)
  returning id into v_seg_id;

  -- E1: no grace is minted; the FREE window is not consumed by playback.

  -- E1: the response reports an UNMETERED start. Lease/charge/grace/pass fields are reported as
  -- null/false rather than omitted, so an older client reading them sees "nothing was metered"
  -- instead of a missing key it might interpret as a parse failure.
  return jsonb_build_object('outcome','ok','leaseEndsAt',null,
    'chargeSeconds',null,
    'finalSongGraceApplied', false,
    'finalSongGraceSeconds', null,
    'finalSongChargedSeconds', null,
    'remainingBeforeSeconds', null,
    'durationSeconds',v_dur,'chargedWindowStart',null,'passActivated',false,'passCovered',false,
    'passGrantId',null,'passExpiresAt',null,
    'metered', false,
    'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
end; $function$;
