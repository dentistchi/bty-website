-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- AL-1.8-C: Drop dead top-level reinforcement columns from arena_pending_outcomes.
--
-- JSONB validation_payload remains source of truth. All reinforcement loop
-- metadata and dedupe seed ids live under validation_payload.reinforcement_loop
-- and validation_payload.reinforcement_seeded_from_pending_id.
--
-- Production verification (2026-05-05 staging):
--   total_rows                = 26
--   top_level_loop_nonnull    = 0
--   top_level_seed_nonnull    = 0
--   jsonb_loop_present        = 22
--   jsonb_seed_present        = 3
--
-- All writes since 2026-04-27 (worker version 242d7ec8 + 788e1e38) have been
-- JSONB-only. Top-level columns added in 20260410120000 are unused. Code keeps
-- a legacy fallback read at reinforcementLoopSchedule.server.ts:40, removed in
-- the same change set as this migration.
--
-- Memory #20260427 ("schema drift 회피 = JSONB 통일") preserved: this drop
-- reinforces JSONB-as-source-of-truth and removes schema noise.

DROP INDEX IF EXISTS public.arena_pending_outcomes_reinforcement_seed_unique;

ALTER TABLE public.arena_pending_outcomes
  DROP COLUMN IF EXISTS reinforcement_loop;

ALTER TABLE public.arena_pending_outcomes
  DROP COLUMN IF EXISTS reinforcement_seeded_from_pending_id;
