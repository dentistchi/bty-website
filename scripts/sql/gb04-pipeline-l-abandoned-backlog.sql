-- G-B04 — Pipeline L abandoned-lock backlog (ENGINE_ARCHITECTURE_V1 §6.5, CI_RELEASE_GATE_MATRIX G-B04)
-- Run in Supabase SQL Editor (production) with read role or service role.
--
-- Pass condition: blocking_without_ack = 0
-- (equivalently: every Pipeline L row in locked_step7_abandoned has administratively_acknowledged_at set,
--  or there are zero such rows.)
--
-- Prerequisites on public.arena_runs:
--   completion_state, pipeline, administratively_acknowledged_at
-- If a column is missing, apply the product migration first — do not guess filters.

SELECT
  COUNT(*) FILTER (
    WHERE completion_state = 'locked_step7_abandoned'
      AND pipeline IN ('L', 'legacy')
  ) AS total_pipeline_l_abandoned,
  COUNT(*) FILTER (
    WHERE completion_state = 'locked_step7_abandoned'
      AND pipeline IN ('L', 'legacy')
      AND administratively_acknowledged_at IS NOT NULL
  ) AS with_administrative_ack,
  COUNT(*) FILTER (
    WHERE completion_state = 'locked_step7_abandoned'
      AND pipeline IN ('L', 'legacy')
      AND administratively_acknowledged_at IS NULL
  ) AS blocking_without_ack;
