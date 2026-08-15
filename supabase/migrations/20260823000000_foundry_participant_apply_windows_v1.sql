-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SLICE 3.2R-R2 — the Action Decision becomes a real-world APPLY WINDOW.
-- ADDITIVE ONLY. No existing table, column, constraint, function or grant is altered.
-- ===========================================================================
--
-- WHAT THIS IS. A learner finishes a Guided training whose published journey asked them to
-- decide something, and they write what they will do. Until now that sentence was stored and
-- then sat still: DECIDED was established, and nothing carried the decision into the days when
-- it would actually have to happen. This table is that carry — one dated, learner-owned window
-- per decision, which Today projects as "Apply this week".
--
-- WHAT IT IS NOT, AND THE CONSTRAINTS THAT ENFORCE IT:
--
--   * NOT a task. There is no `status`, no `completed_at`, no `done` flag and no learner write
--     path of any kind. A window cannot be ticked off, because ticking it off would be the
--     learner asserting APPLIED — and APPLIED belongs exclusively to
--     `bty_foundry_submit_followup`. A column that could hold "done" is a column somebody will
--     eventually treat as evidence, so there is none.
--   * NOT evidence. Creating, viewing, opening or expiring a window establishes NOTHING on the
--     ladder. It records that an obligation EXISTS, never that it was met.
--   * NOT a widening of the follow-up. `foundry_participant_followups` keeps its exact
--     `follow_up_days in (7, 30)` domain and its exact meaning: a checkpoint that ASKS what
--     happened. This is the period BEFORE that question is fair to ask. Measured live before
--     writing this file: 7 rows, all follow_up_days = 7, all 7 with a distinct progress_id, 3
--     learners, all `America/Los_Angeles`. Widening that table with a `0` checkpoint would have
--     collided with its own `foundry_followup_unique_progress_checkpoint` semantics and made
--     "checkpoint" mean two different things.
--   * NOT Arena. `bty_action_contracts` was measured and rejected: it has no `event_id` and no
--     `progress_id` at all, and its identity is `(user_id, session_id)` where session_id is an
--     `arena_runs.run_id`. Routing a Foundry decision through it would require fabricating an
--     Arena run.
--
-- NO FREE TEXT, DELIBERATELY. `foundry_participant_followups` states the rule this table
-- inherits: "NO free text, NO reflection, NO shared-understanding response, NO AI output — only
-- structured obligation state." So the DECISION SENTENCE IS NOT COPIED HERE. It is read through
-- `progress_id` on the owner-scoped learner path that already carries it (`decision_response_text`,
-- Host-visible by settled 3.2M-1 design). Two reasons, and neither is elegance:
--   1. A second copy of learner-authored text is a second retention and erasure surface, and
--      retention/deletion semantics are counsel-dependent and explicitly OUT OF SCOPE. Creating
--      one here would quietly enlarge the very question we are not allowed to answer.
--   2. The window's meaning survives without it. `source_training_title` is snapshotted for
--      exactly the reason the follow-up snapshots it — so a row still says what it came FROM
--      after its FKs are nulled — but "what I decided" is the learner's record, not the
--      obligation's, and it has a canonical home already.
-- The cost is accepted and stated: if `progress_id` is ever nulled by a deletion, the window
-- keeps its dates and its training title and loses its sentence. That is the honest outcome, and
-- it is strictly better than holding a copy nobody has decided the retention rule for.
--
-- IDENTITY. `user_id_snapshot` is the server-derived `auth.users.id` at the authenticated
-- completion OR at the authenticated claim — the same rule 3.1B-3K proved. An anonymous,
-- unclaimed completion has NO identity and materializes NOTHING here.
--
-- DURABILITY. Live FKs are ON DELETE SET NULL, mirroring the follow-up exactly, so a deleted
-- event/progress/assignment never cascade-deletes a learner's obligation record; the snapshot
-- fields preserve historical meaning independently.
--
-- ROLLBACK:
--   drop function if exists public.bty_foundry_list_my_apply_windows(uuid);
--   drop function if exists public.bty_foundry_materialize_apply_window(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz);
--   drop table if exists public.foundry_participant_apply_windows;
-- ===========================================================================

