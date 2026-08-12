-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — BUILD 26M-R2: TIMED PASS RESIDUAL CARRYOVER V1.
--
-- WITHDRAWS RESIDUAL FORFEITURE. BUILD 26M shipped the ratified Model B, where switching from
-- the running pass A to an owned pass B destroyed A's remaining time. Physical use rejected that
-- design: the implementation was correct, the product rule was wrong. Residual is now PRESERVED
-- and TRANSFERRED to B. Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj).
-- Additive + idempotent + forward-only; no prior migration is rewritten, no row is deleted, and
-- no existing timestamp is recomputed.
--
--   A remaining 187s + B base 3600s  ->  B's window is 3787s WHEN IT ACTUALLY STARTS.
--
-- WHY A NEW COLUMN AND NOT A BIGGER duration_seconds. timed_pass_duration_matches_type pins
-- duration_seconds to the product type (3600/14400/86400), so inflating it is both forbidden by
-- the constraint and forbidden by the ruling: the canonical product duration must stay canonical.
-- The transferred value therefore needs its own field, and the expiry-math CHECK has to learn
-- about it. Every existing row gets carryover_seconds = 0, so the repaired predicate is
-- arithmetically IDENTICAL to the deployed one for all 38 of them.
--
-- THE CHECK IS THE ENFORCEMENT, NOT A CONVENTION. Because expires_at must now equal
-- activated_at + duration_seconds + carryover_seconds, any activation path that ignores the carry
-- writes a row that VIOLATES the constraint and rolls back. That is why the currently unreachable
-- legacy karaoke_begin_song is deliberately NOT rewritten for symmetry: if a flag flip ever made
-- it reachable, it would fail LOUDLY on a carrying pass rather than silently shorten the window.
-- Fail-closed beats symmetry.
--
-- MOVE SEMANTICS, NEVER COPY. After any commit the live carry exists exactly ONCE. An AVAILABLE
-- pass may never hold carry at all (timed_pass_available_no_carry_chk), which makes a stranded or
-- duplicated economic value structurally hard to create rather than merely discouraged. The
-- transfer is therefore an ASSIGNMENT onto a target proven to hold zero -- there is deliberately
-- no `target.carryover += source` accumulation rule anywhere below.
--
-- WHAT IS TRANSFERRED, PER SOURCE STATE:
--   * from an ACTIVE pass:   max(0, expires_at - server now). Its expires_at ALREADY embodies
--     base + any prior carry, so adding carryover_seconds again would double count.
--   * from an armed pass:    its carryover_seconds only. It never consumed its own product, so it
--     returns to AVAILABLE with its canonical base duration intact and its carry zeroed.
--   * A revoked/expired pass RETAINS its own carryover_seconds as inert history -- that figure is
--     part of the record of a window that really existed, not live value.
--
-- CONTRACT AMENDMENT (BUILD 18C section 5 SUPERSEDED). The old rule "expires_at = activated_at +
-- product duration, fixed forever, no extension" no longer holds. The new rule: the canonical
-- product duration stays fixed, while ONE grant's effective entitlement window may equal
-- base duration + server-authoritative transferred carryover. There is still exactly one
-- entitlement window covering any song, and there are never two ACTIVE passes contributing time
-- simultaneously -- the one-ACTIVE-per-account index is untouched.
--
-- The client never supplies a residual. Every figure below is computed server-side inside the
-- switch transaction, under the same per-account advisory lock the rest of the pass lifecycle
-- takes, with FOR UPDATE row locks and raise-not-return on any lost race.
--
-- ROLLBACK: additive. Restore the three function bodies from 20260809120000 / 20260812120000,
-- restore timed_pass_expiry_math_chk to the duration-only form, then drop
-- timed_pass_available_no_carry_chk and the carryover_seconds column.

-- ── 1. THE CARRYOVER FIELD ───────────────────────────────────────────────────
alter table public.timed_access_pass_grants
  add column if not exists carryover_seconds int not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'timed_pass_carryover_nonneg_chk') then
    alter table public.timed_access_pass_grants
      add constraint timed_pass_carryover_nonneg_chk check (carryover_seconds >= 0);
  end if;
  -- An AVAILABLE pass holds no live value. This is what makes the transfer a MOVE: the target of
  -- any transfer is provably empty beforehand, so a double credit cannot be expressed.
  if not exists (select 1 from pg_constraint where conname = 'timed_pass_available_no_carry_chk') then
    alter table public.timed_access_pass_grants
      add constraint timed_pass_available_no_carry_chk
      check (status <> 'AVAILABLE' or carryover_seconds = 0);
  end if;
