-- Q4 Healing/Awakening: linear act completion (1→2→3). POST /api/bty/healing/progress
create table if not exists public.user_healing_awakening_acts (
  user_id uuid not null references auth.users (id) on delete cascade,
  act_id smallint not null check (act_id >= 1 and act_id <= 3),
  completed_at timestamptz not null default now(),
  primary key (user_id, act_id)
);

alter table public.user_healing_awakening_acts enable row level security;

drop policy if exists "user_healing_awakening_acts_select_own" on public.user_healing_awakening_acts;
create policy "user_healing_awakening_acts_select_own" on public.user_healing_awakening_acts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_healing_awakening_acts_insert_own" on public.user_healing_awakening_acts;
create policy "user_healing_awakening_acts_insert_own" on public.user_healing_awakening_acts
  for insert to authenticated with check (auth.uid() = user_id);

comment on table public.user_healing_awakening_acts is 'Second Awakening act 1–3 completions per user; order enforced in API.';
