# Supabase Arena – 복사해서 붙여넣기용 SQL

Supabase 대시보드 → **SQL Editor**에서 아래 블록을 **순서대로** 실행하세요.  
이미 적용된 부분이 있으면 해당 블록은 건너뛰어도 됩니다.

---

## 1) 기본 Arena 스키마 (처음 한 번만)

```sql
-- BTY Arena core schema (event-sourcing)
create extension if not exists "pgcrypto";

create table if not exists public.arena_leagues (
  league_id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_lifetime_xp int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.arena_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifetime_xp int not null default 0,
  weekly_xp int not null default 0,
  streak int not null default 0,
  league_id uuid references public.arena_leagues(league_id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.arena_runs (
  run_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  locale text,
  status text not null default 'IN_PROGRESS',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_xp int not null default 0
);

create index if not exists arena_runs_user_started_idx on public.arena_runs(user_id, started_at desc);

create table if not exists public.arena_events (
  event_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.arena_runs(run_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step int not null,
  event_type text not null,
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

alter table public.arena_leagues enable row level security;
alter table public.arena_profiles enable row level security;
alter table public.arena_runs enable row level security;
alter table public.arena_events enable row level security;

drop policy if exists "leagues_read_all" on public.arena_leagues;
create policy "leagues_read_all" on public.arena_leagues for select to authenticated using (true);

drop policy if exists "profiles_select_own" on public.arena_profiles;
create policy "profiles_select_own" on public.arena_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "profiles_upsert_own" on public.arena_profiles;
create policy "profiles_upsert_own" on public.arena_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.arena_profiles;
create policy "profiles_update_own" on public.arena_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "runs_select_own" on public.arena_runs;
create policy "runs_select_own" on public.arena_runs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "runs_insert_own" on public.arena_runs;
create policy "runs_insert_own" on public.arena_runs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "runs_update_own" on public.arena_runs;
create policy "runs_update_own" on public.arena_runs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "events_select_own" on public.arena_events;
create policy "events_select_own" on public.arena_events for select to authenticated using (auth.uid() = user_id);
drop policy if exists "events_insert_own" on public.arena_events;
create policy "events_insert_own" on public.arena_events for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.ensure_arena_profile()
returns void language plpgsql security definer as $$
begin
  insert into public.arena_profiles(user_id) values (auth.uid())
  on conflict (user_id) do nothing;
end;
$$;
revoke all on function public.ensure_arena_profile() from public;
grant execute on function public.ensure_arena_profile() to authenticated;

create or replace function public.increment_arena_xp(p_user_id uuid, p_run_id uuid, p_xp int)
returns void language plpgsql security definer as $$
begin
  if p_xp is null or p_xp <= 0 then return; end if;
  update public.arena_profiles set lifetime_xp = lifetime_xp + p_xp, weekly_xp = weekly_xp + p_xp, updated_at = now() where user_id = p_user_id;
  update public.arena_runs set total_xp = total_xp + p_xp where run_id = p_run_id and user_id = p_user_id;
end;
$$;
revoke all on function public.increment_arena_xp(uuid, uuid, int) from public;
grant execute on function public.increment_arena_xp(uuid, uuid, int) to authenticated;
```

---

## 2) weekly_xp 테이블 (Seasonal XP용)

```sql
create table if not exists public.weekly_xp (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid null,
  xp_total integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists weekly_xp_user_null_league_uq on public.weekly_xp(user_id) where league_id is null;
create unique index if not exists weekly_xp_user_league_uq on public.weekly_xp(user_id, league_id) where league_id is not null;

alter table public.weekly_xp enable row level security;

drop policy if exists "weekly_xp_select_own" on public.weekly_xp;
create policy "weekly_xp_select_own" on public.weekly_xp for select to authenticated using (user_id = auth.uid());
drop policy if exists "weekly_xp_insert_own" on public.weekly_xp;
create policy "weekly_xp_insert_own" on public.weekly_xp for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "weekly_xp_update_own" on public.weekly_xp;
create policy "weekly_xp_update_own" on public.weekly_xp for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```

