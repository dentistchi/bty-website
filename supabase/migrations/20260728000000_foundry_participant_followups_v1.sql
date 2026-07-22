-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Foundry Follow-up Obligation Engine V1 (Slice 3.1B-3K) — ADDITIVE ONLY.
-- ===========================================================================
-- Turns the authoring-only module setting module_snapshot.followUpDays (0/7/30)
-- into a real per-participant, dated, learner-owned obligation that:
--   * is materialized EXACTLY ONCE per (completed progress, checkpoint),
--   * carries a FIXED UTC due_at instant computed once at creation,
--   * surfaces in Today as FOLLOW_UP_DUE (due_today / overdue only),
--   * records a learner-reported outcome (APPLIED/PARTLY_APPLIED/NOT_YET/BLOCKED),
--   * NEVER awards XP, rewrites completed_at, reopens an assignment, or touches
--     Shared Understanding / Private Reflection.
--
-- EVIDENCE LADDER (do NOT conflate): the outcome here is SELF-REPORTED application,
-- never "verified" behavior. This table stores NO free text, NO reflection, NO
-- shared-understanding response, NO AI output — only structured obligation state.
--
-- IDENTITY: the owner is user_id_snapshot (server-derived auth.users.id at the
-- authenticated completion OR at the authenticated claim). An anonymous, unclaimed
-- completion has NO identity and materializes NOTHING here.
--
-- DURABILITY: live FKs (event/progress/assignment) are ON DELETE SET NULL so a
-- deleted event/progress row never cascade-deletes learner evidence; the snapshot
-- fields (user_id_snapshot, source_training_title, completion_bty_day, due_bty_day,
-- timezone_snapshot) preserve historical meaning independently.
--
-- ROLLBACK:
--   drop function if exists public.bty_foundry_get_my_followup(uuid, uuid);
--   drop function if exists public.bty_foundry_submit_followup(uuid, uuid, text);
--   drop function if exists public.bty_foundry_materialize_followup(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz);
--   drop table if exists public.foundry_participant_followup_audit;
--   drop table if exists public.foundry_participant_followups;
-- ===========================================================================

-- 1. The per-participant follow-up OBLIGATION.
create table if not exists public.foundry_participant_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  event_id uuid references public.foundry_events (id) on delete set null,
  progress_id uuid references public.foundry_event_training_progress (id) on delete set null,
  assignment_id uuid references public.foundry_event_assignments (id) on delete set null,
  user_id_snapshot uuid not null,

  source_training_title text not null,
  follow_up_days integer not null,
  completed_at timestamptz not null,

  timezone_snapshot text not null,
  completion_bty_day date not null,
  due_bty_day date not null,
  due_at timestamptz not null,

  status text not null default 'PENDING',
  outcome text,
  responded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- V1 checkpoint domain (0 = "none" never materializes a row).
  constraint foundry_followup_days_check check (follow_up_days in (7, 30)),
  -- state machine domain.
  constraint foundry_followup_status_check check (status in ('PENDING', 'RESPONDED')),
  -- outcome exists iff RESPONDED, and only from the allowed learner-reported set.
  constraint foundry_followup_outcome_shape_check check (
    (status = 'PENDING' and outcome is null)
    or (status = 'RESPONDED' and outcome in ('APPLIED', 'PARTLY_APPLIED', 'NOT_YET', 'BLOCKED'))
  ),
  -- responded_at exists iff RESPONDED.
  constraint foundry_followup_responded_at_shape_check check (
    (status = 'PENDING' and responded_at is null)
    or (status = 'RESPONDED' and responded_at is not null)
  ),
  constraint foundry_followup_title_len_check check (char_length(btrim(source_training_title)) between 1 and 300),
  -- IDEMPOTENCY: one obligation per completed progress per checkpoint.
  constraint foundry_followup_unique_progress_checkpoint unique (progress_id, follow_up_days)
);

