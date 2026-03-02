-- =============================================================================
-- Leadership Engine P2: Activation & Verification event logs for AIR.
--
-- Design goals:
--   1. All AIR metrics (weighted AIR, missed windows, integrity_slip) are
--      recomputable from these two tables alone. NO derived-only storage.
--   2. Immutable append-only logs — rows are INSERTed, never UPDATEd or DELETEd
--      by application code. completed_at is the sole mutable field on
--      le_activation_log (set once when the user finishes the activation).
--   3. Separate verification table so verification events are independently
--      auditable and timestamped.
--
-- Spec refs:
--   - docs/LEADERSHIP_ENGINE_SPEC.md §4 (AIR), §9 (Activation schema)
--   - src/domain/leadership-engine/air.ts (ActivationRecord)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. le_activation_log — one row per chosen activation intent
-- ---------------------------------------------------------------------------

create table if not exists public.le_activation_log (
  id             bigserial    primary key,
  activation_id  uuid         not null unique default gen_random_uuid(),
  session_id     uuid         null,
  user_id        uuid         not null references auth.users(id) on delete cascade,
  type           text         not null check (type in ('micro_win', 'reset')),
  weight         numeric(4,2) not null default 1.0 check (weight > 0),
  chosen_at      timestamptz  not null default now(),
  due_at         timestamptz  not null,
  completed_at   timestamptz  null,
  created_at     timestamptz  not null default now()
);

comment on table  public.le_activation_log is 'Immutable activation intents for Leadership Engine AIR. One row per chosen activation.';
comment on column public.le_activation_log.activation_id is 'Stable UUID for cross-referencing with verification log and domain code.';
comment on column public.le_activation_log.session_id is 'Optional link to the session that generated this activation.';
comment on column public.le_activation_log.type is 'micro_win (w=1.0) or reset (w=2.0). Matches domain ActivationType.';
comment on column public.le_activation_log.weight is 'AIR weight factor. micro_win=1.0, reset=2.0. Stored for auditability; domain code also derives from type.';
comment on column public.le_activation_log.due_at is 'End of activation window. After this, if completed_at is null, activation counts as missed.';
comment on column public.le_activation_log.completed_at is 'Set once when user finishes the activation. Null = not yet completed or missed.';

-- Query patterns: per-user rolling window (chosen_at DESC), missed detection (due_at).
create index if not exists le_activation_log_user_chosen_idx
  on public.le_activation_log (user_id, chosen_at desc);

create index if not exists le_activation_log_user_due_idx
  on public.le_activation_log (user_id, due_at desc);

-- For session-scoped lookups (e.g. "activations generated in this session").
create index if not exists le_activation_log_session_idx
  on public.le_activation_log (session_id)
  where session_id is not null;

-- ---------------------------------------------------------------------------
-- 2. le_verification_log — one row per verification event on an activation
-- ---------------------------------------------------------------------------

create table if not exists public.le_verification_log (
  id             bigserial    primary key,
  activation_id  uuid         not null references public.le_activation_log(activation_id) on delete cascade,
  user_id        uuid         not null references auth.users(id) on delete cascade,
  verifier_id    uuid         null references auth.users(id) on delete set null,
  verifier_role  text         null,
  verified       boolean      not null default false,
  verified_at    timestamptz  not null default now(),
  method         text         null,
  created_at     timestamptz  not null default now()
);

comment on table  public.le_verification_log is 'Immutable verification events for Leadership Engine activations. Linked to le_activation_log.';
comment on column public.le_verification_log.activation_id is 'FK to le_activation_log.activation_id — which activation was verified.';
comment on column public.le_verification_log.user_id is 'The user who owns the activation (denormalised for RLS and query convenience).';
comment on column public.le_verification_log.verifier_id is 'Who performed the verification (null for self-verification or system).';
comment on column public.le_verification_log.verifier_role is 'Role of verifier at time of verification (e.g. leader, peer, system). Stored as text for flexibility.';
comment on column public.le_verification_log.verified is 'True = activation verified successfully; false = verification attempted but rejected.';
comment on column public.le_verification_log.method is 'Verification method (e.g. qr, manual, system). Matches scenario schema verification.method.';

-- Lookup: latest verification per activation.
create index if not exists le_verification_log_activation_idx
  on public.le_verification_log (activation_id, verified_at desc);

-- Per-user scan for AIR computation (join with activation_log).
create index if not exists le_verification_log_user_idx
  on public.le_verification_log (user_id, verified_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS — own-user read/write; service_role bypasses for admin/API
-- ---------------------------------------------------------------------------

alter table public.le_activation_log enable row level security;

drop policy if exists "le_activation_log_select_own" on public.le_activation_log;
create policy "le_activation_log_select_own"
on public.le_activation_log for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "le_activation_log_insert_own" on public.le_activation_log;
create policy "le_activation_log_insert_own"
on public.le_activation_log for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "le_activation_log_update_own" on public.le_activation_log;
create policy "le_activation_log_update_own"
on public.le_activation_log for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.le_verification_log enable row level security;

drop policy if exists "le_verification_log_select_own" on public.le_verification_log;
create policy "le_verification_log_select_own"
on public.le_verification_log for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "le_verification_log_insert_own" on public.le_verification_log;
create policy "le_verification_log_insert_own"
on public.le_verification_log for insert
to authenticated
with check (auth.uid() = user_id);
