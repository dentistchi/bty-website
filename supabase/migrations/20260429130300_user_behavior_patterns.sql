-- Detected behavior labels (dominant flag mix, AIR growth, CLEAN streak) for mentor / narrative.

create table if not exists public.user_behavior_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_type text not null
    check (pattern_type in ('dominant_pattern', 'growth_signal', 'integrity_streak')),
  detected_at timestamptz not null default now(),
  supporting_data jsonb not null default '{}'::jsonb,
  unique (user_id, pattern_type)
);

comment on table public.user_behavior_patterns is
  'Latest detection per pattern type per user; refreshed by behavior-pattern.service.';

create index if not exists user_behavior_patterns_user_idx
  on public.user_behavior_patterns (user_id, detected_at desc);

alter table public.user_behavior_patterns enable row level security;

drop policy if exists "user_behavior_patterns_select_own" on public.user_behavior_patterns;
create policy "user_behavior_patterns_select_own"
  on public.user_behavior_patterns for select to authenticated
  using (auth.uid() = user_id);
