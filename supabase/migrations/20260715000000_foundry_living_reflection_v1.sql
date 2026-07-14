-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Foundry Immersive Learning + AI Reflection V1 — persist MEANING, not telemetry.
-- ===========================================================================
--
-- The Watch Integrity Engine runs entirely client-side; its raw telemetry (seek
-- timeline, playback ticks, watch coverage, internal metrics) is EPHEMERAL and
-- is NEVER persisted. Only the derived meaning and the generated Living
-- Reflection — the user's growth history — are stored here.
--
-- This migration is purely ADDITIVE and idempotent: four nullable columns on the
-- existing per-(event,participant) progress row. It does NOT touch XP, the
-- completion/response flow, join, event creation, the embeddability gate, RLS,
-- grants, or any existing constraint. Old rows keep working unchanged (all NULL).
--
--   completion_state       — 'pass' | 'review' | 'incomplete' (derived meaning)
--   reflection             — the four-section Living Reflection (jsonb)
--   reflection_version     — generator version, e.g. 'v1'
--   reflection_generated_at— when the reflection was produced (idempotency marker)
--
-- ROLLBACK:
--   ALTER TABLE public.foundry_event_training_progress
--     DROP COLUMN IF EXISTS reflection_generated_at,
--     DROP COLUMN IF EXISTS reflection_version,
--     DROP COLUMN IF EXISTS reflection,
--     DROP COLUMN IF EXISTS completion_state;
--   ALTER TABLE public.foundry_event_training_progress
--     DROP CONSTRAINT IF EXISTS foundry_training_progress_completion_state_check;
-- ===========================================================================

alter table public.foundry_event_training_progress
  add column if not exists completion_state text,
  add column if not exists reflection jsonb,
  add column if not exists reflection_version text,
  add column if not exists reflection_generated_at timestamptz;

-- Constrain the derived meaning to the three known states (NULL = not yet set).
-- Guarded so re-running the migration does not error on the existing constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_training_progress_completion_state_check'
  ) then
    alter table public.foundry_event_training_progress
      add constraint foundry_training_progress_completion_state_check
      check (completion_state is null or completion_state in ('pass', 'review', 'incomplete'));
  end if;
end $$;
