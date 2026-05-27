-- L1 File 4 correction patch
-- Cause: Plan §5.1 #4 referenced 'verification_type_check' (unprefixed) for DROP,
-- but actual original constraint name was 'bty_action_contracts_verification_type_check'
-- (Postgres auto-prefix). Result: old 8-value CHECK persists alongside new 11-value CHECK.
-- Effect: L2 contract creation with new canonical verification_type values would fail
-- against the old CHECK. This patch removes the old constraint.
-- Spec authority: QR_VERIFICATION_ARCHITECTURE_V1.md §6.3 (single verification_type CHECK)
-- Plan authority: L1_MIGRATION_PLAN.md §5.1 (intent: replace, not coexist)
-- Authored: 2026-05-27

BEGIN;

ALTER TABLE public.bty_action_contracts
  DROP CONSTRAINT IF EXISTS bty_action_contracts_verification_type_check;

COMMIT;
