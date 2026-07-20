-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — EVENT LIFECYCLE V1. Make "End Event" a single ATOMIC, idempotent
-- operation, and return an honest ended summary in the same round-trip. Isolated
-- bty-karaoke Supabase project (ref zycwaqignioawtqynopj). Same access model as
-- everything else: the browser NEVER talks to Postgres — only the server's
-- service_role invokes this. Additive + idempotent; never regresses prior
-- migrations (v0 / events / one-live-per-room / self-service-start / event_id).
--
-- Why an RPC (was 4 separate app-level UPDATEs): ending must close the whole live
-- queue AS ONE unit, so a partial failure can never leave a `playing` row open
-- while the event already reads `ended` (which would leak into the next Event).
-- supabase-js from a Worker has no ambient transaction; a plpgsql function is the
-- transactional boundary the data layer supports.
--
-- Canonical end policy (Event Lifecycle V1):
--   * WAITING request  -> 'removed'  (it never played)
--   * PLAYING request  -> 'skipped'  (unfinished — cut off by End; a terminal
--                          NON-completed status. It is NOT marked 'completed':
--                          only a song the DJ actually finished is completed
--                          history.)
--   * ready_at / youtube_queued_at cleared on every closed row (moot once ended,
--     and must never carry into the next Event — V7.1 event scope).
--   * completed / skipped / removed history rows are UNTOUCHED (no record is ever
--     deleted or rewritten).
--   * the active karaoke_session for the room is ended (room-scoped, mirrors the
--     prior app-level behavior).
--   * the event row flips to 'ended' + ended_at (only when currently live).
--
-- Idempotent: calling End on an already ended/archived Event does not re-touch any
-- request row and reports unfinished_closed_count = 0, still returning the honest
-- completed_count so a lost-response retry resolves to the same canonical summary.
--
-- Request rows are scoped by event_id (V7.1) so ending one Event in a reused room
-- never closes another Event's rows. Rollback:
--   drop function if exists public.end_karaoke_event(uuid);
create or replace function public.end_karaoke_event(
  p_event_id uuid
) returns table (
  event_id                uuid,
  status                  text,
  ended_at                timestamptz,
  completed_count         integer,
  unfinished_closed_count integer
)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_room_id  uuid;
  v_status   text;
  v_ended_at timestamptz;
  v_closed   integer := 0;
  v_n        integer := 0;
begin
  -- The event must exist. `found`/return-nothing lets the caller map to 404.
  select room_id, e.status, e.ended_at
    into v_room_id, v_status, v_ended_at
    from public.karaoke_events e
   where e.id = p_event_id;
  if not found then
    return; -- no rows -> caller treats as "event not found"
  end if;

  -- Already ended/archived: idempotent no-op close. Report the honest completed
  -- count for this event; nothing was closed by THIS call.
  if v_status in ('ended', 'archived') then
    select count(*) into v_n
      from public.karaoke_requests r
     where r.event_id = p_event_id and r.status = 'completed';
    return query select p_event_id, v_status, v_ended_at, coalesce(v_n, 0), 0;
    return;
  end if;

  -- End the room's active night (blocks new guest requests; media not stopped).
  update public.karaoke_sessions
     set status = 'ended', ended_at = now()
   where room_id = v_room_id and status = 'active';

  -- Close WAITING rows -> removed (never played).
  with upd_wait as (
    update public.karaoke_requests
       set status = 'removed', ready_at = null, youtube_queued_at = null
     where event_id = p_event_id and status = 'waiting'
     returning 1
  )
  select count(*) into v_n from upd_wait;
  v_closed := v_closed + coalesce(v_n, 0);

  -- Close the PLAYING row -> skipped (unfinished — NOT completed).
  with upd_play as (
    update public.karaoke_requests
       set status = 'skipped', ready_at = null, youtube_queued_at = null
     where event_id = p_event_id and status = 'playing'
     returning 1
  )
  select count(*) into v_n from upd_play;
  v_closed := v_closed + coalesce(v_n, 0);

  -- Flip the event -> ended (guarded on still-live so a race ends it once).
  update public.karaoke_events
     set status = 'ended', ended_at = now()
   where id = p_event_id and status in ('draft', 'active')
   returning karaoke_events.status, karaoke_events.ended_at
        into v_status, v_ended_at;

  -- Honest completed history for this event (unchanged by End).
  select count(*) into v_n
    from public.karaoke_requests r
   where r.event_id = p_event_id and r.status = 'completed';

  return query select p_event_id, v_status, v_ended_at, coalesce(v_n, 0), v_closed;
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.end_karaoke_event(uuid)
  from public, anon, authenticated;
grant execute on function public.end_karaoke_event(uuid)
  to service_role;
