-- Per-choice CHOICE_CONFIRMED audit rows (distinct from aggregate `user_scenario_history.played_scenario_ids`).

create table if not exists public.user_scenario_choice_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id text not null,
  choice_id text not null,
  flag_type text not null,
  played_at timestamptz not null default now()
);

comment on table public.user_scenario_choice_history is
  'Arena CHOICE_CONFIRMED events: scenario_id, choice_id, flag_type, played_at.';

create index if not exists user_scenario_choice_history_user_played_idx
  on public.user_scenario_choice_history (user_id, played_at desc);

alter table public.user_scenario_choice_history enable row level security;

drop policy if exists "user_scenario_choice_history_select_own" on public.user_scenario_choice_history;
create policy "user_scenario_choice_history_select_own"
on public.user_scenario_choice_history for select
to authenticated
using (auth.uid() = user_id);
