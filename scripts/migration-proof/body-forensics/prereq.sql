-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Forensics-only SCHEMA augmentation (Slice 3.2I-R2.7).
-- ===========================================================================
-- The shared replay bootstrap (scripts/migration-proof/expected/bootstrap.sql) is
-- deliberately minimal: it creates only what the audited migrations need in order
-- to APPLY. The body forensics additionally EXERCISE the functions, so they need
-- one more pre-existing production column that the audited migrations do not
-- create and therefore do not audit:
--
--   foundry_event_training_progress.completed_at — the completion marker a Host
--   review must never touch. Without it, "review does not affect completion"
--   cannot be measured at all.
--
-- Kept OUT of bootstrap.sql on purpose: that file is the packet's replay contract
-- and must keep describing exactly the migrations' own prerequisites.
-- ===========================================================================

alter table public.foundry_event_training_progress
  add column if not exists completed_at timestamptz;
