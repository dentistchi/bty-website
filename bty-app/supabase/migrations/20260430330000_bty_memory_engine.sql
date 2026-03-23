-- BTY Memory Engine: behavior-memory events, aggregated pattern state, recall log, trigger queue (delayed outcome / perspective prep).

-- 1) Append-only events (choice-grain; engine may enrich beyond scenario_choice_history).
create table if not exists public.user_behavior_memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id text not null,
  choice_id text not null,
  flag_type text not null,
  played_at timestamptz not null,
  source text not null default 'arena_choice_confirmed',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.user_behavior_memory_events is
  'BTY Memory Engine: append-only choice events for pattern detection and recall.';

create index if not exists user_behavior_memory_events_user_played_idx
  on public.user_behavior_memory_events (user_id, played_at desc);
create index if not exists user_behavior_memory_events_user_flag_idx
  on public.user_behavior_memory_events (user_id, flag_type, played_at desc);

alter table public.user_behavior_memory_events enable row level security;

drop policy if exists "user_behavior_memory_events_select_own" on public.user_behavior_memory_events;
create policy "user_behavior_memory_events_select_own"
  on public.user_behavior_memory_events for select
  to authenticated
  using (auth.uid() = user_id);

-- 2) Aggregated pattern state per user (repeated flags, streaks).
create table if not exists public.user_behavior_pattern_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_key text not null,
  total_count integer not null default 0 check (total_count >= 0),
  consecutive_count integer not null default 0 check (consecutive_count >= 0),
  last_flag_type text,
  last_occurred_at timestamptz,
  updated_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  primary key (user_id, pattern_key)
);

comment on table public.user_behavior_pattern_state is
  'BTY Memory Engine: rolling aggregates per pattern_key (e.g. flag_total:INTENT, consecutive:INTENT).';

create index if not exists user_behavior_pattern_state_user_updated_idx
  on public.user_behavior_pattern_state (user_id, updated_at desc);

alter table public.user_behavior_pattern_state enable row level security;

drop policy if exists "user_behavior_pattern_state_select_own" on public.user_behavior_pattern_state;
create policy "user_behavior_pattern_state_select_own"
  on public.user_behavior_pattern_state for select
  to authenticated
  using (auth.uid() = user_id);

-- 3) Recall surfaced to user (narrative / UI / mentor hooks).
create table if not exists public.user_memory_recall_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recall_kind text not null,
  triggered_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  related_event_ids uuid[] default null
);

comment on table public.user_memory_recall_log is
  'BTY Memory Engine: log when a memory recall was shown or emitted.';

create index if not exists user_memory_recall_log_user_triggered_idx
  on public.user_memory_recall_log (user_id, triggered_at desc);

alter table public.user_memory_recall_log enable row level security;

drop policy if exists "user_memory_recall_log_select_own" on public.user_memory_recall_log;
create policy "user_memory_recall_log_select_own"
  on public.user_memory_recall_log for select
  to authenticated
  using (auth.uid() = user_id);

-- 4) Queue for delayed outcome, perspective-switch, recall (scaffold; processor TBD).
create table if not exists public.user_memory_trigger_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger_type text not null
    check (trigger_type in (
      'delayed_outcome',
      'perspective_switch',
      'recall_prompt',
      'memory_pattern_threshold'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'cancelled', 'failed')),
  due_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

comment on table public.user_memory_trigger_queue is
  'BTY Memory Engine: pending triggers for delayed outcomes / perspective / recall (consumer not fully wired).';

create index if not exists user_memory_trigger_queue_user_status_due_idx
  on public.user_memory_trigger_queue (user_id, status, due_at nulls last);
create index if not exists user_memory_trigger_queue_pending_due_idx
  on public.user_memory_trigger_queue (status, due_at nulls last)
  where status = 'pending';

alter table public.user_memory_trigger_queue enable row level security;

drop policy if exists "user_memory_trigger_queue_select_own" on public.user_memory_trigger_queue;
create policy "user_memory_trigger_queue_select_own"
  on public.user_memory_trigger_queue for select
  to authenticated
  using (auth.uid() = user_id);
