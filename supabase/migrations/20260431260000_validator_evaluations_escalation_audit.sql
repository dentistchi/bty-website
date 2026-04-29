-- QA_C3_TESTABILITY_REVIEW_V1 §1.3 — persisted evaluation grain + escalation resolution audit (INV-M05, INV-S04, INV-S08, INV-S09).

-- 1) Evaluation log: evaluation_id = id for CI joins (INV-S08); L1/L2 instrumentation
do $eval_id$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bty_action_contract_validator_evaluations'
      and column_name = 'evaluation_id'
  ) then
    alter table public.bty_action_contract_validator_evaluations
      add column evaluation_id uuid generated always as (id) stored;
  end if;
end
$eval_id$;

create unique index if not exists bty_action_contract_validator_evaluations_evaluation_id_key
  on public.bty_action_contract_validator_evaluations (evaluation_id);

alter table public.bty_action_contract_validator_evaluations
  add column if not exists layer2_invoked boolean not null default false;

alter table public.bty_action_contract_validator_evaluations
  add column if not exists layer1_failure_count smallint not null default 0;

comment on column public.bty_action_contract_validator_evaluations.evaluation_id is
  'Stable evaluation id for audit/CI (INV-S08); generated from primary key id.';

comment on column public.bty_action_contract_validator_evaluations.layer2_invoked is
  'True when Layer 2 ran for this evaluation (Layer 1 had zero failures). QA_C3_TESTABILITY_REVIEW_V1 §1.3.';

comment on column public.bty_action_contract_validator_evaluations.layer1_failure_count is
  'Count of Layer 1 rule failures (0 when Layer 2 is allowed).';

-- Stable SQL name for integrity queries / CI
create or replace view public.validator_evaluations as
select
  evaluation_id,
  id,
  contract_id,
  created_at,
  outcome,
  layer1_errors,
  layer2_criteria,
  layer2_invoked,
  layer1_failure_count,
  model_id,
  internal_notes
from public.bty_action_contract_validator_evaluations;

comment on view public.validator_evaluations is
  'Alias view for QA_INTEGRITY_FRAMEWORK / C3 tests; excludes server-only rationale expansion.';

-- 2) Secondary review artifact: escalated → validation-approved must reference a resolution row (app-enforced + integration tests)
create table if not exists public.bty_action_contract_escalation_resolutions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.bty_action_contracts (id) on delete cascade,
  escalation_id uuid references public.bty_action_contract_escalations (id) on delete set null,
  reviewer_user_id uuid not null references auth.users (id) on delete restrict,
  disposition text not null check (disposition in ('secondary_approve', 'secondary_reject')),
  resolved_at timestamptz not null default now(),
  notes text
);

create index if not exists bty_action_contract_escalation_resolutions_contract_idx
  on public.bty_action_contract_escalation_resolutions (contract_id, resolved_at desc);

comment on table public.bty_action_contract_escalation_resolutions is
  'INV-M05 / INV-S04 — audit row when human (or policy-approved actor) resolves an escalation; required before contract leaves escalated to approved/rejected via secondary path.';

alter table public.bty_action_contract_escalation_resolutions enable row level security;
