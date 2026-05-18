-- Align live `user_behavior_memory_events` with canonical schema in
-- 20260430330000_bty_memory_engine.sql when the table was created earlier without
-- `played_at` / `payload` (e.g. manual DDL or partial apply). `CREATE TABLE IF NOT EXISTS`
-- does not add missing columns on existing tables.

-- 1) played_at (nullable first → backfill → NOT NULL)
alter table public.user_behavior_memory_events
  add column if not exists played_at timestamptz;

update public.user_behavior_memory_events
set played_at = coalesce(played_at, created_at, now())
where played_at is null;

alter table public.user_behavior_memory_events
  alter column played_at set not null;

-- 2) payload (jsonb, default matches app insert)
alter table public.user_behavior_memory_events
  add column if not exists payload jsonb not null default '{}'::jsonb;

-- 3) source (defensive: code inserts source; older stubs may omit it)
alter table public.user_behavior_memory_events
  add column if not exists source text;

update public.user_behavior_memory_events
set source = coalesce(source, 'arena_choice_confirmed')
where source is null;

alter table public.user_behavior_memory_events
  alter column source set default 'arena_choice_confirmed';

alter table public.user_behavior_memory_events
  alter column source set not null;

-- 4) Indexes (safe if 20260430330000 indexes failed when played_at was missing)
create index if not exists user_behavior_memory_events_user_played_idx
  on public.user_behavior_memory_events (user_id, played_at desc);

create index if not exists user_behavior_memory_events_user_flag_idx
  on public.user_behavior_memory_events (user_id, flag_type, played_at desc);
