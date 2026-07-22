-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — PRO MULTI-ROOM V1. The additional-Room counterpart of
-- create_karaoke_room: an authenticated Host who ALREADY owns at least one Room
-- creates another, atomically, ONLY within their plan's Room limit. Isolated
-- bty-karaoke Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent;
-- never rewrites or regresses any prior migration.
--
-- Why a NEW function rather than extending create_karaoke_room: create_karaoke_room
-- is the FIRST-room (zero-to-one) path and short-circuits to 'has_room' for any account
-- that owns a Room, so it can never mint a second one — that behavior is deliberately
-- preserved. This function ONLY adds Rooms 2..N and is the SOLE place the plan Room-limit
-- is enforced. It NEVER creates the first Room and NEVER provisions a workspace: those
-- belong exclusively to create_karaoke_room.
--
-- Corrected semantics (fail-closed; no defensive provisioning):
--   * zero owned Rooms       → 'first_room_required' (zero writes). create_karaoke_room
--                              is the sole zero-to-one path; this function refuses.
--   * missing active workspace→ 'ownership_state_invalid' (zero writes). It never creates
--                              a workspace/membership to paper over a broken graph.
--
-- Guarantees (mapped to the slice's non-negotiable rules):
--   1/2. Server-authoritative limit — the plan is resolved from
--        karaoke_host_plan_assignments and the FREE=1 / PRO=3 cap is derived and
--        enforced INSIDE this function. The caller passes NO limit and cannot inflate it.
--   3.   No Room 4 under concurrency — the SAME per-account advisory xact lock as
--        create_karaoke_room serializes first-Room and additional-Room creation together;
--        the owned count is (re)read under the lock, so two simultaneous "create the 3rd"
--        requests yield exactly one 'created' (count→3) and one 'limit_reached'.
--   4.   Plan is READ-only — no assignment or audit row is written or changed here.
--   5.   Creates ZERO Events, queue rows, DJ devices, setup/pairing tokens.
--   6.   Existing Rooms/branding/ownership are untouched; only a new Room + its ownership
--        are inserted. Legacy over-cap Hosts keep every Room (only new creation blocks).
--   Ownership integrity — the owner account is a function argument the server derives from
--        the authenticated Host session; this function never trusts a client-supplied owner.
--
-- Defaults are left to the table (branding_theme default, welcome NULL): this slice
-- changes NO creation defaults.
--
-- Rollback:
--   drop function if exists public.create_additional_karaoke_room(uuid, text, text, text);

create or replace function public.create_additional_karaoke_room(
  p_account_id   uuid,
  p_slug         text,
  p_display_name text,
  p_dj_secret    text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_room_id      uuid;
  v_owned_count  int;
  v_plan         text;
  v_max_rooms    int;
begin
  -- Same per-account advisory lock as create_karaoke_room (released at txn end), so
  -- first-Room and additional-Room creates for THIS account serialize together and the
  -- read-modify-write of the owned-Room count is atomic across concurrent requests.
  perform pg_advisory_xact_lock(hashtext('karaoke_first_room:' || p_account_id::text));

  -- Account must exist. Existence only — no email/subject is read or returned.
  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('outcome', 'account_not_found');
  end if;

  -- Resolve the canonical ACTIVE plan INSIDE the lock, then derive the limit here.
  -- Missing/unknown plan → FREE (safe default; never a paid promotion). The caller
  -- passes no limit, so it cannot choose or inflate the cap.
  select plan_code into v_plan
    from public.karaoke_host_plan_assignments
   where account_id = p_account_id and status = 'active'
   limit 1;
  v_plan := coalesce(v_plan, 'FREE');
  if v_plan not in ('FREE', 'PRO') then
    v_plan := 'FREE';
  end if;
  v_max_rooms := case v_plan when 'PRO' then 3 else 1 end;

  -- Count the account's currently-owned Rooms (by the canonical owner column).
  select count(*) into v_owned_count
    from public.karaoke_room_ownership o
   where o.claimed_by_account = p_account_id;

  -- Zero owned → this is a FIRST Room; refuse. create_karaoke_room is the sole zero-to-
  -- one path. NO write, NO defensive workspace/membership creation.
  if v_owned_count = 0 then
    return jsonb_build_object(
      'outcome', 'first_room_required', 'plan', v_plan, 'count', v_owned_count, 'max', v_max_rooms
    );
  end if;

  -- At/over the cap → no write. Legacy over-cap Hosts land here too and keep all Rooms.
  if v_owned_count >= v_max_rooms then
    return jsonb_build_object(
      'outcome', 'limit_reached', 'plan', v_plan, 'count', v_owned_count, 'max', v_max_rooms
    );
  end if;

  -- Attach the new Room to the account's existing active workspace. A Host who owns a
  -- Room must have one; if it is missing the ownership graph is broken — fail closed
  -- with NO write rather than defensively creating a workspace.
  select m.workspace_id into v_workspace_id
    from public.karaoke_workspace_members m
   where m.account_id = p_account_id and m.status = 'active'
   order by m.created_at asc
   limit 1;

  if v_workspace_id is null then
    return jsonb_build_object(
      'outcome', 'ownership_state_invalid', 'plan', v_plan, 'count', v_owned_count, 'max', v_max_rooms
    );
  end if;

  -- Create the Room. The unique index on karaoke_rooms.slug is the collision backstop:
  -- a clash raises 23505, aborts this whole transaction (nothing partial survives), and
  -- the caller retries with a fresh slug. No branding_theme/welcome is set here — the
  -- table defaults stand; this slice changes no creation defaults.
  insert into public.karaoke_rooms (slug, display_name, dj_secret, status)
  values (p_slug, p_display_name, p_dj_secret, 'open')
  returning id into v_room_id;

  insert into public.karaoke_room_ownership (room_id, workspace_id, claimed_by_account)
  values (v_room_id, v_workspace_id, p_account_id);

  return jsonb_build_object(
    'outcome', 'created', 'slug', p_slug, 'roomId', v_room_id,
    'plan', v_plan, 'count', v_owned_count + 1, 'max', v_max_rooms
  );
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.create_additional_karaoke_room(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_additional_karaoke_room(uuid, text, text, text)
  to service_role;
