-- L1 file 4/4: CHECK constraints (idempotent)
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §6.3
-- Authored: 2026-05-27
-- Production-ready: re-runnable safely

BEGIN;

-- ====================================================================
-- 1. verification_tier value validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_tier_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_tier_check
      CHECK (verification_tier IS NULL OR verification_tier IN (
        'mvp_open', 'member_only', 'manager_only', 'legacy_self_attest'
      ));
  END IF;
END $$;

-- ====================================================================
-- 2. verification_status value validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_status_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_status_check
      CHECK (verification_status IS NULL OR verification_status IN (
        'pending', 'verified', 'rejected'
      ));
  END IF;
END $$;

-- ====================================================================
-- 3. verification_confidence value validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_confidence_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_confidence_check
      CHECK (verification_confidence IS NULL OR verification_confidence IN (
        'low', 'medium', 'high', 'legacy'
      ));
  END IF;
END $$;

-- ====================================================================
-- 4. verification_type expansion (legacy + new canonical)
--    NOTE: DROP CONSTRAINT IF EXISTS는 idempotent (재실행 안전).
--    원본 정의는 STEP 0 inventory에서 캡처되어 rollback에 사용 가능.
-- ====================================================================
ALTER TABLE public.bty_action_contracts
  DROP CONSTRAINT IF EXISTS verification_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_type_check'
      AND conrelid = 'public.bty_action_contracts'::regclass
  ) THEN
    ALTER TABLE public.bty_action_contracts
      ADD CONSTRAINT verification_type_check
      CHECK (verification_type IN (
        -- New canonical (post-cutover)
        'action_completed', 'non_event_confirmed', 'manager_reviewed',
        -- Legacy (preserved during cutover, deprecated post-launch)
        -- v1.3: 'self_report' 제거. STEP 0 inventory에서 기존 CHECK에 부재 확인.
        -- production truth alignment 우선 (future-proofing보다).
        'self_attest', 'qr', 'link', 'hybrid',
        'qr_peer', 'qr_system', 'qr_location', 'none'
      ));
  END IF;
END $$;

-- ====================================================================
-- 5. le_verification_log tier validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'le_verification_log_tier_check'
      AND conrelid = 'public.le_verification_log'::regclass
  ) THEN
    ALTER TABLE public.le_verification_log
      ADD CONSTRAINT le_verification_log_tier_check
      CHECK (verification_tier IS NULL OR verification_tier IN (
        'mvp_open', 'member_only', 'manager_only', 'legacy_self_attest'
      ));
  END IF;
END $$;

-- ====================================================================
-- 6. le_verification_log confidence validation
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'le_verification_log_confidence_check'
      AND conrelid = 'public.le_verification_log'::regclass
  ) THEN
    ALTER TABLE public.le_verification_log
      ADD CONSTRAINT le_verification_log_confidence_check
      CHECK (verification_confidence IS NULL OR verification_confidence IN (
        'low', 'medium', 'high', 'legacy'
      ));
  END IF;
END $$;

-- ====================================================================
-- NOTE: INVARIANT I1 (member/manager tier requires verifier_id != contract.user_id)
-- 은 cross-row CHECK가 필요하므로 DB level이 아닌 application layer (L4)에서 enforce.
-- DB trigger로 강제할 수도 있으나 debugging 복잡도로 인해 application enforcement 선택.
-- ====================================================================

COMMIT;
