-- arena_profiles: restore the SELECT table privilege for the authenticated role.
--
-- Root cause (MVP-PRE-DIAG-04 + live role_table_grants check): on the live DB
-- the `authenticated` role was missing only the SELECT table GRANT on
-- public.arena_profiles. The other 6 privileges, and every other arena_*
-- table, were intact. Any anon-key+cookie client SELECTing arena_profiles
-- directly therefore failed with "permission denied for table arena_profiles"
-- — breaking profile/avatar setup screens and Core/Weekly XP read-back.
--
-- This restores table access only. RLS is unchanged and remains correct: the
-- profiles_select_own policy still confines authenticated reads to the
-- caller's own row (auth.uid() = user_id) — no security regression.
-- Idempotent: re-granting an existing privilege is a no-op.

GRANT SELECT ON public.arena_profiles TO authenticated;
