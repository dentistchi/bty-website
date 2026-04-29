-- Weekly reflection quest: claim once per week when user has 3+ reflections (REFLECTION_SELECTED or BEGINNER_REFLECTION).
-- Week = Monday 00:00 UTC.

create table if not exists public.arena_weekly_quest_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  quest_type text not null default 'reflection',
  created_at timestamptz not null default now(),
  primary key (user_id, week_start, quest_type)
);

comment on table public.arena_weekly_quest_claims is 'One row per user per week per quest type when bonus is claimed (e.g. +15 Seasonal XP for 3 reflections).';

alter table public.arena_weekly_quest_claims enable row level security;

drop policy if exists "weekly_quest_claims_select_own" on public.arena_weekly_quest_claims;
create policy "weekly_quest_claims_select_own"
  on public.arena_weekly_quest_claims for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "weekly_quest_claims_insert_own" on public.arena_weekly_quest_claims;
create policy "weekly_quest_claims_insert_own"
  on public.arena_weekly_quest_claims for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists arena_weekly_quest_claims_user_week_idx
  on public.arena_weekly_quest_claims(user_id, week_start);
