-- ENGINE_ARCHITECTURE_V1.md §2–§5: pattern_signals cap, pattern_states.family_window_tally,
-- action contract approved + verified_at, re-trigger index, arena_runs.completion_state,
-- arena_level_records + consecutive_verified / cooldown.

-- ---------------------------------------------------------------------------
-- 1) pattern_signals (per-run cap: one row per run_id + pattern_family for steps 2–4)
-- ---------------------------------------------------------------------------
create table if not exists public.pattern_signals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.arena_runs (run_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_family text not null,
  direction text not null check (direction in ('entry', 'exit')),
  step smallint not null check (step >= 2 and step <= 4),
  recorded_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  constraint pattern_signals_family_not_legacy_explanation check (pattern_family <> 'explanation')
);

comment on table public.pattern_signals is
  'Pattern engine: discrete signals per run; max one row per (run_id, pattern_family) for steps 2–4 (ENGINE §5 rule 2). Window tally lives on pattern_states.family_window_tally.';

create index if not exists pattern_signals_user_recorded_idx
  on public.pattern_signals (user_id, recorded_at desc);

create unique index if not exists pattern_signals_run_family_unique
  on public.pattern_signals (run_id, pattern_family)
  where step >= 2 and step <= 4;

alter table public.pattern_signals enable row level security;

drop policy if exists "pattern_signals_select_own" on public.pattern_signals;
create policy "pattern_signals_select_own"
  on public.pattern_signals for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pattern_signals_insert_own" on public.pattern_signals;
create policy "pattern_signals_insert_own"
  on public.pattern_signals for insert to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2) pattern_states (rolling window bookkeeping; tally is not a "score")
-- ---------------------------------------------------------------------------
create table if not exists public.pattern_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_family text not null,
  window_run_ids uuid[] not null default '{}',
  family_window_tally numeric not null default 0,
  last_trigger_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, pattern_family),
  constraint pattern_states_family_not_legacy_explanation check (pattern_family <> 'explanation')
);

comment on table public.pattern_states is
  'Per-user pattern accumulation; family_window_tally = count of qualifying exit signals in the 7-run window (ENGINE §5 rule 3), not an XP score.';
comment on column public.pattern_states.family_window_tally is
  'Threshold evaluation tally (e.g. distinct runs with exit+f in window), not leaderboard score.';

create index if not exists pattern_states_user_idx on public.pattern_states (user_id);

alter table public.pattern_states enable row level security;

drop policy if exists "pattern_states_select_own" on public.pattern_states;
create policy "pattern_states_select_own"
  on public.pattern_states for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pattern_states_upsert_own" on public.pattern_states;
create policy "pattern_states_upsert_own"
  on public.pattern_states for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pattern_states_update_own" on public.pattern_states;
create policy "pattern_states_update_own"
  on public.pattern_states for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3) arena_runs — completion_state + Step 2 gate for 7-run window
-- ---------------------------------------------------------------------------
alter table public.arena_runs
  add column if not exists completion_state text,
  add column if not exists reached_step_2_at timestamptz,
  add column if not exists current_step smallint;

update public.arena_runs
set completion_state = 'in_progress'
where completion_state is null;

alter table public.arena_runs
  alter column completion_state set default 'in_progress';

alter table public.arena_runs
  drop constraint if exists arena_runs_completion_state_check;

alter table public.arena_runs
  add constraint arena_runs_completion_state_check check (
    completion_state in ('in_progress', 'locked_step7_abandoned', 'complete_verified')
  );

comment on column public.arena_runs.completion_state is
  'ENGINE §3: in_progress | locked_step7_abandoned | complete_verified (latter requires contract approved + verified_at).';
comment on column public.arena_runs.reached_step_2_at is
  'Set when run first reaches step >= 2; runs without this are excluded from pattern 7-run window (PATTERN_ACTION_MODEL §3).';

-- Backfill complete_verified where contract is already verified (legacy completed → approved below)
-- Applied after bty_action_contracts migration block uses approved + verified_at.

-- ---------------------------------------------------------------------------
-- 4) arena_level_records — consecutive_verified_completions + 72h cooldown
-- ---------------------------------------------------------------------------
create table if not exists public.arena_level_records (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_band text not null default 'mid',
  consecutive_verified_completions smallint not null default 0,
  abandon_count_window smallint not null default 0,
  consecutive_abandons smallint not null default 0,
  last_evaluation_at timestamptz not null default now(),
  cooldown_until timestamptz,
  last_band_change_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.arena_level_records is
  'ENGINE §5: level band evaluation; consecutive_verified_completions (not generic streak); cooldown_until = last_band_change + 72h.';
comment on column public.arena_level_records.consecutive_verified_completions is
  'Consecutive run-level complete_verified outcomes at current_band; broken by abandon / unresolved in_progress per ENGINE §5 rules 6–7.';

alter table public.arena_level_records enable row level security;

drop policy if exists "arena_level_records_select_own" on public.arena_level_records;
create policy "arena_level_records_select_own"
  on public.arena_level_records for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "arena_level_records_upsert_own" on public.arena_level_records;
create policy "arena_level_records_upsert_own"
  on public.arena_level_records for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "arena_level_records_update_own" on public.arena_level_records;
create policy "arena_level_records_update_own"
  on public.arena_level_records for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5) bty_action_contracts — verified_at, pattern_family, ENGINE statuses, dual check
-- ---------------------------------------------------------------------------
alter table public.bty_action_contracts
  add column if not exists verified_at timestamptz,
  add column if not exists pattern_family text;

-- Migrate legacy terminal state to ENGINE-approved + verification timestamp
update public.bty_action_contracts
set verified_at = coalesce(verified_at, completed_at, now())
where status = 'completed'
  and verified_at is null;

update public.bty_action_contracts
set status = 'approved'
where status = 'completed';

alter table public.bty_action_contracts
  drop constraint if exists bty_action_contracts_status_check;

alter table public.bty_action_contracts
  add constraint bty_action_contracts_status_check check (
    status in (
      'pending',
      'submitted',
      'approved',
      'rejected',
      'escalated',
      'missed'
    )
  );

alter table public.bty_action_contracts
  drop constraint if exists bty_action_contracts_approved_requires_verified_at;

alter table public.bty_action_contracts
  add constraint bty_action_contracts_approved_requires_verified_at check (
    status <> 'approved' or verified_at is not null
  );

comment on column public.bty_action_contracts.verified_at is
  'Non-null when execution verified; required for status=approved (ENGINE §5 rule 5).';
comment on column public.bty_action_contracts.pattern_family is
  'Optional pattern family for re-trigger prevention; null = legacy arena action-loop rows.';

-- At most one open pipeline row per user + family (ENGINE §5 rule 4)
create unique index if not exists bty_action_contracts_user_family_open_unique
  on public.bty_action_contracts (user_id, pattern_family)
  where pattern_family is not null
    and status in ('pending', 'submitted', 'escalated');

-- ---------------------------------------------------------------------------
-- 6) Backfill arena_runs.completion_state = complete_verified where dual condition holds
-- ---------------------------------------------------------------------------
update public.arena_runs ar
set completion_state = 'complete_verified'
from public.bty_action_contracts c
where c.user_id = ar.user_id
  and c.session_id = ar.run_id::text
  and c.status = 'approved'
  and c.verified_at is not null
  and ar.completion_state = 'in_progress'
  and upper(ar.status) = 'DONE';