end $$;

-- ── 2. EXPIRY MATH (repaired, non-destructively) ─────────────────────────────
-- Identical arithmetic for every row whose carryover is 0, which is every row that exists today.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'timed_pass_expiry_math_chk') then
    alter table public.timed_access_pass_grants drop constraint timed_pass_expiry_math_chk;
  end if;
  alter table public.timed_access_pass_grants
    add constraint timed_pass_expiry_math_chk check (
      expires_at is null or activated_at is null
      or expires_at = activated_at + make_interval(secs => duration_seconds + carryover_seconds)
    );
end $$;

-- ── 3. SWITCH RPC — now TRANSFERS the residual instead of destroying it ──────
create or replace function public.switch_timed_access_pass(
  p_account_id      uuid,
  p_pass_grant_id   uuid,
  p_idempotency_key text default null
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_key      text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_target   public.timed_access_pass_grants%rowtype;
  v_active   public.timed_access_pass_grants%rowtype;
  v_prev     public.timed_access_pass_grants%rowtype;
  v_now      timestamptz := clock_timestamp();
  v_carried  int := 0;
  v_from     uuid := null;
  v_armed    int := 0;
  v_upd      int;
begin
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || p_account_id::text));

  select * into v_target
    from public.timed_access_pass_grants
   where id = p_pass_grant_id and account_id = p_account_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pass_not_found');
  end if;

  -- Replay: already the armed pass. Writes nothing, so a retry cannot transfer twice.
  if v_target.status = 'SELECTED' then
    return jsonb_build_object('ok', true, 'passGrantId', v_target.id, 'status', 'SELECTED',
                              'changed', false, 'switchedFromPassId', null,
                              'carriedSeconds', v_target.carryover_seconds);
  end if;
  if v_target.status <> 'AVAILABLE' then
    return jsonb_build_object('ok', false, 'error', 'not_switchable', 'status', v_target.status);
  end if;

  -- Lazy expiry, matching karaoke_begin_song_v2. A pass that simply ran out is EXPIRED, not
  -- "switched away from" -- and it contributes NOTHING, because its remaining is already zero.
  with exp as (
    update public.timed_access_pass_grants
       set status = 'EXPIRED', expired_at = v_now, updated_at = now()
     where account_id = p_account_id and status = 'ACTIVE' and expires_at <= v_now
     returning id)
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, action, from_status, to_status)
  select id, p_account_id, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED' from exp;

  select * into v_active
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'ACTIVE' and expires_at > v_now
   for update limit 1;

  if found then
    v_from := v_active.id;
    -- ACTIVE source: expires_at ALREADY embodies base + any prior carry, so this is the whole
    -- remaining entitlement. Adding v_active.carryover_seconds here would double count it.
    v_carried := greatest(0, floor(extract(epoch from (v_active.expires_at - v_now)))::int);

    update public.timed_access_pass_grants
       set status = 'REVOKED', revoked_at = v_now, revoke_reason = 'switched_pass', updated_at = now()
     where id = v_active.id and status = 'ACTIVE';
    get diagnostics v_upd = row_count;
    if v_upd <> 1 then
      raise exception 'switch_conflict' using errcode = '40001';
    end if;

    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_active.id, p_account_id, 'HOST', 'host_switch', 'REVOKED', 'ACTIVE', 'REVOKED',
            v_key, 'switched_pass',
            jsonb_build_object('switchedToPassId', p_pass_grant_id, 'carriedSeconds', v_carried,
                               'sourceState', 'ACTIVE'));
  end if;

  -- Any other armed pass reverts and SURRENDERS its carry. Its own base duration does not move:
  -- it never consumed its product and returns to AVAILABLE whole.
  for v_prev in
    select * from public.timed_access_pass_grants
     where account_id = p_account_id and status = 'SELECTED' and id <> p_pass_grant_id for update
  loop
    v_armed := v_armed + 1;
    -- An ACTIVE source AND a carrying armed pass at once should be unreachable: arming through a
    -- switch leaves zero ACTIVE, and arming through select can only carry zero. Rather than
    -- silently pick one and strand the other's value, refuse -- a wrong sum here is money.
    if v_from is not null and v_prev.carryover_seconds > 0 then
      raise exception 'carry_source_ambiguous' using errcode = '40001';
    end if;
    if v_from is null then
      v_carried := v_prev.carryover_seconds;
    end if;
    update public.timed_access_pass_grants
       set status = 'AVAILABLE', selected_at = null, carryover_seconds = 0, updated_at = now()
     where id = v_prev.id;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status, idempotency_key, metadata)
    values (v_prev.id, p_account_id, 'HOST', 'DESELECTED', 'SELECTED', 'AVAILABLE', v_key,
            jsonb_build_object('surrenderedCarrySeconds', v_prev.carryover_seconds,
                               'movedToPassId', p_pass_grant_id));
  end loop;

  -- ARM + CREDIT. The target was proven AVAILABLE, and timed_pass_available_no_carry_chk proves
  -- it therefore held zero -- so this is an assignment onto an empty field, never an accumulation.
  update public.timed_access_pass_grants
     set status = 'SELECTED', selected_at = v_now, carryover_seconds = v_carried, updated_at = now()
   where id = p_pass_grant_id and status = 'AVAILABLE' and carryover_seconds = 0;
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then
    raise exception 'switch_conflict' using errcode = '40001';
  end if;

  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
     idempotency_key, reason, metadata)
  values (p_pass_grant_id, p_account_id, 'HOST', 'host_switch', 'SELECTED', 'AVAILABLE', 'SELECTED',
          v_key, case when v_from is null and v_carried = 0 then null else 'carryover_transfer' end,
          jsonb_build_object('switchedFromPassId', v_from, 'carriedSeconds', v_carried,
                             'baseDurationSeconds', v_target.duration_seconds,
                             'effectiveWindowSeconds', v_target.duration_seconds + v_carried));

  return jsonb_build_object('ok', true, 'passGrantId', p_pass_grant_id, 'status', 'SELECTED',
                            'changed', true, 'switchedFromPassId', v_from,
                            'carriedSeconds', v_carried,
                            'effectiveWindowSeconds', v_target.duration_seconds + v_carried);
