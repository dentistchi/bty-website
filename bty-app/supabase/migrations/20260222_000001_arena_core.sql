-- BTY Arena core schema (event-sourcing)
-- MVP: auth.uid() 기반 (로그인 유저 전용)

create extension if not exists "pgcrypto";

-- 1) leagues (optional, minimal)
create table if not exists public.arena_leagues (
  league_id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_lifetime_xp int not null default 0,
  created_at timestamptz not null default now()
);

-- 2) profiles (one per user)
create table if not exists public.arena_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifetime_xp int not null default 0,
  weekly_xp int not null default 0,
  streak int not null default 0,
  league_id uuid references public.arena_leagues(league_id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 3) runs (a session for a scenario playthrough)
create table if not exists public.arena_runs (
  run_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  locale text,
  status text not null default 'IN_PROGRESS', -- IN_PROGRESS | DONE | ABANDONED
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_xp int not null default 0
);

create index if not exists arena_runs_user_started_idx on public.arena_runs(user_id, started_at desc);

-- 4) events (append-only log)
create table if not exists public.arena_events (
  event_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.arena_runs(run_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step int not null, -- 1..N
  event_type text not null, -- CHOICE_CONFIRMED | FOLLOW_UP_SELECTED | RUN_COMPLETED
  scenario_id text not null,
  choice_id text,
  follow_up_index int,
  xp int not null default 0,
  deltas jsonb,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists arena_events_run_created_idx on public.arena_events(run_id, created_at asc);
create index if not exists arena_events_user_created_idx on public.arena_events(user_id, created_at desc);

-- ---------- RLS ----------
alter table public.arena_leagues enable row level security;
alter table public.arena_profiles enable row level security;
alter table public.arena_runs enable row level security;
alter table public.arena_events enable row level security;

-- leagues: read-only 공개(랭킹/표시용). 쓰기는 관리자만(추후)
drop policy if exists "leagues_read_all" on public.arena_leagues;
create policy "leagues_read_all"
on public.arena_leagues for select
to authenticated
using (true);

-- profiles: 본인만
drop policy if exists "profiles_select_own" on public.arena_profiles;
create policy "profiles_select_own"
on public.arena_profiles for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_upsert_own" on public.arena_profiles;
create policy "profiles_upsert_own"
on public.arena_profiles for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.arena_profiles;
create policy "profiles_update_own"
on public.arena_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- runs: 본인만
drop policy if exists "runs_select_own" on public.arena_runs;
create policy "runs_select_own"
on public.arena_runs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "runs_insert_own" on public.arena_runs;
create policy "runs_insert_own"
on public.arena_runs for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "runs_update_own" on public.arena_runs;
create policy "runs_update_own"
on public.arena_runs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- events: 본인만 (run_id도 본인 run이어야 함)
drop policy if exists "events_select_own" on public.arena_events;
create policy "events_select_own"
on public.arena_events for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.arena_events;
create policy "events_insert_own"
on public.arena_events for insert
to authenticated
with check (auth.uid() = user_id);

-- ---------- helper: upsert profile on first event ----------
create or replace function public.ensure_arena_profile()
returns void
language plpgsql
security definer
as $$
begin
  insert into public.arena_profiles(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.ensure_arena_profile() from public;
grant execute on function public.ensure_arena_profile() to authenticated;

-- ---------- helper: increment XP (profile + run) ----------
create or replace function public.increment_arena_xp(p_user_id uuid, p_run_id uuid, p_xp int)
returns void
language plpgsql
security definer
as $$
begin
  if p_xp is null or p_xp <= 0 then
    return;
  end if;
  update public.arena_profiles
  set lifetime_xp = lifetime_xp + p_xp,
      weekly_xp = weekly_xp + p_xp,
      updated_at = now()
  where user_id = p_user_id;
  update public.arena_runs
  set total_xp = total_xp + p_xp
  where run_id = p_run_id and user_id = p_user_id;
end;
$$;

revoke all on function public.increment_arena_xp(uuid, uuid, int) from public;
grant execute on function public.increment_arena_xp(uuid, uuid, int) to authenticated;
