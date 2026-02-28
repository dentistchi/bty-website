-- Second Awakening (30-day ritual) completion tracking.
-- Ref: docs/specs/healing-coaching-spec-v3.json second_awakening_event

create table if not exists public.user_healing_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  second_awakening_completed_at timestamptz,
  starter_unlock_granted text check (starter_unlock_granted is null or starter_unlock_granted in ('PRM','SAG')),
  primary key (user_id)
);

alter table public.user_healing_milestones enable row level security;

drop policy if exists "user_healing_milestones_select_own" on public.user_healing_milestones;
create policy "user_healing_milestones_select_own" on public.user_healing_milestones
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "user_healing_milestones_insert_own" on public.user_healing_milestones;
create policy "user_healing_milestones_insert_own" on public.user_healing_milestones
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "user_healing_milestones_update_own" on public.user_healing_milestones;
create policy "user_healing_milestones_update_own" on public.user_healing_milestones
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.user_healing_milestones is 'Second Awakening (30-day) ritual completion; starter unlock (PRM/SAG) when none met.';