end;
$$;
revoke all on function public.switch_timed_access_pass(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.switch_timed_access_pass(uuid, uuid, text) to service_role;

-- ── 4. SELECT RPC — H1: deselecting must MOVE the carry, never strand it ─────
-- Reachable in two taps from the armed card's "change" action, which calls select and not switch.
-- Without this the carried value would silently vanish through the ordinary selection path.
create or replace function public.select_timed_access_pass(
  p_account_id   uuid,
  p_pass_grant_id uuid,
  p_idempotency_key text default null
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_key     text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_grant   public.timed_access_pass_grants%rowtype;
  v_prev    public.timed_access_pass_grants%rowtype;
  v_carried int := 0;
  v_upd     int;
begin
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || p_account_id::text));

  select * into v_grant
    from public.timed_access_pass_grants
   where id = p_pass_grant_id and account_id = p_account_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pass_not_found');
  end if;

  if v_grant.status = 'SELECTED' then
    return jsonb_build_object('ok', true, 'passGrantId', v_grant.id, 'status', 'SELECTED',
                              'changed', false, 'carriedSeconds', v_grant.carryover_seconds);
  end if;
  if v_grant.status <> 'AVAILABLE' then
    return jsonb_build_object('ok', false, 'error', 'not_selectable', 'status', v_grant.status);
  end if;

  -- BUILD 26M-R2 (H1): the previously armed pass surrenders its carry, which MOVES to the newly
  -- armed one. Base duration does not move -- the reverted pass keeps its own product intact.
  for v_prev in
    select * from public.timed_access_pass_grants
     where account_id = p_account_id and status = 'SELECTED' and id <> p_pass_grant_id for update
  loop
    v_carried := v_prev.carryover_seconds;
    update public.timed_access_pass_grants
       set status = 'AVAILABLE', selected_at = null, carryover_seconds = 0, updated_at = now()
     where id = v_prev.id;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status, idempotency_key, metadata)
    values (v_prev.id, p_account_id, 'HOST', 'DESELECTED', 'SELECTED', 'AVAILABLE', v_key,
            jsonb_build_object('surrenderedCarrySeconds', v_prev.carryover_seconds,
                               'movedToPassId', p_pass_grant_id));
  end loop;

  update public.timed_access_pass_grants
     set status = 'SELECTED', selected_at = now(), carryover_seconds = v_carried, updated_at = now()
   where id = p_pass_grant_id and status = 'AVAILABLE' and carryover_seconds = 0;
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then
    raise exception 'select_conflict' using errcode = '40001';
  end if;

  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, action, from_status, to_status, idempotency_key, metadata)
  values (p_pass_grant_id, p_account_id, 'HOST', 'SELECTED', 'AVAILABLE', 'SELECTED', v_key,
          jsonb_build_object('carriedSeconds', v_carried));

  return jsonb_build_object('ok', true, 'passGrantId', p_pass_grant_id, 'status', 'SELECTED',
                            'changed', true, 'carriedSeconds', v_carried);
