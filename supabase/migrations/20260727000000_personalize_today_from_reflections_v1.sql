-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Slice 3.1B-3J — consent flag: "Use my private reflections to personalize Today".
-- ===========================================================================
-- ADDITIVE ONLY. Extends the settled per-user preference table (own-row RLS already present).
-- Default FALSE for all existing and new users (no personalization without explicit opt-in).
-- Moves/changes NO Reflection content; creates no second preference table, no derived-memory
-- profile. When FALSE (default), Today uses ONLY deterministic reminders + neutral copy.
--
-- ROLLBACK:
--   alter table public.user_conversation_preferences
--     drop column if exists personalize_today_from_reflections;
-- ===========================================================================

alter table public.user_conversation_preferences
  add column if not exists personalize_today_from_reflections boolean not null default false;
