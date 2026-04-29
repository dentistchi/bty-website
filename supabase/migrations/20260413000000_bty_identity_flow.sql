-- =========================================================
-- BTY Core Tables (identity: Arena → Growth → My Page)
-- traits jsonb: e.g. {"Integrity": 0.7, "Communication": 0.8, "Insight": 0.6}
-- meta jsonb:   e.g. {"relationalBias": 0.9, "operationalBias": 0.2, "emotionalRegulation": 0.7}
-- =========================================================

-- 1) Arena Signals
create table if not exists public.bty_arena_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  scenario_id text not null,
  primary_choice text not null,
  reinforcement_choice text not null,

  traits jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists bty_arena_signals_user_id_idx
  on public.bty_arena_signals(user_id);

create index if not exists bty_arena_signals_created_at_idx
  on public.bty_arena_signals(created_at desc);


-- 2) Reflection Seeds
create table if not exists public.bty_reflection_seeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  source text not null check (source in ('arena')),
  scenario_id text not null,
  primary_choice text not null,
  reinforcement_choice text not null,

  focus text not null check (focus in ('clarity', 'trust', 'regulation', 'alignment')),
  prompt_title text not null,
  prompt_body text not null,
  cue text not null,

  created_at timestamptz not null default now()
);

create index if not exists bty_reflection_seeds_user_id_idx
  on public.bty_reflection_seeds(user_id);

create index if not exists bty_reflection_seeds_created_at_idx
  on public.bty_reflection_seeds(created_at desc);


-- 3) Reflection Entries
create table if not exists public.bty_reflection_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  seed_id uuid null references public.bty_reflection_seeds(id) on delete set null,
  scenario_id text not null,

  focus text not null check (focus in ('clarity', 'trust', 'regulation', 'alignment')),

  prompt_title text not null,
  prompt_body text not null,
  cue text not null,

  answer_1 text not null,
  answer_2 text not null,
  answer_3 text not null,
  commitment text not null,

  created_at timestamptz not null default now()
);

create index if not exists bty_reflection_entries_user_id_idx
  on public.bty_reflection_entries(user_id);

create index if not exists bty_reflection_entries_created_at_idx
  on public.bty_reflection_entries(created_at desc);


-- 4) Recovery Entries
create table if not exists public.bty_recovery_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  source text not null check (source in ('growth', 'arena')),
  reason text not null check (reason in ('low-regulation', 'repeated-friction', 'pressure-accumulation')),

  prompt_title text not null,
  prompt_body text not null,
  cue text not null,

  pattern_note text not null,
  reset_action text not null,
  reentry_commitment text not null,

  created_at timestamptz not null default now()
);

create index if not exists bty_recovery_entries_user_id_idx
  on public.bty_recovery_entries(user_id);

create index if not exists bty_recovery_entries_created_at_idx
  on public.bty_recovery_entries(created_at desc);

-- =========================================================
-- RLS Enable
-- =========================================================

alter table public.bty_arena_signals enable row level security;
alter table public.bty_reflection_seeds enable row level security;
alter table public.bty_reflection_entries enable row level security;
alter table public.bty_recovery_entries enable row level security;

-- =========================================================
-- RLS Policies: Arena Signals
-- (Drop legacy names from earlier repo revision if present)
-- =========================================================

drop policy if exists "bty_arena_signals_select_own" on public.bty_arena_signals;
drop policy if exists "bty_arena_signals_insert_own" on public.bty_arena_signals;
drop policy if exists "users can read own arena signals" on public.bty_arena_signals;
create policy "users can read own arena signals"
on public.bty_arena_signals
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own arena signals" on public.bty_arena_signals;
create policy "users can insert own arena signals"
on public.bty_arena_signals
for insert
with check (auth.uid() = user_id);

-- =========================================================
-- RLS Policies: Reflection Seeds
-- =========================================================

drop policy if exists "bty_reflection_seeds_select_own" on public.bty_reflection_seeds;
drop policy if exists "bty_reflection_seeds_insert_own" on public.bty_reflection_seeds;
drop policy if exists "users can read own reflection seeds" on public.bty_reflection_seeds;
create policy "users can read own reflection seeds"
on public.bty_reflection_seeds
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own reflection seeds" on public.bty_reflection_seeds;
create policy "users can insert own reflection seeds"
on public.bty_reflection_seeds
for insert
with check (auth.uid() = user_id);

-- =========================================================
-- RLS Policies: Reflection Entries
-- =========================================================

drop policy if exists "bty_reflection_entries_select_own" on public.bty_reflection_entries;
drop policy if exists "bty_reflection_entries_insert_own" on public.bty_reflection_entries;
drop policy if exists "users can read own reflection entries" on public.bty_reflection_entries;
create policy "users can read own reflection entries"
on public.bty_reflection_entries
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own reflection entries" on public.bty_reflection_entries;
create policy "users can insert own reflection entries"
on public.bty_reflection_entries
for insert
with check (auth.uid() = user_id);

-- =========================================================
-- RLS Policies: Recovery Entries
-- =========================================================

drop policy if exists "bty_recovery_entries_select_own" on public.bty_recovery_entries;
drop policy if exists "bty_recovery_entries_insert_own" on public.bty_recovery_entries;
drop policy if exists "users can read own recovery entries" on public.bty_recovery_entries;
create policy "users can read own recovery entries"
on public.bty_recovery_entries
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own recovery entries" on public.bty_recovery_entries;
create policy "users can insert own recovery entries"
on public.bty_recovery_entries
for insert
with check (auth.uid() = user_id);
