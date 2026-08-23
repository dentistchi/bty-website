-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4A · CONTROLLED ROLLOUT PARTICIPATION — exactly ONE (account, room) pair.
-- Sorts after 20260824120000_karaoke_premium_room_dual_allowlist_v1.sql.
-- ADDITIVE + IDEMPOTENT. Independently reversible (see §D).
--
-- WHAT THIS DOES, and its entire effect: it adds one row saying that ONE room takes part in the
-- controlled Premium rollout. It grants nothing. It does not issue, activate, extend or imply a
-- pass, and it does not move money. Under `premium_room_mode = legacy_free` — production's
-- current value — it changes nothing at all for anyone.
--
-- THE PAIR IS THE POINT. The chosen room's owner ALSO owns `bty-home`, a live room in daily use.
-- That is deliberate: it makes the account+room scoping provable rather than assumed. After this
-- row exists and the mode moves to `dual_allowlist`, `bty-home` must still resolve `legacy`.
--
-- WHY A MIGRATION. `karaoke_premium_room_rollout` grants writes to service_role only, and
-- participation is an operational decision with a blast radius — so it arrives reviewed, in
-- order, and with its preconditions asserted, exactly as the catalog contract does.
-- ============================================================================

-- ── A. THE PRECONDITION CENSUS — fail closed if reality differs ──
--
-- Every assertion below describes what was MEASURED before this file was written. If any has
-- changed, the room is not the room this migration was reviewed for, and adding it would widen
-- the blast radius past what was approved. So it raises instead of guessing.
do $$
declare
  v_room  uuid := 'b28fc301-75e8-4f23-910f-37f6013f5b80';   -- free-multi-room-test-4-1juouloj
  v_acct  uuid := '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c';   -- the room's canonical owner
  v_owner uuid;
  v_status text;
  v_live  int;
  v_reqs  int;
  v_rows  int;
begin
  -- 1. the room exists and is open
  select status into v_status from public.karaoke_rooms where id = v_room;
  if v_status is null then
    raise exception 'R4A precondition: room % does not exist', v_room;
  end if;
  if v_status <> 'open' then
    raise exception 'R4A precondition: room % is % (expected open)', v_room, v_status;
  end if;

  -- 2. the account is the room's CANONICAL owner. This is the same resolver the enforcement
  --    reader uses, so a pair that would not resolve at runtime cannot be inserted here.
  v_owner := public.karaoke_room_owner_account(v_room);
  if v_owner is distinct from v_acct then
    raise exception 'R4A precondition: room % resolves owner %, expected %', v_room, v_owner, v_acct;
  end if;

  -- 3. the room has NO live Event. A room already hosting a session must never be the one a
  --    controlled validation is switched on for — that is the whole hazard R4A exists to avoid.
  select count(*) into v_live from public.karaoke_events
   where room_id = v_room and status in ('draft','active');
  if v_live <> 0 then
    raise exception 'R4A precondition: room % has % live Event(s), expected 0', v_room, v_live;
  end if;

  -- 4. and it has never carried a request, so no real user depends on it.
  select count(*) into v_reqs from public.karaoke_requests where room_id = v_room;
  if v_reqs <> 0 then
    raise exception 'R4A precondition: room % has % request(s), expected 0', v_room, v_reqs;
  end if;

  -- 5. the allowlist is empty. R4A adds the FIRST and ONLY pair; if others already exist, the
  --    blast radius was never measured for them.
  select count(*) into v_rows from public.karaoke_premium_room_rollout;
  if v_rows <> 0 then
    raise exception 'R4A precondition: allowlist already holds % row(s), expected 0', v_rows;
  end if;

  -- ── B. THE ONE ROW ──
  insert into public.karaoke_premium_room_rollout (account_id, room_id, note)
  values (v_acct, v_room, 'BUILD 26U-R4A controlled Premium Room validation')
  on conflict (account_id, room_id) do nothing;   -- idempotent re-apply
end $$;

-- ── C. POST-CONDITION — exactly one pair, and it is the expected one ──
do $$
declare v_n int; v_room uuid; v_acct uuid;
begin
  select count(*) into v_n from public.karaoke_premium_room_rollout;
  if v_n <> 1 then
    raise exception 'R4A postcondition: allowlist holds % row(s), expected exactly 1', v_n;
  end if;
  select account_id, room_id into v_acct, v_room from public.karaoke_premium_room_rollout;
  if v_room <> 'b28fc301-75e8-4f23-910f-37f6013f5b80'
     or v_acct <> '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c' then
    raise exception 'R4A postcondition: unexpected pair %/%', v_acct, v_room;
  end if;
end $$;

-- ── D. REVERSAL ──
--
-- This migration is independently reversible with one statement, and reversing it cannot strand
-- anything: the row confers no entitlement, so removing it only returns the room to `legacy`.
-- Any grant purchased during the validation survives, because grants live in a different table
-- and settlement never consulted this one.
--
--   delete from public.karaoke_premium_room_rollout
--    where account_id = '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c'
--      and room_id    = 'b28fc301-75e8-4f23-910f-37f6013f5b80';
--
-- ── E. WHAT THIS FILE DOES NOT DO ──
--
-- No mode change (production stays legacy_free until a separate, deliberate step), no catalog
-- activation, no grant, no purchase, no change to any function. Its whole effect is one row in
-- one table, and that row means participation and nothing else.
