-- Today Relationship Commitment V1 — durable evidence anchor (NOT an AI Living Response).
--
-- One IMMUTABLE row per user per canonical BTY day. day_key = userDayKey(confirmed_at, tz, 5) — the
-- SAME 05:00-local key as public.user_day (resolved via the shared server tz resolver), so a
-- commitment and the day's presence row always agree on which BTY day it is.
--
-- First-commit-wins: UNIQUE(user_id, day_key) + server-side ON CONFLICT DO NOTHING. A different
-- relationship on the same day NEVER overwrites — the route returns 409 COMMITMENT_LOCKED with the
-- existing canonical row. The row carries the confirmed DECISION only; it deliberately has NO
-- response_text / generation_status / source_evidence_fingerprint / provider metadata (commitment
-- and generated Living Response are separate domain entities).
--
-- Security mirrors public.user_day: authenticated may SELECT own rows (RLS); writes are
-- service_role-only (no INSERT/UPDATE/DELETE policy). No UPDATE path anywhere → immutable.
--
-- Idempotent. Rollback: DROP TABLE IF EXISTS public.today_relationship_commitments;

CREATE TABLE IF NOT EXISTS public.today_relationship_commitments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key                text NOT NULL,                          -- 'YYYY-MM-DD' local day (rolls 05:00 user-local)
  relationship           text NOT NULL,                          -- 'self' | 'others' | 'world' (the confirmed door)
  suggested_relationship text NULL,                              -- derived suggestion at confirm time, if any
  confirmed_at           timestamptz NOT NULL,                   -- instant the user confirmed (UTC)
  locale                 text NULL,                              -- ui locale at confirm ('ko' | 'en' | …), audit only
  timezone_snapshot      text NOT NULL,                          -- tz used to compute day_key ('Asia/Seoul' … | 'UTC')
  tz_fallback            boolean NOT NULL DEFAULT false,         -- true = device tz unresolved → UTC used this key
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT today_relationship_commitments_user_day_key_uniq UNIQUE (user_id, day_key),
  CONSTRAINT today_relationship_commitments_relationship_chk
    CHECK (relationship IN ('self', 'others', 'world')),
  CONSTRAINT today_relationship_commitments_suggested_chk
    CHECK (suggested_relationship IS NULL OR suggested_relationship IN ('self', 'others', 'world'))
);

-- Layer 1 (capacity / GRANT): authenticated may READ own rows (RLS below); writes service_role-only.
-- anon / PUBLIC receive nothing.
REVOKE ALL ON public.today_relationship_commitments FROM anon, PUBLIC;
GRANT SELECT ON public.today_relationship_commitments TO authenticated;

-- Layer 2 (activation / RLS): default-deny; SELECT own rows only. No INSERT/UPDATE/DELETE policy →
-- writes flow exclusively through service_role (bypasses RLS). No UPDATE path → immutable.
ALTER TABLE public.today_relationship_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS today_relationship_commitments_select_own ON public.today_relationship_commitments;
CREATE POLICY today_relationship_commitments_select_own ON public.today_relationship_commitments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Note: UNIQUE (user_id, day_key) already backs the daily lookup with an index; no extra index needed.
