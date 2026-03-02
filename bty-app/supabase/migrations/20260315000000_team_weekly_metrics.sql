-- =============================================================================
-- Leadership Engine P4: TeamWeeklyMetrics — weekly TII snapshot storage.
--
-- Snapshots are immutable once stored: INSERT only; no UPDATE/DELETE.
-- Ref: docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md §4 P4 (Infrastructure),
--      docs/TII_WEEKLY_JOB_SPEC.md, docs/LEADERSHIP_ENGINE_SPEC.md §6.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. team_weekly_metrics — one row per team per week (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.team_weekly_metrics (
  team_id    text        not null,
  week_start date        not null,
  tii        numeric(5,4) not null check (tii >= 0 and tii <= 1),
  avg_air    numeric(5,4) not null check (avg_air >= 0 and avg_air <= 1),
  avg_mwd    numeric(5,4) not null check (avg_mwd >= 0),
  tsp        numeric(3,2) not null check (tsp >= 1 and tsp <= 5),
  created_at timestamptz  not null default now(),
  primary key (team_id, week_start)
);

comment on table public.team_weekly_metrics is 'Immutable weekly TII snapshots per team. Insert-only; no update/delete. Filled by P4 weekly recomputation job.';
comment on column public.team_weekly_metrics.team_id is 'Team (or league) identifier.';
comment on column public.team_weekly_metrics.week_start is 'Week boundary date (e.g. Monday).';
comment on column public.team_weekly_metrics.tii is 'Team Integrity Index 0..1.';
comment on column public.team_weekly_metrics.avg_air is 'Team average AIR (0..1). Individual AIR never stored per user.';
comment on column public.team_weekly_metrics.avg_mwd is 'Team average MWD (Micro Win Density).';
comment on column public.team_weekly_metrics.tsp is 'Team Stability Pulse 1..5.';
comment on column public.team_weekly_metrics.created_at is 'When the snapshot was written (audit).';

-- Index for "latest week per team" and "weeks for a team" queries.
create index if not exists team_weekly_metrics_week_start_idx
  on public.team_weekly_metrics (week_start desc);

-- ---------------------------------------------------------------------------
-- 2. Immutability: block UPDATE and DELETE
-- ---------------------------------------------------------------------------

create or replace function public.team_weekly_metrics_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'team_weekly_metrics is immutable: update and delete are not allowed'
    using errcode = 'P0001';
end;
$$;

comment on function public.team_weekly_metrics_immutable() is 'Trigger function: prevents UPDATE/DELETE on team_weekly_metrics.';

drop trigger if exists team_weekly_metrics_immutable_trigger on public.team_weekly_metrics;
create trigger team_weekly_metrics_immutable_trigger
  before update or delete on public.team_weekly_metrics
  for each row
  execute function public.team_weekly_metrics_immutable();

-- ---------------------------------------------------------------------------
-- 3. RLS: read for authenticated (team TII is public); insert via service only
-- ---------------------------------------------------------------------------

alter table public.team_weekly_metrics enable row level security;

-- Anyone authenticated can read (team score is public per spec).
drop policy if exists "team_weekly_metrics_select" on public.team_weekly_metrics;
create policy "team_weekly_metrics_select"
  on public.team_weekly_metrics for select
  to authenticated
  using (true);

-- Insert: only service_role (weekly job). No policy = only roles that bypass RLS can insert.
-- So application/job must use service_role key to insert; authenticated cannot insert.
-- Optional: explicit policy for service_role if needed; in Supabase service_role bypasses RLS by default.

-- ---------------------------------------------------------------------------
-- Rollback (run manually if reverting this migration):
--   DROP TRIGGER IF EXISTS team_weekly_metrics_immutable_trigger ON public.team_weekly_metrics;
--   DROP FUNCTION IF EXISTS public.team_weekly_metrics_immutable();
--   DROP TABLE IF EXISTS public.team_weekly_metrics CASCADE;
-- ---------------------------------------------------------------------------
