-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — SELF-SERVICE V2. Lets the NEXT singer start their own song from
-- their phone (no DJ required), safely under concurrency. Isolated bty-karaoke
-- Supabase project (ref zycwaqignioawtqynopj). Same access model as everything
-- else: the browser NEVER talks to Postgres — only the server's service_role
-- invokes this. Additive + idempotent; never regresses v0 / 2C / admin-pin /
-- events / reorder.
--
-- Adds:
--   1. karaoke_requests_one_playing_idx — a PARTIAL UNIQUE index guaranteeing at
--      most ONE `playing` row per room at the DB level (the single-stage
--      invariant, declaratively enforced — belt to the RPC's suspenders).
--   2. start_karaoke_request(room_id, request_id) — ONE atomic, advisory-locked
--      RPC that promotes a WAITING request to PLAYING only when it is the
--      canonical FIRST waiting song AND the stage is open. Two guests tapping
--      "Start My Song" at the same instant yield exactly one winner.
--
-- Canonical queue semantics are PRESERVED, not redesigned:
--   * ordering key stays `position ASC` (tie-break created_at, id) — unchanged
--   * the promoted row keeps its `position`; only `status`/`started_at` change
--   * guest "#N" stays a derived rank among WAITING rows — unchanged

-- 1. At most one playing song per room -----------------------------------------
-- Partial unique index: any second concurrent transition to `playing` in the
-- same room fails with SQLSTATE 23505 instead of creating a duplicate stage.
create unique index if not exists karaoke_requests_one_playing_idx
  on public.karaoke_requests (room_id)
  where status = 'playing';

-- 2. Atomic guest-owned start --------------------------------------------------
-- start_karaoke_request(room_id, request_id) -> outcome text
--   'ok'              — request promoted waiting -> playing (started_at stamped)
--   'not_found'       — no such request in this room
--   'not_waiting'     — the request is not currently waiting (already started/
--                       removed/completed)
--   'not_next'        — the request is waiting but NOT the first in line
--   'already_playing' — another song already holds the stage in this room
create or replace function public.start_karaoke_request(
  p_room_id    uuid,
  p_request_id uuid
) returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status  text;
  v_first   uuid;
  v_playing uuid;
begin
  -- Serialize with concurrent starts / reorders / guest adds for THIS room.
  -- Released at txn end.
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));

  -- The request must exist in this room.
  select status into v_status
    from public.karaoke_requests
   where id = p_request_id and room_id = p_room_id;
  if v_status is null then
    return 'not_found';
  end if;
  if v_status <> 'waiting' then
    return 'not_waiting';
  end if;

  -- The stage must be open (no song currently playing in this room).
  select id into v_playing
    from public.karaoke_requests
   where room_id = p_room_id and status = 'playing'
   limit 1;
  if v_playing is not null then
    return 'already_playing';
  end if;

  -- The request must be the canonical FIRST waiting song.
  select id into v_first
    from public.karaoke_requests
   where room_id = p_room_id and status = 'waiting'
   order by position asc, created_at asc, id asc
   limit 1;
  if v_first is distinct from p_request_id then
    return 'not_next';
  end if;

  -- Promote it. Position is untouched; the resolver treats the playing row as
  -- the stage and never counts it as "ahead" in line.
  update public.karaoke_requests
     set status = 'playing', started_at = now()
   where id = p_request_id and room_id = p_room_id and status = 'waiting';

  return 'ok';
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.start_karaoke_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.start_karaoke_request(uuid, uuid)
  to service_role;
