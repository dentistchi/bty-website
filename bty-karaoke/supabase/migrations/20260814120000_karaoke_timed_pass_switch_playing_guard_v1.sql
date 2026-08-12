-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — BUILD 26M-R3: NO PASS SWITCHING WHILE A SONG IS PLAYING.
--
-- CLOSES A REACHABLE ENTITLEMENT GAP found on a physical device during the R2 gates.
--
--   song PLAYING on the ACTIVE pass
--   -> Host switches
--   -> ACTIVE pass REVOKED, its ENTIRE residual transferred to the next pass
--   -> ACTIVE count = 0, and the song keeps playing
--   => every remaining second of that song consumed NO entitlement
--
-- The carryover accounting was correct at every step; what was wrong was permitting the switch
-- at all while playback was in flight. The residual is transferred in full to a pass that has
-- not started, so the music that continues is covered by nothing.
--
-- Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent +
-- forward-only. No table, column, index or constraint is changed; only the switch RPC is
-- redefined. Carryover behaviour is UNCHANGED whenever no song is playing.
--
-- WHY THE GUARD LIVES IN THE RPC, NOT THE ROUTE OR THE CLIENT. A UI that hides the control stops
-- an honest Host, not a stale one: a client holding a screen rendered before playback began, a
-- retried request, or a second device would all still reach the endpoint. Only a check inside the
-- same transaction that performs the revoke can refuse authoritatively.
--
-- WHY IT ALSO TAKES THE ACCOUNT LOCK. The pre-existing timed_pass advisory key does NOT exclude
-- karaoke_begin_song_v2, which locks on karaoke_account_lock_key. Checking for a playing song
-- under only the timed_pass key would leave a window in which a start COMMITS between the check
-- and the revoke -- reopening the exact gap being closed. The switch now takes the account key
-- first, making it and a song start mutually exclusive. Nothing takes timed_pass before account,
-- so no lock cycle is introduced.
--
-- SCOPE, deliberately narrow: select_timed_access_pass is NOT guarded. Arming a different pass
-- while a song plays leaves the ACTIVE pass ACTIVE and creates no gap -- the playback stays
-- covered -- so forbidding it would remove a harmless capability for no safety gain.
--
-- ROLLBACK: restore the switch_timed_access_pass body from 20260813120000.

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
  v_playing  uuid;
begin
  -- BUILD 26M-R3 — TWO locks, account key FIRST.
  --
  -- The timed_pass key alone does NOT exclude karaoke_begin_song_v2, which locks on
  -- karaoke_account_lock_key. Without this a song could COMMIT its start in the instant between
  -- this function's playing check and its revoke, reopening the very entitlement gap the check
  -- exists to close. Taking the account key makes switch and start mutually exclusive.
  --
  -- Ordering is deliberate: begin_song_v2 takes account -> room, and this takes account ->
  -- timed_pass. Both acquire the account key first and nothing anywhere takes timed_pass before
  -- account, so no lock cycle exists.
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(p_account_id));
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

  -- ── BUILD 26M-R3: NO SWITCHING WHILE A SONG IS PLAYING ──────────────────────
  --
  -- THE DEFECT THIS CLOSES, found on a physical device. A song was playing on the ACTIVE pass;
  -- switching revoked that pass and moved its whole residual to the next one. The account was
  -- left with ACTIVE = 0 while the song kept playing, so every second of the rest of that song
  -- consumed NO entitlement -- the residual had already been transferred away in full. The
  -- carryover accounting was correct; permitting the switch mid-song was not.
  --
  -- This runs BEFORE any write, so a refusal mutates nothing: the ACTIVE pass stays ACTIVE, no
  -- carry is created, and no switched_pass audit row is written. Ownership is resolved through
  -- karaoke_room_owner_account, the same canonical authority every other path uses, rather than
  -- a second hand-rolled join that could drift from it.
  select r.id into v_playing
    from public.karaoke_requests r
   where r.status = 'playing'
     and public.karaoke_room_owner_account(r.room_id) = p_account_id
   limit 1;
  if v_playing is not null then
    return jsonb_build_object('ok', false, 'error', 'song_playing', 'requestId', v_playing);
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
