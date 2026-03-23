-- Post-session reflection prompts (HERO_TRAP / INTEGRITY_SLIP) and user-written responses.

create table if not exists public.scenario_feedback_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id text not null,
  flag_type text not null
    check (flag_type in ('HERO_TRAP', 'INTEGRITY_SLIP')),
  prompt_ko text not null,
  prompt_en text not null,
  created_at timestamptz not null default now()
);

comment on table public.scenario_feedback_queue is
  'Pending feedback prompts after summary dismiss; cleared from “pending” when a row exists in scenario_feedback_responses.';

create index if not exists scenario_feedback_queue_user_created_idx
  on public.scenario_feedback_queue (user_id, created_at asc);

alter table public.scenario_feedback_queue enable row level security;

drop policy if exists "scenario_feedback_queue_select_own" on public.scenario_feedback_queue;
create policy "scenario_feedback_queue_select_own"
  on public.scenario_feedback_queue for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "scenario_feedback_queue_insert_own" on public.scenario_feedback_queue;
create policy "scenario_feedback_queue_insert_own"
  on public.scenario_feedback_queue for insert to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.scenario_feedback_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id text not null,
  queue_id uuid not null references public.scenario_feedback_queue (id) on delete cascade,
  response_text text not null,
  created_at timestamptz not null default now(),
  unique (queue_id)
);

comment on table public.scenario_feedback_responses is
  'User-submitted reflection text; one response per queue row.';

create index if not exists scenario_feedback_responses_user_created_idx
  on public.scenario_feedback_responses (user_id, created_at desc);

alter table public.scenario_feedback_responses enable row level security;

drop policy if exists "scenario_feedback_responses_select_own" on public.scenario_feedback_responses;
create policy "scenario_feedback_responses_select_own"
  on public.scenario_feedback_responses for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "scenario_feedback_responses_insert_own" on public.scenario_feedback_responses;
create policy "scenario_feedback_responses_insert_own"
  on public.scenario_feedback_responses for insert to authenticated
  with check (auth.uid() = user_id);

-- Extend behavior pattern labels (see behavior-pattern.service).
alter table public.user_behavior_patterns
  drop constraint if exists user_behavior_patterns_pattern_type_check;

alter table public.user_behavior_patterns
  add constraint user_behavior_patterns_pattern_type_check
  check (
    pattern_type in (
      'dominant_pattern',
      'growth_signal',
      'integrity_streak',
      'feedback_signal'
    )
  );
