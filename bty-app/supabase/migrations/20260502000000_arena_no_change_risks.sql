create table if not exists public.arena_no_change_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  incident_id text not null,
  scenario_id text not null,
  db_scenario_id text not null,
  axis_group text not null,
  axis_index integer not null,
  pattern_family text not null,
  action_choice_id text not null,
  action_db_choice_id text not null,
  risk_count integer not null default 1 check (risk_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists arena_no_change_risks_user_incident_axis_pattern_action_uidx
  on public.arena_no_change_risks (
    user_id,
    incident_id,
    axis_group,
    axis_index,
    pattern_family,
    action_choice_id,
    action_db_choice_id
  );

create index if not exists arena_no_change_risks_user_incident_axis_idx
  on public.arena_no_change_risks (user_id, incident_id, axis_group);

alter table public.arena_no_change_risks enable row level security;

drop policy if exists "arena_no_change_risks_select_own" on public.arena_no_change_risks;
create policy "arena_no_change_risks_select_own"
  on public.arena_no_change_risks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "arena_no_change_risks_insert_own" on public.arena_no_change_risks;
create policy "arena_no_change_risks_insert_own"
  on public.arena_no_change_risks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "arena_no_change_risks_update_own" on public.arena_no_change_risks;
create policy "arena_no_change_risks_update_own"
  on public.arena_no_change_risks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
