-- Approve path (POST /api/bty/action-contract/submit-validation) sets status='approved' + validation_approved_at;
-- verified_at stays null until execution verify (QR). Environments that never applied
-- 20260431250000_action_contract_validator.sql may still have
-- bty_action_contracts_approved_requires_verified_at from 20260431240000_engine_pattern_level_state_machine.sql,
-- which rejects that transition and leaves contracts stuck in 'submitted' → 409 action_contract_pending / family open.

alter table public.bty_action_contracts
  drop constraint if exists bty_action_contracts_approved_requires_verified_at;

alter table public.bty_action_contracts
  drop constraint if exists bty_action_contracts_approved_requires_validation_or_verify;

alter table public.bty_action_contracts
  add constraint bty_action_contracts_approved_requires_validation_or_verify check (
    status <> 'approved'
    or verified_at is not null
    or validation_approved_at is not null
  );

comment on constraint bty_action_contracts_approved_requires_validation_or_verify on public.bty_action_contracts is
  'VALIDATOR_ARCHITECTURE_V1: approved may follow Layer-2 (validation_approved_at) and/or execution verify (verified_at).';
