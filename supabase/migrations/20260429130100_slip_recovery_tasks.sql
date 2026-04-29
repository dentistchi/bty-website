-- Slip-driven recovery assignments (severity gate + task type from slip reason).

create table if not exists public.slip_recovery_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_type text not null
    check (task_type in ('reflection_letter', 'mentor_session', 'scenario_retry', 'dojo_assessment')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz null,
  slip_severity numeric not null,
  slip_reason text not null,
  created_at timestamptz not null default now()
);

comment on table public.slip_recovery_tasks is
  'Assigned when slip severity crosses threshold; completion verified against Center/Foundry tables.';

create index if not exists slip_recovery_tasks_user_open_idx
  on public.slip_recovery_tasks (user_id, assigned_at desc)
  where completed_at is null;

create index if not exists slip_recovery_tasks_user_idx on public.slip_recovery_tasks (user_id, assigned_at desc);

alter table public.slip_recovery_tasks enable row level security;

drop policy if exists "slip_recovery_tasks_select_own" on public.slip_recovery_tasks;
create policy "slip_recovery_tasks_select_own"
  on public.slip_recovery_tasks for select to authenticated
  using (auth.uid() = user_id);