-- Hot path: the Today reminder read (owner's pending, dated obligations).
create index if not exists foundry_followups_owner_due_idx
  on public.foundry_participant_followups (user_id_snapshot, status, due_at);
-- Host per-event projection.
create index if not exists foundry_followups_event_idx
  on public.foundry_participant_followups (event_id);

revoke all on public.foundry_participant_followups from anon, public, authenticated;
alter table public.foundry_participant_followups enable row level security;

-- 2. Append-only AUDIT (mandatory). Minimum structured evidence only — never any
--    reflection / shared response / AI output / free text.
create table if not exists public.foundry_participant_followup_audit (
  id uuid primary key default gen_random_uuid(),
  followup_id uuid not null,
  event_id uuid,
  user_id_snapshot uuid not null,
  event_type text not null,
  previous_status text,
  new_status text not null,
  outcome text,
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  constraint foundry_followup_audit_event_type_check check (event_type in ('CREATED', 'RESPONDED'))
);

create index if not exists foundry_followup_audit_followup_idx
  on public.foundry_participant_followup_audit (followup_id, created_at desc);

revoke all on public.foundry_participant_followup_audit from anon, public, authenticated;
alter table public.foundry_participant_followup_audit enable row level security;

-- 3. MATERIALIZE — idempotent create + CREATED audit (service-role only).
--    All time math (BTY day / DST-safe due instant) is computed by the caller and
--    passed in; this function only persists atomically and audits a fresh insert.
--    ON CONFLICT DO NOTHING guarantees exactly-once per (progress_id, checkpoint)
--    across repeated completion / claim / reload / relaunch / XP retry.
create or replace function public.bty_foundry_materialize_followup(
  p_event_id uuid,
  p_progress_id uuid,
  p_assignment_id uuid,
  p_organization_id uuid,
  p_user_id_snapshot uuid,
  p_source_training_title text,
  p_follow_up_days integer,
  p_completed_at timestamptz,
  p_timezone_snapshot text,
  p_completion_bty_day date,
  p_due_bty_day date,
  p_due_at timestamptz
)
returns table (result text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_id uuid;
begin
  if p_follow_up_days not in (7, 30) then
    return query select 'skipped'::text;
    return;
  end if;
  if p_user_id_snapshot is null or p_progress_id is null then
    return query select 'skipped'::text;
    return;
  end if;

  insert into public.foundry_participant_followups (
    organization_id, event_id, progress_id, assignment_id, user_id_snapshot,
    source_training_title, follow_up_days, completed_at,
    timezone_snapshot, completion_bty_day, due_bty_day, due_at,
    status
  )
  values (
    p_organization_id, p_event_id, p_progress_id, p_assignment_id, p_user_id_snapshot,
    btrim(p_source_training_title), p_follow_up_days, p_completed_at,
    p_timezone_snapshot, p_completion_bty_day, p_due_bty_day, p_due_at,
    'PENDING'
  )
  on conflict (progress_id, follow_up_days) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    return query select 'exists'::text;
    return;
  end if;

  insert into public.foundry_participant_followup_audit
    (followup_id, event_id, user_id_snapshot, event_type, previous_status, new_status, outcome, actor_user_id)
  values
    (v_new_id, p_event_id, p_user_id_snapshot, 'CREATED', null, 'PENDING', null, p_user_id_snapshot);

  return query select 'created'::text;
end
$$;

revoke all on function public.bty_foundry_materialize_followup(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz)
  from anon, public, authenticated;
grant execute on function public.bty_foundry_materialize_followup(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz)
  to service_role;

-- 4. SUBMIT OUTCOME — locked PENDING->RESPONDED exactly once + RESPONDED audit.
--    Owner-verified (auth user must equal user_id_snapshot). A conflicting second
--    outcome NEVER overwrites the first (returns already_responded + settled state);
--    an identical resubmission is idempotent (unchanged). Touches NOTHING else.
create or replace function public.bty_foundry_submit_followup(
  p_followup_id uuid,
  p_auth_user_id uuid,
  p_outcome text
)
returns table (result text, status text, outcome text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row record;
begin
  if p_outcome not in ('APPLIED', 'PARTLY_APPLIED', 'NOT_YET', 'BLOCKED') then
    return query select 'invalid_outcome'::text, null::text, null::text;
    return;
  end if;

  select id, user_id_snapshot, status, outcome, event_id
    into v_row
    from public.foundry_participant_followups
   where id = p_followup_id
   for update;

  if v_row.id is null then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;
  if v_row.user_id_snapshot is distinct from p_auth_user_id then
    return query select 'not_owner'::text, null::text, null::text;
    return;
  end if;

  if v_row.status = 'RESPONDED' then
    if v_row.outcome = p_outcome then
      -- idempotent identical resubmission
      return query select 'unchanged'::text, v_row.status, v_row.outcome;
    else
      -- conflicting second outcome must NOT silently overwrite the first
      return query select 'already_responded'::text, v_row.status, v_row.outcome;
    end if;
  end if;

  update public.foundry_participant_followups
     set status = 'RESPONDED',
         outcome = p_outcome,
         responded_at = now(),
         updated_at = now()
   where id = p_followup_id;

  insert into public.foundry_participant_followup_audit
    (followup_id, event_id, user_id_snapshot, event_type, previous_status, new_status, outcome, actor_user_id)
  values
    (p_followup_id, v_row.event_id, p_auth_user_id, 'RESPONDED', 'PENDING', 'RESPONDED', p_outcome, p_auth_user_id);

  return query select 'responded'::text, 'RESPONDED'::text, p_outcome;
end
$$;

revoke all on function public.bty_foundry_submit_followup(uuid, uuid, text)
  from anon, public, authenticated;
grant execute on function public.bty_foundry_submit_followup(uuid, uuid, text)
  to service_role;

-- 5. LEARNER READ — one obligation, owner-scoped (returns nothing if not owned).
--    SECURITY DEFINER defense-in-depth: even if grants change, only the caller's
--    own snapshot rows are ever returned. No private text exists in this table.
create or replace function public.bty_foundry_get_my_followup(
  p_auth_user_id uuid,
  p_followup_id uuid
)
returns table (
  id uuid,
  event_id uuid,
  source_training_title text,
  follow_up_days integer,
  completed_at timestamptz,
  due_at timestamptz,
  due_bty_day date,
  status text,
  outcome text,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    f.id, f.event_id, f.source_training_title, f.follow_up_days, f.completed_at,
    f.due_at, f.due_bty_day, f.status, f.outcome, f.responded_at
  from public.foundry_participant_followups f
  where f.id = p_followup_id
    and f.user_id_snapshot = p_auth_user_id;
$$;

revoke execute on function public.bty_foundry_get_my_followup(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_get_my_followup(uuid, uuid)
  to service_role;

-- ===========================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_foundry_get_my_followup(uuid, uuid);
--   drop function if exists public.bty_foundry_submit_followup(uuid, uuid, text);
--   drop function if exists public.bty_foundry_materialize_followup(uuid, uuid, uuid, uuid, uuid, text, integer, timestamptz, text, date, date, timestamptz);
--   drop table if exists public.foundry_participant_followup_audit;
--   drop table if exists public.foundry_participant_followups;
-- ===========================================================================
