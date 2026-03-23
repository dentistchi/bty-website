-- Per-user Foundry program progress (select → completion % → completed_at).

create table if not exists public.user_program_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id text not null references public.program_catalog (program_id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completion_pct numeric not null default 0 check (completion_pct >= 0 and completion_pct <= 100),
  primary key (user_id, program_id)
);

comment on table public.user_program_progress is
  'Foundry learning program progress; completion_pct 100 sets completed_at and triggers queue refresh.';

create index if not exists user_program_progress_user_idx
  on public.user_program_progress (user_id, started_at desc);

alter table public.user_program_progress enable row level security;

drop policy if exists "user_program_progress_select_own" on public.user_program_progress;
create policy "user_program_progress_select_own"
  on public.user_program_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_program_progress_insert_own" on public.user_program_progress;
create policy "user_program_progress_insert_own"
  on public.user_program_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_program_progress_update_own" on public.user_program_progress;
create policy "user_program_progress_update_own"
  on public.user_program_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
