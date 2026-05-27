-- L1 file 1/4: bty_action_contracts new columns
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §6.1
-- Authored: 2026-05-27

BEGIN;

-- 1. verification_tier — 검증 강도 분류 (mvp_open / member_only / manager_only / legacy_self_attest)
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS verification_tier text;

-- 2. verification_status — 현재 검증 상태 (pending / verified / rejected)
-- NOTE: contract lifecycle의 status 컬럼과 별도 (후자는 'draft'/'approved'/'submitted'/'escalated' 등)
-- v1.1: DB default 의도적으로 두지 않음. L2에서 contract creation 시 반드시 명시 stamp.
--   이유: lifecycle status와 verification status를 혼동하지 않기 위해, contract 생성 시점에
--   verification 상태가 'pending'임을 명시적으로 표현.
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS verification_status text;

-- 3. verification_confidence — 신뢰도 band (low / medium / high / legacy)
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS verification_confidence text;

-- 4. self_scan_suspected — mvp_open에서 scanner==actor fingerprint match
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS self_scan_suspected boolean DEFAULT false;

-- 5. actor_device_fingerprint_hash — contract 생성 시점 actor fingerprint
ALTER TABLE public.bty_action_contracts
  ADD COLUMN IF NOT EXISTS actor_device_fingerprint_hash text;

-- NOTE: verified_at 컬럼은 이미 존재 (확인됨). 추가 안 함.
-- NOTE: verified_by_user_id, verified_by_fingerprint_hash 명시적 미추가 (Commander D1 — le_verification_log가 source of truth)

-- Index for tier-aware queries
CREATE INDEX IF NOT EXISTS idx_bty_action_contracts_verification_tier
  ON public.bty_action_contracts (verification_tier)
  WHERE verification_tier IS NOT NULL;

-- Index for verification status filtering (admin dashboard, AIR computation)
CREATE INDEX IF NOT EXISTS idx_bty_action_contracts_verification_status
  ON public.bty_action_contracts (verification_status)
  WHERE verification_status IS NOT NULL;

COMMIT;
