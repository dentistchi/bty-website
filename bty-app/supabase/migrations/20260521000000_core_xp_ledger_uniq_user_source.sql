-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- STAB-02-P1: idempotency guard for ARENA core_xp_ledger inserts.
--
-- Context:
--   - reflectionRewards.server.ts applyArenaRunRewardsOnVerifiedCompletion
--     now inserts a core_xp_ledger row with source_type='ARENA',
--     source_id=run.run_id at the caller side of applyDirectCoreXp.
--   - Retries (e.g. submit-validation re-execution after partial failure)
--     must NOT double-insert. The TS caller uses ON CONFLICT DO NOTHING
--     semantics by treating Postgres error 23505 as benign.
--   - Lab path (lab-xp.service.ts:77) already inserts with source_type='LAB'
--     and source_id = `lab:{userId}:{YYYY-MM-DD}:{attemptIndex}` — covered
--     by the same constraint since source_id is non-null for Lab too.
--
-- Pre-mutation check (STAB-02-P1 PMG-3): SELECT against staging core_xp_ledger
-- returned 0 rows, so no duplicate cleanup is required before adding the
-- constraint.
--
-- Partial unique index on (user_id, source_type, source_id) WHERE source_id
-- IS NOT NULL — column is nullable, so the partial form is the supported
-- Postgres pattern (ALTER TABLE ADD CONSTRAINT would require source_id NOT
-- NULL across all rows).
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS core_xp_ledger_user_source_uq
  ON public.core_xp_ledger (user_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Rollback (run manually if reverting):
--   DROP INDEX IF EXISTS public.core_xp_ledger_user_source_uq;
-- -----------------------------------------------------------------------------
