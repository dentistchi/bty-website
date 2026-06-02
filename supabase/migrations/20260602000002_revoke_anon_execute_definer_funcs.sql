-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Supabase advisor remediation: anon EXECUTE on SECURITY DEFINER functions (WARN).
--
-- 6 SECURITY DEFINER functions had EXECUTE reachable by anon (via direct grant
-- and/or PUBLIC). A DEFINER function runs with the owner's privileges and
-- bypasses the caller's RLS, so anon EXECUTE = unauthenticated callers could
-- invoke XP-mutating / profile / season RPCs directly (privilege escalation).
--
-- Caller analysis (verified against bty-app/src — all call sites auth-gated):
--   AUTHENTICATED user client (getSupabaseServerClient/route-client = anon key +
--   session cookie => role `authenticated`; every route gated by getUser()/
--   requireUser() -> 401):
--     - increment_arena_xp     (free-response / choice / event / run-complete)
--     - increment_weekly_xp    (beginner-complete / run-complete / activityXp / reflection)
--     - ensure_arena_profile   (beginner / profile / avatar / run / activityXp / reflection)
--     - consume_lab_attempt    (lab/complete:26 getUser->401, :48 call)
--   SERVICE_ROLE only (getSupabaseAdmin):
--     - run_season_carryover       (activeLeague.ts:62 supabaseAdmin)
--     - get_leaderboard_profiles   (leaderboardService admin client)
--
-- Fix: GRANT EXECUTE to the role(s) that legitimately call (so access survives
-- even if it previously came only via PUBLIC), then REVOKE from anon + PUBLIC.
-- This does NOT change any function body / XP logic — Core XP vs Weekly XP
-- separation and leaderboard ranking rules are untouched (grant-only change).
--
-- Idempotent: to_regprocedure() guard skips absent funcs (out-of-band schema,
-- not defined by any in-repo migration); GRANT/REVOKE are no-ops when already
-- in the target state.
-- Rollback: GRANT EXECUTE ON FUNCTION public.<f>(<args>) TO anon; (per function)
-- =============================================================================

-- --- AUTHENTICATED-called (keep authenticated + service_role; drop anon/public) ---

DO $$
BEGIN
  IF to_regprocedure('public.increment_arena_xp(uuid, uuid, integer)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.increment_arena_xp(uuid, uuid, integer) TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.increment_arena_xp(uuid, uuid, integer) FROM anon, PUBLIC;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.increment_weekly_xp(uuid, uuid, integer)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.increment_weekly_xp(uuid, uuid, integer) TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.increment_weekly_xp(uuid, uuid, integer) FROM anon, PUBLIC;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.ensure_arena_profile()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.ensure_arena_profile() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.ensure_arena_profile() FROM anon, PUBLIC;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.consume_lab_attempt(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.consume_lab_attempt(uuid) TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.consume_lab_attempt(uuid) FROM anon, PUBLIC;
  END IF;
END $$;

-- --- SERVICE_ROLE-only (keep service_role; drop anon + authenticated + public) ---

DO $$
BEGIN
  IF to_regprocedure('public.run_season_carryover()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.run_season_carryover() TO service_role;
    REVOKE EXECUTE ON FUNCTION public.run_season_carryover() FROM anon, authenticated, PUBLIC;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.get_leaderboard_profiles(uuid[])') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_leaderboard_profiles(uuid[]) TO service_role;
    REVOKE EXECUTE ON FUNCTION public.get_leaderboard_profiles(uuid[]) FROM anon, authenticated, PUBLIC;
  END IF;
END $$;