---

## 3) 리그 30일 윈도우 (start_at, end_at)

```sql
alter table public.arena_leagues
  add column if not exists start_at timestamptz null,
  add column if not exists end_at timestamptz null;

comment on column public.arena_leagues.start_at is 'League window start (inclusive).';
comment on column public.arena_leagues.end_at is 'League window end (inclusive).';

create index if not exists arena_leagues_window_idx
  on public.arena_leagues(start_at, end_at)
  where start_at is not null and end_at is not null;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'weekly_xp') then
    drop policy if exists "weekly_xp_select_leaderboard" on public.weekly_xp;
    create policy "weekly_xp_select_leaderboard" on public.weekly_xp for select to authenticated using (true);
  end if;
end $$;
```

---

## 4) Dual XP / Tier / Code / Sub Name (arena_profiles 컬럼)

```sql
alter table public.arena_profiles
  add column if not exists core_xp_total int not null default 0,
  add column if not exists core_xp_buffer numeric not null default 0,
  add column if not exists tier int not null default 0,
  add column if not exists code_index int not null default 0,
  add column if not exists sub_name text null,
  add column if not exists sub_name_renamed_in_code boolean not null default false,
  add column if not exists stage int not null default 1,
  add column if not exists code_name text null,
  add column if not exists code_hidden boolean not null default false;

comment on column public.arena_profiles.core_xp_total is 'Permanent Core XP (displayed). Tier = floor(core_xp_total/10) internally.';
comment on column public.arena_profiles.core_xp_buffer is 'Fractional buffer for seasonal→core conversion.';
comment on column public.arena_profiles.tier is 'Internal: floor(core_xp_total/10). Not shown to user.';
comment on column public.arena_profiles.code_index is '0-6: FORGE,PULSE,FRAME,ASCEND,NOVA,ARCHITECT,CODELESS ZONE.';
comment on column public.arena_profiles.sub_name is 'User-renamed (Tier 25 once per code) or default from spec.';
comment on column public.arena_profiles.sub_name_renamed_in_code is 'True if user used the one-time rename in current code.';
```

---

## 5) Beginner 런 (arena_runs 컬럼)

```sql
alter table public.arena_runs
  add column if not exists run_type text not null default 'scenario',
  add column if not exists beginner_maturity_score int null;

comment on column public.arena_runs.run_type is 'scenario | beginner';
comment on column public.arena_runs.beginner_maturity_score is '0-20 maturity score when run_type=beginner.';
```

---

## 6) 주간 성찰 퀘스트 테이블 (신규)

```sql
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
create policy "weekly_quest_claims_select_own" on public.arena_weekly_quest_claims for select to authenticated using (auth.uid() = user_id);

drop policy if exists "weekly_quest_claims_insert_own" on public.arena_weekly_quest_claims;
create policy "weekly_quest_claims_insert_own" on public.arena_weekly_quest_claims for insert to authenticated with check (auth.uid() = user_id);

create index if not exists arena_weekly_quest_claims_user_week_idx on public.arena_weekly_quest_claims(user_id, week_start);
```

---

## 7) 시즌 종료 10% 캐리오버 함수 (신규)

```sql
create or replace function public.run_season_carryover()
returns void
language sql
security definer
set search_path = public
as $$
  update public.weekly_xp
  set xp_total = floor(greatest(0, xp_total) * 0.1)
  where league_id is null;
$$;

comment on function public.run_season_carryover is 'BTY Arena: at season end, set Seasonal XP to 10% of current. Call before creating a new league.';
```

---

## 한 번에 전부 실행하려면

위 **1) ~ 7)** 블록을 순서대로 이어 붙여서 SQL Editor에 한 번에 붙여넣고 Run 해도 됩니다.  
이미 있는 객체는 `if not exists` / `drop policy if exists` / `create or replace` 로 덮어쓰기만 하므로, 필요한 부분만 골라서 실행해도 됩니다.
