-- Reinforcement: allow a new pending row per source_choice_history_id after the prior row is consumed
-- (repeatable delayed outcomes on the same axis). Dedupe follow-ups per validation via reinforcement_seeded_from_pending_id.

DROP INDEX IF EXISTS public.arena_pending_outcomes_user_choice_history_unique;

CREATE UNIQUE INDEX IF NOT EXISTS arena_pending_outcomes_user_history_pending_unique
  ON public.arena_pending_outcomes (user_id, source_choice_history_id)
  WHERE source_choice_history_id IS NOT NULL AND status = 'pending';

ALTER TABLE public.arena_pending_outcomes
  ADD COLUMN IF NOT EXISTS reinforcement_seeded_from_pending_id uuid REFERENCES public.arena_pending_outcomes(id) ON DELETE SET NULL;

ALTER TABLE public.arena_pending_outcomes
  ADD COLUMN IF NOT EXISTS reinforcement_loop jsonb;

COMMENT ON COLUMN public.arena_pending_outcomes.reinforcement_seeded_from_pending_id IS
  'Pending row whose POST /api/arena/re-exposure/validate scheduled this follow-up; unique per user prevents duplicate reschedule for same validation.';

COMMENT ON COLUMN public.arena_pending_outcomes.reinforcement_loop IS
  'Phase A reinforcement: validation_result, loop_iteration, axis, pattern_family, next_scheduled_for, loop_reason, loop_satisfied.';

CREATE UNIQUE INDEX IF NOT EXISTS arena_pending_outcomes_reinforcement_seed_unique
  ON public.arena_pending_outcomes (user_id, reinforcement_seeded_from_pending_id)
  WHERE reinforcement_seeded_from_pending_id IS NOT NULL;
