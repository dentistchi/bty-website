-- L1 file 2/4: le_verification_log extension
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §6.2
-- Authored: 2026-05-27

BEGIN;

-- 1. contract_id — bty_action_contracts와 직접 join 위한 FK (기존엔 activation_id만)
-- v1.1 변경: 대형 테이블 FK 추가 시 ACCESS EXCLUSIVE lock 회피.
--   (a) nullable column 먼저 추가 (DDL fast)
--   (b) FK는 NOT VALID로 추가 — 기존 row 검증 skip, 새 row만 enforce
--   (c) VALIDATE CONSTRAINT는 별도 step에서 (lock 약함, SHARE UPDATE EXCLUSIVE)
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS contract_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'le_verification_log_contract_id_fkey'
      AND conrelid = 'public.le_verification_log'::regclass
  ) THEN
    ALTER TABLE public.le_verification_log
      ADD CONSTRAINT le_verification_log_contract_id_fkey
      FOREIGN KEY (contract_id)
      REFERENCES public.bty_action_contracts(id)
      NOT VALID;
  END IF;
END $$;

-- VALIDATE는 별도 step (§3.4 참조). L1 file 2 자체에서는 NOT VALID 상태로 두고,
-- 모든 4-file 완료 + Test 통과 후 §3.4의 validate step 실행.

-- 2. verifier_fingerprint_hash — mvp_open에서 anon scanner fingerprint
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS verifier_fingerprint_hash text;

-- 3. verification_tier — log row가 발생한 tier 정책
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS verification_tier text;

-- 4. verification_confidence — record-level confidence band
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS verification_confidence text;

-- 5. self_scan_suspected — mvp_open record에서 self-scan 의심 flag
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS self_scan_suspected boolean DEFAULT false;

-- 6. evaluation_score — manager_only tier formal evaluation
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS evaluation_score int;

-- 7. evaluation_comment — manager_only tier formal evaluation
ALTER TABLE public.le_verification_log
  ADD COLUMN IF NOT EXISTS evaluation_comment text;

-- Index for contract-based lookup (L4 validate route + UI)
CREATE INDEX IF NOT EXISTS idx_le_verification_log_contract_id
  ON public.le_verification_log (contract_id)
  WHERE contract_id IS NOT NULL;

-- Index for tier-aware audit queries
CREATE INDEX IF NOT EXISTS idx_le_verification_log_verification_tier
  ON public.le_verification_log (verification_tier)
  WHERE verification_tier IS NOT NULL;

COMMIT;
