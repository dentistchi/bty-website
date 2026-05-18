-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================
-- BTY Archetype Determinism Lock v1
-- 같은 행동 패턴 입력 → 같은 archetype 출력 보장
-- ============================================================

create extension if not exists btree_gist;

create table if not exists bty_archetype_naming_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Fingerprint (deterministic hash of input vector)
  input_hash text not null,
  fingerprint_version smallint not null default 1,

  -- Locked archetype output
  archetype_name text not null,
  archetype_class text not null check (archetype_class in (
    'stability', 'pressure', 'repair', 'truth',
    'courage', 'identity'
  )),

  -- Selection trail
  selected_by text not null check (selected_by in (
    'rule_engine', 'cached_match', 'fallback', 'ai_assisted'
  )),
  candidate_pool jsonb,
  selection_reason text,

  -- Input snapshot (재현성 보장용 — 감사/디버깅 전용, 직접 노출 금지)
  input_snapshot jsonb not null,

  -- Lifecycle
  locked_at timestamptz not null default now(),
  superseded_at timestamptz,
  superseded_by_id uuid references bty_archetype_naming_locks(id),

  -- Transition eligibility tracking
  scenarios_completed_at_lock int not null,
  contracts_completed_at_lock int not null,

  -- 한 사용자에게 active lock이 정확히 1개만 존재하도록 강제
  constraint unique_active_lock_per_user
    exclude using gist (user_id with =)
    where (superseded_at is null)
);

-- 같은 input_hash는 user_id 별로 한 번만 active
create unique index if not exists idx_archetype_lock_active_input
  on bty_archetype_naming_locks (user_id, input_hash)
  where superseded_at is null;

-- Hash 조회용
create index if not exists idx_archetype_lock_hash
  on bty_archetype_naming_locks (input_hash);

-- 사용자별 현재 archetype 빠른 조회용
create index if not exists idx_archetype_lock_user_active
  on bty_archetype_naming_locks (user_id, locked_at desc)
  where superseded_at is null;

comment on table bty_archetype_naming_locks is
  'Archetype Determinism Lock v1: same behavioral input → same archetype output. append-only.';

alter table bty_archetype_naming_locks enable row level security;

drop policy if exists "users_read_own_archetype_locks" on bty_archetype_naming_locks;
create policy "users_read_own_archetype_locks"
  on bty_archetype_naming_locks
  for select
  using (auth.uid() = user_id);
