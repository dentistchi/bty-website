-- STAB-07-P0-L1.5c — Escalations INSERT defect resolution (isolated)
--
-- Root cause (Lane B forensic): code inserts user_id, live table lacked it
-- → PGRST204 'user_id' column not found → silent swallow → 0 rows.
--
-- Apply path: Commander SQL Editor (out-of-band, prior to this dispatch).
-- This file is record-only; history marked via
-- `supabase migration repair --status applied 20260524000001`.
--
-- Adds user_id (uuid, nullable) + FK to auth.users ON DELETE SET NULL.
-- Aligned with reviewer_user_id pattern in same table for consistency.
--
-- NOT IN SCOPE (separate lanes):
-- - escalated_at / resolution orphan columns (out-of-band history drift)
-- - logEvaluation/escalation silent-swallow hardening (BTY Infra Mode area)
-- - F2 (L1.6) reclassified to MVP product policy question

DO $$
BEGIN
  -- Add column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bty_action_contract_escalations'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE bty_action_contract_escalations
      ADD COLUMN user_id uuid;
  END IF;

  -- Add FK if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'bty_action_contract_escalations'::regclass
      AND conname = 'bty_action_contract_escalations_user_id_fkey'
  ) THEN
    ALTER TABLE bty_action_contract_escalations
      ADD CONSTRAINT bty_action_contract_escalations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN bty_action_contract_escalations.user_id IS
  'STAB-07-P0-L1.5c: contract owner (provided by submit-validation INSERT). FK to auth.users.';
