-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Event QR — Slice 2b HOTFIX: revoke PUBLIC EXECUTE on bty_event_scan_award
--
-- `bty_event_scan_award` (migration 20260624000100) is SECURITY DEFINER and runs
-- as owner `postgres` (RLS-bypassing). Postgres grants EXECUTE to PUBLIC by
-- default, and Supabase's default privileges also grant it to `anon` /
-- `authenticated`. That makes the function callable via PostgREST RPC by anyone
-- holding the public anon key, bypassing every route gate (approved-member,
-- event-live) and the route binding `p_xp = event.xp_value` → arbitrary
-- `p_user_id` / unbounded `p_xp` Core XP inflation.
--
-- The Root Rule "service-role only" for Reality award is enforced ONLY by this
-- revoke. The route calls the function via the service-role client, which keeps
-- its own explicit EXECUTE grant — so the intended path is unaffected.
--
-- PRODUCTION-EFFECTIVE: single shared Supabase project backs all workers.
-- =============================================================================

revoke execute on function public.bty_event_scan_award(uuid, uuid, int)
  from public, anon, authenticated;
