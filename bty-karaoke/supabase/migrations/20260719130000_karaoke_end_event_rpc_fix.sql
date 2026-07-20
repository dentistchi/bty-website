-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — EVENT LIFECYCLE V1 (fix). Corrects 20260719120000, whose
-- `returns table (event_id, status, ended_at, ...)` declared OUT PARAMETERS that
-- shadow real column names. Every UPDATE inside the body then failed with:
--
--   42702  column reference "status" is ambiguous
--          It could refer to either a PL/pgSQL variable or a table column.
--
-- The defect was invisible to a not-found probe (that path returns before any
-- UPDATE) and only fired on a REAL event, so End closed nothing and the event
-- stayed active. Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj).
--
-- Fix: drop the OUT parameters entirely and return ONE jsonb object. With no OUT
-- params there is no PL/pgSQL name in scope that can collide with a column, so the
-- ambiguity class is eliminated rather than patched. Every column reference is also
-- explicitly table-qualified. The return type changes, so the old function must be
-- dropped first (create-or-replace cannot change a return type).
--
-- Canonical end policy is UNCHANGED from the approved contract:
--   * WAITING request -> 'removed'  (never played)
--   * PLAYING request -> 'skipped'  (unfinished, cut off by End; NEVER 'completed')
--   * ready_at / youtube_queued_at cleared on every closed row
--   * completed / skipped / removed history rows UNTOUCHED
--   * the room's active karaoke_session is ended
--   * the event flips to 'ended' + ended_at (only when currently live)
--   * idempotent: ending an already ended/archived event re-closes nothing and
--     still reports the honest completedCount
--   * request rows scoped by event_id (V7.1) so one Event's End never touches another
--
-- Returns jsonb: { eventId, status, endedAt, completedCount, unfinishedClosedCount }
-- or SQL NULL when the event does not exist (caller maps null -> 404).
--
-- Additive + idempotent (safe to re-run). Rollback:
--   drop function if exists public.end_karaoke_event(uuid);
drop function if exists public.end_karaoke_event(uuid);

create function public.end_karaoke_event(
  p_event_id uuid
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_room_id   uuid;
  v_status    text;
  v_ended_at  timestamptz;
  v_closed    integer := 0;
  v_n         integer := 0;
  v_completed integer := 0;
begin
  -- The event must exist. NULL lets the caller map to 404.
  select e.room_id, e.status, e.ended_at
    into v_room_id, v_status, v_ended_at
    from public.karaoke_events e
   where e.id = p_event_id;
  if not found then
    return null;
  end if;

  -- Already ended/archived: idempotent no-op close. Report the honest completed
  -- count for this event; nothing was closed by THIS call.
  if v_status in ('ended', 'archived') then
    select count(*) into v_completed
      from public.karaoke_requests r
     where r.event_id = p_event_id and r.status = 'completed';
    return jsonb_build_object(
      'eventId', p_event_id,
      'status', v_status,
      'endedAt', v_ended_at,
      'completedCount', coalesce(v_completed, 0),
      'unfinishedClosedCount', 0
    );
  end if;

  -- End the room's active night (blocks new guest requests; media not stopped).
  update public.karaoke_sessions s
     set status = 'ended', ended_at = now()
   where s.room_id = v_room_id and s.status = 'active';

  -- Close WAITING rows -> removed (never played).
  with upd_wait as (
    update public.karaoke_requests r
       set status = 'removed', ready_at = null, youtube_queued_at = null
     where r.event_id = p_event_id and r.status = 'waiting'
     returning 1
  )
  select count(*) into v_n from upd_wait;
  v_closed := v_closed + coalesce(v_n, 0);

  -- Close the PLAYING row -> skipped (unfinished — NOT completed).
  with upd_play as (
    update public.karaoke_requests r
       set status = 'skipped', ready_at = null, youtube_queued_at = null
     where r.event_id = p_event_id and r.status = 'playing'
     returning 1
  )
  select count(*) into v_n from upd_play;
  v_closed := v_closed + coalesce(v_n, 0);

  -- Flip the event -> ended (guarded on still-live so a race ends it once).
  update public.karaoke_events e
     set status = 'ended', ended_at = now()
   where e.id = p_event_id and e.status in ('draft', 'active')
   returning e.status, e.ended_at into v_status, v_ended_at;

  -- Honest completed history for this event (unchanged by End).
  select count(*) into v_completed
    from public.karaoke_requests r
   where r.event_id = p_event_id and r.status = 'completed';

  return jsonb_build_object(
    'eventId', p_event_id,
    'status', v_status,
    'endedAt', v_ended_at,
    'completedCount', coalesce(v_completed, 0),
    'unfinishedClosedCount', v_closed
  );
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.end_karaoke_event(uuid)
  from public, anon, authenticated;
grant execute on function public.end_karaoke_event(uuid)
  to service_role;
