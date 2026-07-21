-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — CREATE FIRST ROOM V1. The self-service counterpart of
-- claim_karaoke_room: instead of adopting an already-provisioned Room, an
-- authenticated Host with ZERO owned Rooms creates their very first Room and the
-- ownership graph for it, atomically, in one transaction. Isolated bty-karaoke
-- Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent; never
-- rewrites or regresses any prior migration.
--
-- Why a NEW function rather than extending claim_karaoke_room: claiming operates on
-- an EXISTING Room row (verified by Manager passcode) and never inserts one. First-
-- room creation must also INSERT the Room, so the atomic unit is different (Room +
-- workspace + membership + ownership together). Keeping them separate keeps each
-- function's contract honest.
--
-- Guarantees (mapped to the slice's non-negotiable rules):
--   D. Atomicity     — Room + ownership (and workspace + membership when needed)
--                      are created in ONE transaction. A failure leaves nothing.
--   E. Event isolation — creates ZERO Events. There is no Event write anywhere here.
--   F. Duplicate protection — an advisory xact lock keyed on the ACCOUNT serializes
--      concurrent first-room submits, and the already-owns-a-Room check inside that
--      lock makes a second submit return the EXISTING Room instead of a duplicate.
--      Two near-simultaneous requests therefore yield exactly ONE Room.
--   Ownership integrity — the owner account is a function argument derived by the
--      server from the authenticated Host session; this function never trusts a
--      client-supplied owner (the route never forwards one).
--
-- Rollback:
--   drop function if exists public.create_karaoke_room(uuid, text, text, text, text);

create or replace function public.create_karaoke_room(
  p_account_id     uuid,
  p_slug           text,
  p_display_name   text,
  p_dj_secret      text,
  p_workspace_name text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_workspace_id  uuid;
  v_room_id       uuid;
  v_existing_id   uuid;
  v_existing_slug text;
begin
  -- Serialize concurrent first-room creates for THIS account (released at txn end).
  -- Two devices / a double tap therefore yield exactly one 'created'; the loser
  -- observes the ownership the winner wrote and returns it as 'has_room'.
  perform pg_advisory_xact_lock(hashtext('karaoke_first_room:' || p_account_id::text));

  -- Rule F: an account that already owns a Room must NOT create another through the
  -- first-room path. Return the already-owned Room so the caller enters it instead.
  select r.id, r.slug into v_existing_id, v_existing_slug
    from public.karaoke_workspace_members m
    join public.karaoke_room_ownership o on o.workspace_id = m.workspace_id
    join public.karaoke_rooms r on r.id = o.room_id
   where m.account_id = p_account_id and m.status = 'active'
   order by o.claimed_at asc
   limit 1;

  if v_existing_slug is not null then
    return jsonb_build_object('outcome', 'has_room', 'slug', v_existing_slug, 'roomId', v_existing_id);
  end if;

  -- Reuse an existing workspace this account already owns; otherwise create one.
  -- (A zero-Room account normally has no workspace yet, so this usually inserts.)
  select m.workspace_id into v_workspace_id
    from public.karaoke_workspace_members m
   where m.account_id = p_account_id and m.status = 'active'
   order by m.created_at asc
   limit 1;

  if v_workspace_id is null then
    insert into public.karaoke_workspaces (name, created_by)
    values (coalesce(nullif(btrim(p_workspace_name), ''), 'My Norebang'), p_account_id)
    returning id into v_workspace_id;

    insert into public.karaoke_workspace_members (workspace_id, account_id, role, status)
    values (v_workspace_id, p_account_id, 'owner', 'active');
  end if;

  -- Create the Room. The unique index on karaoke_rooms.slug is the collision
  -- backstop: a slug clash raises 23505, which aborts this whole transaction
  -- (nothing partial survives) and the caller retries with a fresh slug.
  insert into public.karaoke_rooms (slug, display_name, dj_secret, status)
  values (p_slug, p_display_name, p_dj_secret, 'open')
  returning id into v_room_id;

  insert into public.karaoke_room_ownership (room_id, workspace_id, claimed_by_account)
  values (v_room_id, v_workspace_id, p_account_id);

  return jsonb_build_object('outcome', 'created', 'slug', p_slug, 'roomId', v_room_id);
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.create_karaoke_room(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_karaoke_room(uuid, text, text, text, text)
  to service_role;
