-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — BUILD 26M: TIMED PASS CONTINUATION / SWITCHING V1 (Model B).
--
-- Lets a Host who owns another usable pass CONTINUE when the currently ACTIVE pass cannot
-- cover the next song, instead of being told to "pick a shorter one" while valid passes sit
-- unusable. Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj). Additive +
-- idempotent + forward-only; no prior migration is rewritten and no existing row is deleted.
--
-- THE DEFECT THIS CLOSES (Founder, physical device). ACTIVE 1-hour pass with 2m01s left, a
-- 3m46s song queued, and further unused 1-hour passes owned. Two independent causes:
--   1. the native ACTIVE card rendered only a countdown and never offered the alternatives, and
--   2. karaoke_begin_song_v2 resolves the ACTIVE pass and only falls through to SELECTED when
--      no unexpired ACTIVE pass exists -- so even selecting another pass changed NOTHING.
-- This migration fixes (2)'s consequence WITHOUT touching begin_song_v2: rather than teaching
-- the resolver to prefer a different pass, the switch makes the old pass genuinely non-ACTIVE,
-- so the resolver's EXISTING precedence then finds the SELECTED one on its own.
--
-- MODEL B, AS RATIFIED. A -> REVOKED (revoke_reason 'switched_pass'), B -> SELECTED.
--   * B is NOT activated here. Selection never starts a clock; B's hour begins only when a real
--     waiting->playing transition commits in karaoke_begin_song_v2, exactly as before. Starting
--     the clock on a dropdown tap would silently spend an hour the Host never used.
--   * The one-ACTIVE-per-account invariant is untouched and is never briefly violated: A leaves
--     ACTIVE in the same statement list that marks B SELECTED, and B is not ACTIVE at all.
--   * Residual time on A is FORFEIT (ratified Option 1). It is not banked, paused, transferred,
--     or combined -- timed_pass_expiry_math_chk pins expires_at = activated_at + duration, so a
--     partially-consumed pass is not representable and banking is a different accounting model.
--   * A's activation facts are RETAINED, never rewritten: activated_at and expires_at stay, and
--     only revoked_at/revoke_reason are added. The BUILD 26E relaxation of
--     timed_pass_status_time_chk is what makes this revoked-after-use shape legal; it was built
--     for Apple refund-after-use and this is the same shape, so nothing needed relaxing again.
--
-- SOURCE-NEUTRAL BY CONSTRUCTION. Eligibility keys off canonical pass STATE only. There is no
-- source_type predicate anywhere below, so a BUILD 26L PAID grant travels the identical state
-- machine as a MANUAL_PROMOTIONAL one. (Whether forfeiting residual on a PAID pass is the final
-- customer policy is a separate commerce ruling; all catalog products remain is_active=false.)
--
-- ATOMICITY. One plpgsql function body is one transaction, so "A terminated but B not selected"
-- is unreachable -- the pair commits together or not at all. Concurrency is serialized by the
-- SAME per-account advisory lock the issue/select/begin-song paths already take, so a switch
-- can never interleave with a song start.
--
-- ROLLBACK: additive. drop function public.switch_timed_access_pass(uuid, uuid, text);
-- drop function public.karaoke_timed_pass_switch_candidates(uuid); No table, column, index or
-- constraint is changed by this migration.