-- 1. The per-decision APPLICATION WINDOW.
create table if not exists public.foundry_participant_apply_windows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  event_id uuid references public.foundry_events (id) on delete set null,
  progress_id uuid references public.foundry_event_training_progress (id) on delete set null,
  assignment_id uuid references public.foundry_event_assignments (id) on delete set null,
  user_id_snapshot uuid not null,

  -- Non-learner-authored context, snapshotted so the row still means something after FK nulling.
  source_training_title text not null,

  -- The window length in days. A column rather than a constant because the follow-up checkpoint
  -- is already Host-authored and this will eventually follow it; V1 admits 7 only, so no value
  -- can be stored that the product cannot currently explain.
  apply_days integer not null default 7,

  completed_at timestamptz not null,

  -- Time math computed ONCE by the caller and only persisted here — the same contract as the
  -- follow-up obligation. A later travel or profile-timezone change never rewrites a stored day.
  timezone_snapshot text not null,
  completion_bty_day date not null,
  due_bty_day date not null,
  due_at timestamptz not null,

  created_at timestamptz not null default now(),

  constraint foundry_apply_window_days_check check (apply_days = 7),
  constraint foundry_apply_window_title_len_check
    check (char_length(btrim(source_training_title)) between 1 and 300),
  -- The window cannot end before it starts. Cheap, and it makes the two anomalous live follow-up
  -- rows (due_bty_day = completion_bty_day on a 7-day checkpoint) unrepresentable here.
  constraint foundry_apply_window_order_check check (due_bty_day > completion_bty_day),
  -- IDEMPOTENCY: exactly one application window per completed progress row. There is no
  -- checkpoint dimension because there is no second window — the decision is made once.
  constraint foundry_apply_window_unique_progress unique (progress_id)
);

comment on table public.foundry_participant_apply_windows is
  'Slice 3.2R-R2 — one dated, learner-owned window per recorded Action Decision. Structured '
  'obligation state ONLY: no free text, no status, no completion flag, no learner write path. '
  'Creating, viewing or expiring a row establishes NOTHING on the evidence ladder; APPLIED '
  'remains exclusively the follow-up authority (bty_foundry_submit_followup).';
comment on column public.foundry_participant_apply_windows.completion_bty_day is
  'Slice 3.2R-R2 — the BTY day the training was completed, which IS the day the window opens. '
  'No separate available_at/start column exists because this one already states the start '
  'truthfully, including for a window materialized later at an authenticated claim.';
comment on column public.foundry_participant_apply_windows.due_bty_day is
  'Slice 3.2R-R2 — completion_bty_day + apply_days. The last day of the application window. '
  'NEVER a deadline the learner can fail: passing it establishes nothing and removes nothing.';

-- Hot path: the owner's windows for the Today projection.
create index if not exists foundry_apply_windows_owner_due_idx
  on public.foundry_participant_apply_windows (user_id_snapshot, due_at);
-- Host per-event lookup (no Host surface in R2; the index costs nothing and avoids a later ALTER).
create index if not exists foundry_apply_windows_event_idx
  on public.foundry_participant_apply_windows (event_id);

revoke all on public.foundry_participant_apply_windows from anon, public, authenticated;
alter table public.foundry_participant_apply_windows enable row level security;

-- 2. MATERIALIZE — idempotent create, service-role only.
--    All time math (BTY day / DST-safe due instant) is computed by the caller and passed in;
--    this function only persists atomically. ON CONFLICT DO NOTHING guarantees exactly-once per
--    progress row across repeated completion / claim / reload / relaunch / XP retry.
--
--    NO AUDIT TABLE. The follow-up has one because its row TRANSITIONS (PENDING -> RESPONDED)
--    and a learner-reported outcome needs a trail. This row never transitions and holds no
--    report, so an audit table would record one INSERT and then nothing, forever.
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
  p_due_at timestamptz
)
returns table (result text)
language plpgsql
security definer
-- `#variable_conflict use_column` is not needed here (no OUT param shares a column name), but
-- search_path is pinned for the same reason every other SECURITY DEFINER in this repo pins it.
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

  insert into public.foundry_participant_apply_windows (
    organization_id, event_id, progress_id, assignment_id, user_id_snapshot,
    source_training_title, apply_days, completed_at,
    timezone_snapshot, completion_bty_day, due_bty_day, due_at
  )
  values (
    p_organization_id, p_event_id, p_progress_id, p_assignment_id, p_user_id_snapshot,
    btrim(p_source_training_title), p_apply_days, p_completed_at,
    p_timezone_snapshot, p_completion_bty_day, p_due_bty_day, p_due_at
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

revoke all on function public.bty_foundry_materialize_apply_window(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz)
  from anon, public, authenticated;
grant execute on function public.bty_foundry_materialize_apply_window(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz)
  to service_role;

-- 3. LEARNER READ — the caller's own windows, owner-scoped.
--    SECURITY DEFINER defense-in-depth: even if grants change, only the caller's own snapshot
--    rows are ever returned. This function returns NO learner-authored text; the Today projection
--    joins the decision sentence separately, through the owner-scoped path that already carries it.
create or replace function public.bty_foundry_list_my_apply_windows(
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
  due_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    w.id, w.event_id, w.progress_id, w.source_training_title, w.apply_days,
    w.completed_at, w.completion_bty_day, w.due_bty_day, w.due_at
  from public.foundry_participant_apply_windows w
  where w.user_id_snapshot = p_auth_user_id
  order by w.due_at asc;
$$;

revoke execute on function public.bty_foundry_list_my_apply_windows(uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_list_my_apply_windows(uuid)
  to service_role;

-- ===========================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_foundry_list_my_apply_windows(uuid);
--   drop function if exists public.bty_foundry_materialize_apply_window(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz);
--   drop table if exists public.foundry_participant_apply_windows;
-- ===========================================================================
