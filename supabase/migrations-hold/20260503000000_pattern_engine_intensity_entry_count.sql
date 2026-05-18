-- Pattern Engine: intensity on signals + entry_count/pressure_score on states
-- Idempotent: all changes use IF NOT EXISTS / DO NOTHING guards

-- 1. pattern_signals: add intensity column (nullable for back-compat)
ALTER TABLE public.pattern_signals
  ADD COLUMN IF NOT EXISTS intensity smallint
    CONSTRAINT pattern_signals_intensity_range CHECK (intensity BETWEEN 1 AND 3);

-- 2. pattern_states: add entry_count and pressure_score
ALTER TABLE public.pattern_states
  ADD COLUMN IF NOT EXISTS entry_count numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pressure_score numeric NOT NULL DEFAULT 0;

-- 3. Backfill pressure_score for existing rows where it's still 0 and exit data exists
--    pressure_score = family_window_tally * 2 + entry_count (entry_count stays 0 for history)
UPDATE public.pattern_states
SET pressure_score = family_window_tally * 2
WHERE pressure_score = 0 AND family_window_tally > 0;
