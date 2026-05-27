-- L1 file 3/4: legacy contract stamp
-- Spec: QR_VERIFICATION_ARCHITECTURE_V1.md §8.1
-- Commander D2: XP/AIR preserved, no rollback
-- Authored: 2026-05-27

BEGIN;

-- Mark all pre-cutover contracts as legacy
UPDATE public.bty_action_contracts
SET
  verification_tier = 'legacy_self_attest',
  verification_status = CASE
    WHEN verified_at IS NOT NULL THEN 'verified'
    ELSE 'pending'
  END,
  verification_confidence = 'legacy'
-- v1.2: partially-applied migration replay 안전성 강화.
-- verification_tier만 NULL인데 confidence가 이미 채워진 drift row를 덮어쓰지 않음.
WHERE verification_tier IS NULL
  AND verification_confidence IS NULL;

-- Audit: count of stamped rows
DO $$
DECLARE
  legacy_count int;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM public.bty_action_contracts
  WHERE verification_tier = 'legacy_self_attest';

  RAISE NOTICE 'L1 file 3: stamped % rows as legacy_self_attest', legacy_count;
END $$;

COMMIT;
