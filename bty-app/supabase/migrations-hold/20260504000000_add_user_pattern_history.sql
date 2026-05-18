-- user_pattern_history: per-play pattern tracking for Quick Mode and Full Arena.
-- Separate from user_scenario_history (per-user aggregation table, rotation tracking).
-- Ref: QUICK_MODE_PATTERN_TYPE_SPEC_V1

CREATE TABLE IF NOT EXISTS public.user_pattern_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id      text        NOT NULL,
  pattern_type     text        NOT NULL DEFAULT 'action'
                   CHECK (pattern_type IN ('intent', 'action', 'abandonment_signal')),
  source_mode      text        NOT NULL DEFAULT 'full_arena'
                   CHECK (source_mode IN ('full_arena', 'quick_mode')),
  axis             text,
  action_completed boolean     NOT NULL DEFAULT false,
  air_eligible     boolean     NOT NULL DEFAULT false,
  weight           numeric     NOT NULL DEFAULT 1.0
                   CHECK (weight >= 0 AND weight <= 2),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Partial index for AIR-eligible rows (intent-action gap future queries)
CREATE INDEX IF NOT EXISTS idx_uph_user_air
  ON public.user_pattern_history (user_id, air_eligible, created_at DESC)
  WHERE air_eligible = true;

-- Index for pattern-type lookups (abandonment signal detection, re-exposure priority)
CREATE INDEX IF NOT EXISTS idx_uph_pattern_lookup
  ON public.user_pattern_history (user_id, pattern_type, axis, created_at DESC);

-- RLS
ALTER TABLE public.user_pattern_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_pattern_history_own_read"    ON public.user_pattern_history;
DROP POLICY IF EXISTS "user_pattern_history_own_insert"  ON public.user_pattern_history;
DROP POLICY IF EXISTS "user_pattern_history_service_all" ON public.user_pattern_history;

CREATE POLICY "user_pattern_history_own_read"
  ON public.user_pattern_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_pattern_history_own_insert"
  ON public.user_pattern_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (needed for server-side inserts via service key)
CREATE POLICY "user_pattern_history_service_all"
  ON public.user_pattern_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
