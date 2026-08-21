-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry REQUIRED LEARNING — derived in_progress projection (Slice R4-R5C3A2)
--
-- FUNCTION DEFINITION ONLY. No table, no column, no index, no constraint, no
-- backfill, no participant mutation, no data write of any kind. `create or replace`
-- keeps the exact same argument list and the exact same RETURNS TABLE signature, so
-- no DROP is required and nothing that calls it needs to change shape.
--
-- WHAT CHANGES: one column of the projection.
-- ------------------------------------------
-- `status` was `a.status` verbatim — the persisted assignment state, which knows only
-- `assigned` and `completed`. A learner who had genuinely started an assigned training
-- was therefore told `Start learning`, because the only relation that could have proved
-- otherwise did not exist until R4-R5C3A1 added `foundry_event_participants.user_id`.
--
-- This projects a THIRD learner-facing value, `in_progress`, derived at read time.
-- NOTHING NEW IS PERSISTED: the assignment row still stores `assigned`/`completed`, and
-- `a.status` remains the sole authority for completion.
--
-- THE TRUTH RULE, and why each clause is there
-- --------------------------------------------
--   p.user_id = p_auth_user_id   the account edge from C3A1. This is the whole reason the
--                                projection can exist, and it is also the account-switch
--                                guard: a participant bound to a DIFFERENT account can
--                                never make this caller's assignment look started.
--                                A NULL (anonymous, or pre-C3A1) participant never matches,
--                                so historical rows stay invisible here — transitional, and
--                                truthful. Nothing is backfilled or inferred.
--   p.status = 'joined'          a removed participant is not a learner in progress.
--   g.completed_at is null       finished work is `completed`, not `in_progress`.
--   at least one REAL marker     JOINING IS NOT STARTING. A participant row alone — opened
--                                the room, typed a name, pressed Continue — proves only that
--                                someone arrived. The markers below are written when the
--                                learner actually engages the material, and are read from
--                                the shipped schema, not from a design document:
--                                  video_started_at            (startVideo)
--                                  document_last_page          (recordReadingProgress)
--                                  document_active_read_ms > 0 (NOT NULL DEFAULT 0, so the
--                                                               test is > 0, never IS NOT NULL)
--                                  written_guidance_read_at    (declareGuidanceExposure)
--                                  discussion_self_reported_at (declareGuidanceExposure)
--
-- EXISTS, NOT A CANONICAL PICK
-- ----------------------------
-- Canonicality is MULTIPLE PARTICIPANTS / ONE ACCOUNT (R4-R5C3 §5): one learner may hold a
-- participant per device, each with its own session and its own progress row. The question
-- this projection answers is "has this account started this training", which is an EXISTS —
-- so no latest/first/canonical participant is chosen, no progress is merged, and adding a
-- second device can never change the answer from true to false.
--
-- COMPLETION WINS
-- ---------------
-- The `case` tests `a.status = 'completed'` FIRST, so a stale or orphaned unfinished
-- participant can never downgrade a completed assignment to in_progress.
--
-- ORDERING IS UNCHANGED. The ORDER BY still reads `a.status`, the persisted column, so
-- unfinished assignments keep sorting ahead of completed ones exactly as before.
--
-- INDEX: served by `foundry_event_participants_event_user_idx (event_id, user_id)
-- WHERE user_id IS NOT NULL` from R4-R5C3A1, plus the existing
-- `foundry_training_progress_unique (event_id, participant_id)`. The probe is bounded by one
-- learner's own assignments and short-circuits on the first match.
--
-- ROLLBACK: re-apply 20260725000000 (the v1 body). No data is touched by either direction.
-- =============================================================================

create or replace function public.bty_foundry_list_my_assignments(
  p_auth_user_id uuid
)
returns table (
  assignment_id uuid,
  event_id uuid,
  status text,
  title text,
  assigned_at timestamptz,
  completed_at timestamptz,
  join_version integer,
  participation_mode text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    a.id as assignment_id,
    a.event_id as event_id,
    case
      when a.status = 'completed' then 'completed'
      when exists (
        select 1
          from public.foundry_event_participants p
          join public.foundry_event_training_progress g
            on g.event_id = p.event_id
           and g.participant_id = p.id
         where p.event_id = a.event_id
           and p.user_id = p_auth_user_id
           and p.status = 'joined'
           and g.completed_at is null
           and (
                g.video_started_at is not null
             or g.document_last_page is not null
             or coalesce(g.document_active_read_ms, 0) > 0
             or g.written_guidance_read_at is not null
             or g.discussion_self_reported_at is not null
           )
      ) then 'in_progress'
      else a.status
    end as status,
    e.title as title,
    a.assigned_at as assigned_at,
    a.completed_at as completed_at,
    e.join_version as join_version,
    'assigned_overlay'::text as participation_mode
  from public.foundry_event_assignments a
  join public.foundry_events e
    on e.id = a.event_id
  join public.foundry_event_participation_mode m
    on m.event_id = a.event_id
   and m.mode = 'assigned_overlay'
  where a.user_id_snapshot = p_auth_user_id
    and a.status in ('assigned', 'completed')
  order by
    case when a.status = 'assigned' then 0 else 1 end,
    coalesce(a.completed_at, a.assigned_at) desc;
$$;

revoke execute on function public.bty_foundry_list_my_assignments(uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_list_my_assignments(uuid)
  to service_role;
