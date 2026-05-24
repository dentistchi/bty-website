-- STAB-07-P0-L1.5b — Audit Column Restoration (isolated)
--
-- Forward observability only. No retroactive backfill.
-- Invariant-preserving: NO constraint changes.
-- Apply path: Commander SQL Editor (out-of-band), this file is record-only.
-- History: marked applied via `supabase migration repair --status applied 20260524000000`.
--
-- Adds 4 nullable columns to bty_action_contract_validator_evaluations
-- so that submit-validation/route.ts logEvaluation() inserts succeed.
--
-- NOT IN SCOPE (separate lanes):
-- - bty_action_contract_escalations INSERT defect (L1.5c)
-- - approved_requires_verified_at constraint (Lane A Q6 invariant preserved)
-- - logEvaluation/escalation insert silent-swallow hardening (BTY Infra Mode)
-- - F2 (L1.6) Layer-2 bypass decouple

ALTER TABLE bty_action_contract_validator_evaluations
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS layer2_criteria jsonb,
  ADD COLUMN IF NOT EXISTS layer1_errors jsonb;

COMMENT ON COLUMN bty_action_contract_validator_evaluations.model_id IS
  'STAB-07-P0-L1.5b: LLM model identifier used in Layer 2 evaluation';
COMMENT ON COLUMN bty_action_contract_validator_evaluations.internal_notes IS
  'STAB-07-P0-L1.5b: layer2TechnicalError discriminator (case A vs B)';
COMMENT ON COLUMN bty_action_contract_validator_evaluations.layer2_criteria IS
  'STAB-07-P0-L1.5b: per-criterion semantic outcomes (jsonb)';
COMMENT ON COLUMN bty_action_contract_validator_evaluations.layer1_errors IS
  'STAB-07-P0-L1.5b: Layer 1 structural rule failures (jsonb)';
