-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — DJ Queue Reorder V1. Adds ONE atomic RPC that renumbers the
-- WAITING requests of a room into a DJ-chosen order. Additive and idempotent
-- (create or replace); no table/column/constraint change, never regresses the
-- existing schema. Same access model as everything else here: the browser never
-- calls Postgres — only the server's service_role invokes this.
--
-- Canonical queue semantics are PRESERVED, not redesigned:
--   * ordering key stays `position ASC` (tie-break created_at, id) — unchanged
--   * guest "#N" is still derived (rank among WAITING rows) — unchanged
--   * the on-stage `playing` row is never touched
-- The function only rewrites WAITING rows' `position` values.

-- reorder_karaoke_requests(room_id, ordered_ids[]) -> outcome text
--   'ok'            — positions rewritten to match ordered_ids (+ any new
--                     arrivals appended at the tail in canonical order)
--   'empty'         — null/empty payload; nothing done
--   'invalid'       — duplicate ids in the payload; nothing done
--   'queue_changed' — a payload id is no longer waiting in this room
--                     (started/removed/unknown/other room); nothing done
create or replace function public.reorder_karaoke_requests(
  p_room_id     uuid,
  p_ordered_ids uuid[]
) returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_waiting     uuid[];
  v_leftover    uuid[];
  v_final       uuid[];
  v_playing_pos integer;
  v_start       integer;
  v_id          uuid;
  v_i           integer := 0;
begin
  -- No work / malformed payload.
  if p_ordered_ids is null or coalesce(array_length(p_ordered_ids, 1), 0) = 0 then
    return 'empty';
  end if;

  -- Reject duplicate ids in the payload (client bug or tampering) before touching
  -- any row.
  if (select count(*) from unnest(p_ordered_ids)) <>
     (select count(distinct u) from unnest(p_ordered_ids) as u) then
    return 'invalid';
  end if;

  -- Serialize concurrent reorders — and guard against a guest add / play
  -- transition interleaving mid-reorder — for THIS room. Released at txn end.
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));

  -- Canonical waiting set for the room, read AFTER acquiring the lock.
  select coalesce(array_agg(id order by position asc, created_at asc, id asc), '{}')
    into v_waiting
    from public.karaoke_requests
   where room_id = p_room_id and status = 'waiting';

  -- Every payload id must still be waiting in THIS room. Any id that is no longer
  -- waiting (started/removed), unknown, or from another room means the queue
  -- changed under the DJ → ask the client to refetch. No row is mutated.
  foreach v_id in array p_ordered_ids loop
    if not (v_id = any (v_waiting)) then
      return 'queue_changed';
    end if;
  end loop;

  -- New arrivals (waiting, but not named in the payload) are preserved at the
  -- tail in canonical order — a concurrent guest request is never lost or
  -- reordered away.
  select coalesce(array_agg(id order by position asc, created_at asc, id asc), '{}')
    into v_leftover
    from public.karaoke_requests
   where room_id = p_room_id and status = 'waiting'
     and not (id = any (p_ordered_ids));

  v_final := p_ordered_ids || v_leftover;

  -- Keep the on-stage song untouched; waiting rows sit right after it and get
  -- consecutive, predictable positions (normalization). With no playing song the
  -- waiting line normalizes to 1..N.
  select position into v_playing_pos
    from public.karaoke_requests
   where room_id = p_room_id and status = 'playing'
   order by position asc
   limit 1;
  v_start := coalesce(v_playing_pos, 0) + 1;

  foreach v_id in array v_final loop
    update public.karaoke_requests
       set position = v_start + v_i
     where id = v_id and room_id = p_room_id and status = 'waiting';
    v_i := v_i + 1;
  end loop;

  return 'ok';
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.reorder_karaoke_requests(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.reorder_karaoke_requests(uuid, uuid[])
  to service_role;
