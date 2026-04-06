-- VALIDATOR_ARCHITECTURE_V1.md §2–§4: Step 6 fields, validation timestamps, escalation queue, audit log.

alter table public.bty_action_contracts
  add column if not exists who text,
  add column if not exists what text,
  add column if not exists how text,
  add column if not exists step_when text,
  add column if not exists raw_text text,
  add column if not exists submitted_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists validation_approved_at timestamptz,
  add column if not exists pattern_state_snapshot jsonb;

-- Allow approved = validator passed before execution verify (verified_at still null until QR).
alter table public.bty_action_contracts
  drop constraint if exists bty_action_contracts_approved_requires_verified_at;

alter table public.bty_action_contracts
  add constraint bty_action_contracts_approved_requires_validation_or_verify check (
    status <> 'approved'
    or verified_at is not null
    or validation_approved_at is not null
  );

comment on column public.bty_action_contracts.step_when is
  'Step 6 "when" field (SQL-safe name); VALIDATOR_ARCHITECTURE_V1 §2 R3/R5.';

comment on column public.bty_action_contracts.validation_approved_at is
  'Layer 2 approve (VALIDATOR_ARCHITECTURE_V1); execution gate still sets verified_at.';
comment on column public.bty_action_contracts.escalated_at is
  'When status became escalated; SLA 72h expiry returns contract to pending.';

-- Escalation queue (human review); expiry job moves contract to pending (not force-approve).
create table if not exists public.bty_action_contract_escalations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.bty_action_contracts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  opened_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'expired')),
  reviewer_notes text,
  resolved_at timestamptz,
  reviewer_user_id uuid references auth.users (id) on delete set null
);

create index if not exists bty_action_contract_escalations_contract_idx
  on public.bty_action_contract_escalations (contract_id);

create index if not exists bty_action_contract_escalations_expires_idx
  on public.bty_action_contract_escalations (expires_at)
  where status = 'open';

comment on table public.bty_action_contract_escalations is
  'VALIDATOR_ARCHITECTURE_V1 §3.5 — human queue; 72h expiry → contract pending, not force-approve.';

alter table public.bty_action_contract_escalations enable row level security;

drop policy if exists "bty_action_contract_escalations_select_own" on public.bty_action_contract_escalations;
create policy "bty_action_contract_escalations_select_own"
  on public.bty_action_contract_escalations for select to authenticated
  using (auth.uid() = user_id);

-- Server-side audit only (no client read) — use service role from API / cron.
create table if not exists public.bty_action_contract_validator_evaluations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.bty_action_contracts (id) on delete cascade,
  created_at timestamptz not null default now(),
  outcome text not null check (outcome in ('revise', 'approve', 'reject', 'escalate')),
  layer1_errors jsonb,
  layer2_criteria jsonb,
  model_id text,
  internal_notes text
);

comment on table public.bty_action_contract_validator_evaluations is
  'VALIDATOR_ARCHITECTURE_V1 §5 — rationale server-side only; never exposed to client API.';

create index if not exists bty_action_contract_validator_evaluations_contract_idx
  on public.bty_action_contract_validator_evaluations (contract_id, created_at desc);

alter table public.bty_action_contract_validator_evaluations enable row level security;
-- No select policy for authenticated users — service role bypasses RLS for inserts.
