-- Emotional stats (Core6 + Advanced unlocks). Arena XP / leaderboard와 분리.
-- Ref: docs/SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md, docs/specs/healing-coaching-spec-v3.json

-- 1) Core stat values per user (EA, RS, BS, TI, RC, RD)
create table if not exists public.user_emotional_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  stat_id text not null check (stat_id in ('EA','RS','BS','TI','RC','RD')),
  value numeric not null default 0 check (value >= 0 and value <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, stat_id)
);

create index if not exists user_emotional_stats_user_updated_idx
  on public.user_emotional_stats(user_id, updated_at desc);

alter table public.user_emotional_stats enable row level security;

drop policy if exists "user_emotional_stats_select_own" on public.user_emotional_stats;
create policy "user_emotional_stats_select_own" on public.user_emotional_stats
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "user_emotional_stats_insert_own" on public.user_emotional_stats;
create policy "user_emotional_stats_insert_own" on public.user_emotional_stats
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "user_emotional_stats_update_own" on public.user_emotional_stats;
create policy "user_emotional_stats_update_own" on public.user_emotional_stats
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Sessions (for Q calculation and rapid_session_penalty)
create table if not exists public.emotional_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists emotional_sessions_user_started_idx
  on public.emotional_sessions(user_id, started_at desc);

alter table public.emotional_sessions enable row level security;

drop policy if exists "emotional_sessions_select_own" on public.emotional_sessions;
create policy "emotional_sessions_select_own" on public.emotional_sessions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "emotional_sessions_insert_own" on public.emotional_sessions;
create policy "emotional_sessions_insert_own" on public.emotional_sessions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "emotional_sessions_update_own" on public.emotional_sessions;
create policy "emotional_sessions_update_own" on public.emotional_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Event log (for Q and event counts)
create table if not exists public.emotional_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  session_id uuid references public.emotional_sessions(id) on delete set null,
  quality_weight numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists emotional_events_user_created_idx
  on public.emotional_events(user_id, created_at desc);
create index if not exists emotional_events_session_idx
  on public.emotional_events(session_id) where session_id is not null;

alter table public.emotional_events enable row level security;

drop policy if exists "emotional_events_select_own" on public.emotional_events;
create policy "emotional_events_select_own" on public.emotional_events
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "emotional_events_insert_own" on public.emotional_events;
create policy "emotional_events_insert_own" on public.emotional_events
  for insert to authenticated with check (auth.uid() = user_id);

-- 4) Advanced stat unlocks
create table if not exists public.user_advanced_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  advanced_stat_name text not null check (advanced_stat_name in ('PRM','SAG','EL','CNS','CD','IS')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, advanced_stat_name)
);

create index if not exists user_advanced_unlocks_user_idx
  on public.user_advanced_unlocks(user_id);

alter table public.user_advanced_unlocks enable row level security;

drop policy if exists "user_advanced_unlocks_select_own" on public.user_advanced_unlocks;
create policy "user_advanced_unlocks_select_own" on public.user_advanced_unlocks
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "user_advanced_unlocks_insert_own" on public.user_advanced_unlocks;
create policy "user_advanced_unlocks_insert_own" on public.user_advanced_unlocks
  for insert to authenticated with check (auth.uid() = user_id);

comment on table public.user_emotional_stats is 'Core6 emotional stat values per user. Not used for Arena XP/leaderboard.';
comment on table public.emotional_sessions is 'Sessions for emotional stat Q calculation and anti-exploit.';
comment on table public.emotional_events is 'Event log for session quality and unlock counts.';
comment on table public.user_advanced_unlocks is 'Advanced stat unlock records (PRM, SAG, EL, CNS, CD, IS).';
