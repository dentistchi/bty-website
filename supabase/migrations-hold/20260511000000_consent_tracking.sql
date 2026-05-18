-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- Migration: Consent Tracking (legal-independent, flexible schema)
-- Date: 2026-05-11
-- Purpose: 5/30 internal launch consent tracking foundation
-- Legal review: pending (WA My Health My Data Act under attorney review)
-- Cohort: 20-person internal WA/US cohort
-- Locale: en-US default (KO cohort expansion will set 'ko-KR')

-- ============================================================
-- 1. arena_profiles 컬럼 추가
-- ============================================================
ALTER TABLE arena_profiles
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_locale TEXT DEFAULT 'en-US';

COMMENT ON COLUMN arena_profiles.consent_version IS
  'Legal document version user agreed to (e.g. "2026-05-tos-v1").
   NULL = not yet accepted, middleware redirects to /legal/accept.';

COMMENT ON COLUMN arena_profiles.consent_accepted_at IS
  'Timestamp of consent acceptance. Required by WA My Health My Data Act.';

COMMENT ON COLUMN arena_profiles.consent_locale IS
  'Locale of consent UI shown to user (e.g. en-US, ko-KR).
   Tracks which translation user agreed to.';

-- ============================================================
-- 2. arena_consent_log audit 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS arena_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_locale TEXT NOT NULL,
  action TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  notes JSONB
);

COMMENT ON TABLE arena_consent_log IS
  'Audit log for all consent actions. Flexible consent_type TEXT
   accepts lawyer-defined categories (tos|privacy|marketing|...).
   Preserved on user soft-delete for legal compliance
   (CASCADE only on hard auth.users delete).';

COMMENT ON COLUMN arena_consent_log.consent_type IS
  'Lawyer-defined category. Examples: tos, privacy, marketing, research_use.';

COMMENT ON COLUMN arena_consent_log.action IS
  'accepted | withdrawn | updated';

COMMENT ON COLUMN arena_consent_log.ip_address IS
  'IP address at acceptance time. May be hashed per lawyer requirement
   in future migration.';

COMMENT ON COLUMN arena_consent_log.notes IS
  'Flexible JSONB for additional metadata (specific clause acceptance,
   etc.) per lawyer requirements.';

CREATE INDEX IF NOT EXISTS idx_arena_consent_log_user
  ON arena_consent_log(user_id, consent_type, accepted_at DESC);

-- ============================================================
-- 3. RLS policies
-- ============================================================
ALTER TABLE arena_consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consent_log_select_own" ON arena_consent_log;
CREATE POLICY "consent_log_select_own" ON arena_consent_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "consent_log_insert_own" ON arena_consent_log;
CREATE POLICY "consent_log_insert_own" ON arena_consent_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy intentionally absent (audit log preservation).
-- Right-to-erasure requirements will be addressed in separate migration
-- per lawyer guidance.
