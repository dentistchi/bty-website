-- ===========================================================================
-- FOUNDRY APPLY ACTION DAY V1 — the learner's own "when", structured.
-- ADDITIVE ONLY. No existing row is updated, and nothing is backfilled.
-- ===========================================================================
--
-- WHY. Today knew only the 7-day apply window. A learner who wrote "Tomorrow morning I am
-- opening…" kept seeing the card for the rest of the week, because the only place their
-- timing existed was prose. BTY does not parse prose into dates, so this adds the one
-- structured fact that was missing: the DAY the learner chose, inside the existing window.
--
-- action_bty_day IS NOT: the follow-up due date, a completion date, a task status or a reminder
-- timestamp. It is historical intent. completion_bty_day, due_bty_day, apply_days = 7 and the
-- follow-up lifecycle are unchanged. NULL ("Sometime this week", or any row created before this
-- migration) keeps the existing 7-day behaviour exactly.
--
-- BOUNDARY: completion_bty_day <= action_bty_day < due_bty_day. The due day is excluded because
-- it is the follow-up / check-in boundary (the follow-up is created on the same due day and, once
-- it is asking, Today hands the card to it).
--
-- RPCs. Both are re-declared with exactly ONE shape each:
--   * bty_foundry_materialize_apply_window gains a trailing `p_action_bty_day date default null`,
--     so a caller that passes the original twelve named arguments still resolves to it. The old
--     twelve-argument signature is dropped in the same transaction, so no overload remains.
--   * bty_foundry_list_my_apply_windows returns the same columns plus action_bty_day. A return
--     shape cannot be changed in place, so it is dropped and re-created in this transaction.
-- SECURITY DEFINER, search_path, idempotency (ON CONFLICT DO NOTHING — an existing window keeps
-- whatever it was created with) and service_role-only EXECUTE are preserved.
begin;

do $$
begin
  if to_regclass('public.foundry_participant_apply_windows') is null then
    raise exception 'foundry_participant_apply_windows is missing; apply 20260823000000 first';
  end if;
end $$;

alter table public.foundry_participant_apply_windows
  add column if not exists action_bty_day date;

comment on column public.foundry_participant_apply_windows.action_bty_day is
  'Apply Action Day V1 — the BTY day the learner chose to act (Today / Tomorrow / a picked day), '
  'resolved server-side against completion_bty_day in the learner''s canonical timezone. NULL = '
  '"Sometime this week" or created before V1: the 7-day window governs. Never parsed from prose. '
  'Not a follow-up date, completion date, status or reminder time.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foundry_participant_apply_windows'::regclass
      and conname = 'foundry_apply_window_action_day_check'
  ) then
    alter table public.foundry_participant_apply_windows
      add constraint foundry_apply_window_action_day_check
      check (action_bty_day is null
             or (action_bty_day >= completion_bty_day and action_bty_day < due_bty_day));
  end if;
end $$;

-- MATERIALIZE — exactly one shape.
drop function if exists public.bty_foundry_materialize_apply_window(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz);

create or replace function public.bty_foundry_materialize_apply_window(
  p_event_id uuid,
  p_progress_id uuid,
  p_assignment_id uuid,
  p_organization_id uuid,
  p_user_id_snapshot uuid,
  p_source_training_title text,
  p_apply_days integer,
  p_completed_at timestamptz,
  p_timezone_snapshot text,
  p_completion_bty_day date,
  p_due_bty_day date,
  p_due_at timestamptz,
  p_action_bty_day date default null
)
returns table (result text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_id uuid;
begin
  if p_apply_days is distinct from 7 then
    return query select 'skipped'::text;
    return;
  end if;
  if p_user_id_snapshot is null or p_progress_id is null then
    return query select 'skipped'::text;
    return;
  end if;
  if p_due_bty_day is null or p_completion_bty_day is null or p_due_bty_day <= p_completion_bty_day then
    return query select 'skipped'::text;
    return;
  end if;
  -- The caller resolves the day; a day outside the window is a caller bug, never a silent clamp.
  if p_action_bty_day is not null
     and (p_action_bty_day < p_completion_bty_day or p_action_bty_day >= p_due_bty_day) then
    raise exception 'invalid_action_day' using errcode = '22023';
  end if;

  insert into public.foundry_participant_apply_windows (
    organization_id, event_id, progress_id, assignment_id, user_id_snapshot,
    source_training_title, apply_days, completed_at,
    timezone_snapshot, completion_bty_day, due_bty_day, due_at, action_bty_day
  )
  values (
    p_organization_id, p_event_id, p_progress_id, p_assignment_id, p_user_id_snapshot,
    btrim(p_source_training_title), p_apply_days, p_completed_at,
    p_timezone_snapshot, p_completion_bty_day, p_due_bty_day, p_due_at, p_action_bty_day
  )
  on conflict (progress_id) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    return query select 'exists'::text;
    return;
  end if;

  return query select 'created'::text;
end
$$;

revoke all on function public.bty_foundry_materialize_apply_window(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz, date)
  from anon, public, authenticated;
grant execute on function public.bty_foundry_materialize_apply_window(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz, date)
  to service_role;

-- LEARNER READ — exactly one shape; same owner scoping, plus action_bty_day.
drop function if exists public.bty_foundry_list_my_apply_windows(uuid);

create function public.bty_foundry_list_my_apply_windows(
  p_auth_user_id uuid
)
returns table (
  id uuid,
  event_id uuid,
  progress_id uuid,
  source_training_title text,
  apply_days integer,
  completed_at timestamptz,
  completion_bty_day date,
  due_bty_day date,
  due_at timestamptz,
  action_bty_day date
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    w.id, w.event_id, w.progress_id, w.source_training_title, w.apply_days,
    w.completed_at, w.completion_bty_day, w.due_bty_day, w.due_at, w.action_bty_day
  from public.foundry_participant_apply_windows w
  where w.user_id_snapshot = p_auth_user_id
  order by w.due_at asc;
$$;

revoke execute on function public.bty_foundry_list_my_apply_windows(uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_list_my_apply_windows(uuid)
  to service_role;

commit;
