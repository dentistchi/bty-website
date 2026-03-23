-- Awakening / RENEWAL stage milestone completions (engine AWAKENING_MILESTONES).

create table if not exists public.user_awakening_milestones (
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

comment on table public.user_awakening_milestones is
  'Rows inserted when a RENEWAL awakening milestone is satisfied; see engine awakening-phase.service.';

create index if not exists user_awakening_milestones_user_idx
  on public.user_awakening_milestones (user_id, completed_at desc);

alter table public.user_awakening_milestones enable row level security;

drop policy if exists "user_awakening_milestones_select_own" on public.user_awakening_milestones;
create policy "user_awakening_milestones_select_own"
on public.user_awakening_milestones for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_awakening_milestones_insert_own" on public.user_awakening_milestones;
create policy "user_awakening_milestones_insert_own"
on public.user_awakening_milestones for insert
to authenticated
with check (auth.uid() = user_id);
