-- STEP 1C / D1 — Schema B: server-authoritative daily-instance foundation.
-- One row per user per day. UNIQUE (user_id, day_key) + ON CONFLICT DO NOTHING (app side) →
-- idempotent daily creation, no duplicate rows for the same user/day, no client-only truth.
-- day_key = userDayKey(opened_at, tz, openHour=5) ; timezone_snapshot records the tz ACTUALLY
-- used for that key ('Asia/Seoul' … or 'UTC' when the device tz was unresolved), tz_fallback flags
-- the UTC-fallback case — for auditability and later same-day-key freeze policy.
--
-- Idempotent. Rollback: DROP TABLE IF EXISTS public.user_day;

CREATE TABLE IF NOT EXISTS public.user_day (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key           text NOT NULL,                     -- 'YYYY-MM-DD' local day (rolls at 05:00 user-local)
  timezone_snapshot text NOT NULL,                     -- tz used to compute day_key ('Asia/Seoul' … | 'UTC')
  tz_fallback       boolean NOT NULL DEFAULT false,     -- true = device tz unresolved → UTC used this key
  opened_at         timestamptz NOT NULL DEFAULT now(), -- first-entry instant (UTC)
  CONSTRAINT user_day_user_day_key_uniq UNIQUE (user_id, day_key)
);

-- Layer 1 (capacity / GRANT): authenticated may READ (RLS-scoped to own rows, below); writes are
-- service_role-only (server-authoritative). anon / PUBLIC receive nothing.
REVOKE ALL ON public.user_day FROM anon, PUBLIC;
GRANT SELECT ON public.user_day TO authenticated;

-- Layer 2 (activation / RLS): default-deny; SELECT own rows only. No INSERT/UPDATE/DELETE policy →
-- writes flow exclusively through service_role (which bypasses RLS), never the client.
ALTER TABLE public.user_day ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_day_select_own ON public.user_day;
CREATE POLICY user_day_select_own ON public.user_day
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Note: UNIQUE (user_id, day_key) already backs the daily lookup with an index; no extra index needed.