-- ── 1. SWITCH RPC (Host) ─────────────────────────────────────────────────────
create or replace function public.switch_timed_access_pass(
  p_account_id      uuid,
  p_pass_grant_id   uuid,
  p_idempotency_key text default null
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_key       text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_target    public.timed_access_pass_grants%rowtype;
  v_active    public.timed_access_pass_grants%rowtype;
  v_prev      public.timed_access_pass_grants%rowtype;
  v_now       timestamptz := clock_timestamp();
  v_forfeited int := null;
  v_from      uuid := null;
  v_upd       int;
begin
  -- The SAME lock key the pass lifecycle already uses, so a switch and a song start can never
  -- interleave: whichever gets the lock completes before the other observes any state.
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || p_account_id::text));

  select * into v_target
    from public.timed_access_pass_grants
   where id = p_pass_grant_id and account_id = p_account_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pass_not_found');
  end if;

  -- Replay: the target is already the armed pass. Report the settled state and write nothing.
  -- This is also what a double-tap and a retried request land on.
  if v_target.status = 'SELECTED' then
    return jsonb_build_object('ok', true, 'passGrantId', v_target.id, 'status', 'SELECTED',
                              'changed', false, 'switchedFromPassId', null, 'forfeitedSeconds', null);
  end if;
  -- EXPIRED / REVOKED / ACTIVE targets are never switchable. A stale client holding an id that
  -- has since been consumed lands here rather than double-spending it.
  if v_target.status <> 'AVAILABLE' then
    return jsonb_build_object('ok', false, 'error', 'not_switchable', 'status', v_target.status);
  end if;

  -- Lazy expiry, matching karaoke_begin_song_v2: an ACTIVE pass already past its window is
  -- EXPIRED, not something to "revoke". Recording it as REVOKED would libel a pass that simply
  -- ran out, and would make the forfeited-seconds figure a lie.
  with exp as (
    update public.timed_access_pass_grants
       set status = 'EXPIRED', expired_at = v_now, updated_at = now()
     where account_id = p_account_id and status = 'ACTIVE' and expires_at <= v_now
     returning id)
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, action, from_status, to_status)
  select id, p_account_id, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED' from exp;

  -- The still-valid ACTIVE pass being switched away from, if there is one. When there is none
  -- this degenerates to an ordinary arm, which is the correct no-op-ish behaviour rather than
  -- an error the client would have to special-case.
  select * into v_active
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'ACTIVE' and expires_at > v_now
   for update limit 1;

  if found then
    v_from := v_active.id;
    v_forfeited := greatest(0, floor(extract(epoch from (v_active.expires_at - v_now)))::int);

    -- FORFEIT. activated_at / expires_at are deliberately NOT cleared: the pass really did run,
    -- and the honest record of when is what makes later accounting and support answerable.
    update public.timed_access_pass_grants
       set status = 'REVOKED', revoked_at = v_now, revoke_reason = 'switched_pass', updated_at = now()
     where id = v_active.id and status = 'ACTIVE';
    get diagnostics v_upd = row_count;
    if v_upd <> 1 then
      -- Lost a race for this row despite the lock: refuse rather than continue and risk
      -- terminating nothing while arming something.
      return jsonb_build_object('ok', false, 'error', 'switch_conflict');
    end if;

    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_active.id, p_account_id, 'HOST', 'host_switch', 'REVOKED', 'ACTIVE', 'REVOKED',
            v_key, 'switched_pass',
            jsonb_build_object('switchedToPassId', p_pass_grant_id, 'forfeitedSeconds', v_forfeited));
  end if;

  -- Any OTHER armed pass reverts, mirroring select_timed_access_pass, so the one-SELECTED
  -- invariant holds without relying on the index to raise.
  for v_prev in
    select * from public.timed_access_pass_grants
     where account_id = p_account_id and status = 'SELECTED' and id <> p_pass_grant_id for update
  loop
    update public.timed_access_pass_grants
       set status = 'AVAILABLE', selected_at = null, updated_at = now() where id = v_prev.id;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status, idempotency_key)
    values (v_prev.id, p_account_id, 'HOST', 'DESELECTED', 'SELECTED', 'AVAILABLE', v_key);
  end loop;

  -- ARM ONLY. Note what is absent: no activated_at, no expires_at, no status 'ACTIVE'.
  update public.timed_access_pass_grants
     set status = 'SELECTED', selected_at = v_now, updated_at = now()
   where id = p_pass_grant_id and status = 'AVAILABLE';
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then
    return jsonb_build_object('ok', false, 'error', 'switch_conflict');
  end if;

  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
     idempotency_key, reason, metadata)
  values (p_pass_grant_id, p_account_id, 'HOST', 'host_switch', 'SELECTED', 'AVAILABLE', 'SELECTED',
          v_key, case when v_from is null then null else 'switched_pass' end,
          jsonb_build_object('switchedFromPassId', v_from, 'forfeitedSeconds', v_forfeited));

  return jsonb_build_object('ok', true, 'passGrantId', p_pass_grant_id, 'status', 'SELECTED',
                            'changed', true, 'switchedFromPassId', v_from,
                            'forfeitedSeconds', v_forfeited);
end;
$$;
revoke all on function public.switch_timed_access_pass(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.switch_timed_access_pass(uuid, uuid, text) to service_role;

-- ── 2. SWITCH-CANDIDATE COUNT (read-only) ────────────────────────────────────
-- How many passes the Host could switch to right now. Used ONLY to choose which sentence the
-- insufficient-pass notice shows ("pick a shorter one" vs "use another pass"). It is advisory
-- presentation routing and decides no admission: the switch itself re-validates under the lock,
-- and karaoke_begin_song_v2 still independently refuses any pass that cannot cover the song.
--
-- Deliberately NO source_type predicate: a PAID grant counts exactly like a promotional one.
create or replace function public.karaoke_timed_pass_switch_candidates(p_account_id uuid)
returns int language sql stable set search_path = public, pg_temp as $$
  select count(*)::int
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'AVAILABLE';
$$;
revoke all on function public.karaoke_timed_pass_switch_candidates(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_timed_pass_switch_candidates(uuid) to service_role;