end;
$$;
revoke all on function public.select_timed_access_pass(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.select_timed_access_pass(uuid, uuid, text) to service_role;

-- ── 5. ACTIVATION — the window becomes base + carryover ──────────────────────
create or replace function public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
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
end; $$;
revoke all on function public.karaoke_begin_song_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_begin_song_v2(uuid, uuid, text) to service_role;

-- ── 6. STATE PROJECTION — the armed pass must promise its EFFECTIVE window ───
-- The UI must show a total, never make the Host add base + carry in their head. activePass
-- remainingSeconds already derives from expires_at, so it is total by construction once the
-- window includes the carry; the armed pass needs its carry published to say what it WILL be.
create or replace function public.karaoke_timed_pass_state_at(p_account_id uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_plan text; v_plan_n int; v_base text;
  v_active record; v_selected record;
  v_effective text; v_remaining int;
begin
  if p_as_of is null then return jsonb_build_object('outcome', 'invalid_as_of'); end if;
  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('outcome', 'account_not_found');
  end if;

  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id = p_account_id and status = 'active';
  v_base := case when v_plan_n = 1 and v_plan in ('FREE', 'PRO') then v_plan else 'FREE' end;

  select id, pass_type, duration_seconds, carryover_seconds, activated_at, expires_at
    into v_active
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'ACTIVE' and expires_at > p_as_of
   order by expires_at desc limit 1;

  select id, pass_type, duration_seconds, carryover_seconds, selected_at
    into v_selected
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'SELECTED'
   order by selected_at desc limit 1;

  if v_base = 'PRO' then
    v_effective := 'PRO';
  elsif v_active.id is not null then
    v_effective := 'TIMED_ACCESS';
  else
    v_effective := 'FREE';
  end if;

  v_remaining := case when v_active.id is not null
    then greatest(0, floor(extract(epoch from (v_active.expires_at - p_as_of)))::int) else null end;

  return jsonb_build_object(
    'outcome', 'ok',
    'asOf', p_as_of,
    'basePlan', v_base,
    'effectiveEntitlement', v_effective,
    'activePass', case when v_active.id is not null then jsonb_build_object(
      'id', v_active.id, 'passType', v_active.pass_type, 'durationSeconds', v_active.duration_seconds,
      'carryoverSeconds', v_active.carryover_seconds,
      'activatedAt', v_active.activated_at, 'expiresAt', v_active.expires_at, 'remainingSeconds', v_remaining
    ) else null end,
    'selectedPass', case when v_selected.id is not null then jsonb_build_object(
      'id', v_selected.id, 'passType', v_selected.pass_type,
      'durationSeconds', v_selected.duration_seconds,
      'carryoverSeconds', v_selected.carryover_seconds,
      -- What the Host will actually get when the next song starts. Published so no client ever
      -- has to add two numbers to tell a customer what they own.
      'effectiveWindowSeconds', v_selected.duration_seconds + v_selected.carryover_seconds,
      'selectedAt', v_selected.selected_at
    ) else null end
  );
end;
$$;
revoke all on function public.karaoke_timed_pass_state_at(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_timed_pass_state_at(uuid, timestamptz) to service_role;
