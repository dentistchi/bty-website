-- 5-step BTY onboarding (locale → profile → first Arena → AIR baseline → Foundry path).

create table if not exists public.user_onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  step_completed int not null default 0 check (step_completed >= 0 and step_completed <= 5),
  completed_at timestamptz not null default now()
);

comment on table public.user_onboarding_progress is
  'Highest completed onboarding step (0–5); see onboarding-flow.service.';

create index if not exists user_onboarding_progress_completed_at_idx
  on public.user_onboarding_progress (completed_at desc);

alter table public.user_onboarding_progress enable row level security;

drop policy if exists "user_onboarding_progress_select_own" on public.user_onboarding_progress;
create policy "user_onboarding_progress_select_own"
  on public.user_onboarding_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_onboarding_progress_insert_own" on public.user_onboarding_progress;
create policy "user_onboarding_progress_insert_own"
  on public.user_onboarding_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_onboarding_progress_update_own" on public.user_onboarding_progress;
create policy "user_onboarding_progress_update_own"
  on public.user_onboarding_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
