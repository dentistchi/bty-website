-- =============================================================================
-- Supabase Linter remediation (WARN):
-- 1) function_search_path_mutable: set search_path = public on reported functions
-- 2) rls_policy_always_true: replace permissive policies with scoped ones
-- auth_leaked_password_protection: enable in Dashboard → Authentication → Settings
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Functions we define in this repo: set search_path explicitly
--    (No IF EXISTS: these exist from earlier migrations.)
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.ensure_arena_profile() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.increment_arena_xp(uuid, uuid, int) SET search_path = public;

-- 2) Other reported functions (may exist only on some instances): set by name
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'bty_issues_signature',
        'bty_issue_code_frequency',
        'bty_top_issue_patterns',
        'bty_severity_distribution',
        'bty_daily_trend_top_signatures',
        'bty_issue_code_frequency_with_severity',
        'bty_quality_summary_stats',
        'bty_quality_breakdown'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3) bty_profiles / bty_day_entries: replace "Allow all for custom auth" with own-row
--    (user_id is text, compare with auth.uid()::text)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all for custom auth" ON public.bty_profiles;
CREATE POLICY "bty_profiles_own"
  ON public.bty_profiles FOR ALL TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS "Allow all for custom auth" ON public.bty_day_entries;
CREATE POLICY "bty_day_entries_own"
  ON public.bty_day_entries FOR ALL TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

-- -----------------------------------------------------------------------------
-- 4) mvp_debug_reports: narrow update policy (creator/resolver only, or resolve-only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "mvp_debug_update" ON public.mvp_debug_reports;
-- Creator can update their own report
CREATE POLICY "mvp_debug_update_own"
  ON public.mvp_debug_reports FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
-- Any authenticated can mark an open report as resolved (sets resolved_by = self)
CREATE POLICY "mvp_debug_resolve"
  ON public.mvp_debug_reports FOR UPDATE TO authenticated
  USING (status = 'open')
  WITH CHECK (status = 'resolved' AND resolved_by = auth.uid());
