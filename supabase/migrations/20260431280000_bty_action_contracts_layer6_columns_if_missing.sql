-- Production parity: environments that applied base `bty_action_contracts` + later patches but skipped
-- `20260431250000_action_contract_validator.sql` still lack Step 6 / validator columns.
-- Idempotent adds — safe if columns already exist.

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

comment on column public.bty_action_contracts.who is
  'Step 6 Layer 1 field; VALIDATOR_ARCHITECTURE_V1.';
comment on column public.bty_action_contracts.what is
  'Step 6 Layer 1 field; VALIDATOR_ARCHITECTURE_V1.';
comment on column public.bty_action_contracts.how is
  'Step 6 Layer 1 field; VALIDATOR_ARCHITECTURE_V1.';
comment on column public.bty_action_contracts.step_when is
  'Step 6 when field (SQL-safe name); VALIDATOR_ARCHITECTURE_V1.';
comment on column public.bty_action_contracts.raw_text is
  'Verbatim Step 6 submission snapshot for execution gate.';
