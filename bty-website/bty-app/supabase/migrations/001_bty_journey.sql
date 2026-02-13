-- BTY Journey: 28-day program progress
-- Run this in Supabase SQL Editor

-- User's journey profile (current day, start date)
create table if not exists bty_profiles (
  user_id text primary key,
  current_day int not null default 1 check (current_day >= 1 and current_day <= 28),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-day progress (reading done, missions, reflection)
create table if not exists bty_day_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  day int not null check (day >= 1 and day <= 28),
  completed boolean not null default false,
  mission_checks jsonb not null default '[]',  -- [0, 2] = mission 0, 2 completed
  reflection_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

-- RLS: users can only access their own data
alter table bty_profiles enable row level security;
alter table bty_day_entries enable row level security;

-- Custom auth: API verifies JWT; service role used from API
create policy "Allow all for custom auth"
  on bty_profiles for all using (true);

-- Custom auth: RLS disabled for entries; API verifies JWT and filters by user_id
create policy "Allow all for custom auth"
  on bty_day_entries for all using (true);

create index bty_day_entries_user_day on bty_day_entries (user_id, day);
