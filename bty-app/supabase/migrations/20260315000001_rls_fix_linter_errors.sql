-- =============================================================================
-- Supabase Linter remediation: enable RLS on all public tables reported
-- - policy_exists_rls_disabled: memberships, offices, regions (have policies, RLS off)
-- - rls_disabled_in_public: train_day_completions, bty_quality_events, train_completions,
--   offices, regions, memberships, organization_emotional_metrics, user_sessions,
--   maturity_scores, bty_patch_suggestions, workforce_profiles, users, organizations,
--   office_assignments
-- - sensitive_columns_exposed: public.users password — RLS limits to own row; consider
--   a view without password for API or use service_role only for that column.
-- =============================================================================

-- 1) Tables that already have policies: just ensure RLS is enabled
ALTER TABLE IF EXISTS public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regions ENABLE ROW LEVEL SECURITY;

-- 2) office_assignments: enable RLS + own-row policy (table exists in this repo)
ALTER TABLE IF EXISTS public.office_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "office_assignments_select_own" ON public.office_assignments;
CREATE POLICY "office_assignments_select_own"
  ON public.office_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "office_assignments_insert_own" ON public.office_assignments;
CREATE POLICY "office_assignments_insert_own"
  ON public.office_assignments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "office_assignments_update_own" ON public.office_assignments;
CREATE POLICY "office_assignments_update_own"
  ON public.office_assignments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Tables that may exist only on some instances: enable RLS + minimal policies
--    (DO blocks so missing tables don't fail the migration.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'train_day_completions') THEN
    ALTER TABLE public.train_day_completions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "train_day_completions_own" ON public.train_day_completions;
    CREATE POLICY "train_day_completions_own" ON public.train_day_completions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'train_completions') THEN
    ALTER TABLE public.train_completions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "train_completions_own" ON public.train_completions;
    CREATE POLICY "train_completions_own" ON public.train_completions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bty_quality_events') THEN
    ALTER TABLE public.bty_quality_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "bty_quality_events_own" ON public.bty_quality_events;
    DROP POLICY IF EXISTS "bty_quality_events_select" ON public.bty_quality_events;
    -- Schema unknown in repo: allow SELECT only; restrict write via service_role or add policy when columns are known.
    CREATE POLICY "bty_quality_events_select" ON public.bty_quality_events FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_emotional_metrics') THEN
    ALTER TABLE public.organization_emotional_metrics ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "organization_emotional_metrics_select" ON public.organization_emotional_metrics;
    CREATE POLICY "organization_emotional_metrics_select" ON public.organization_emotional_metrics FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions') THEN
    ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "user_sessions_own" ON public.user_sessions;
    CREATE POLICY "user_sessions_own" ON public.user_sessions FOR ALL TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'maturity_scores') THEN
    ALTER TABLE public.maturity_scores ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "maturity_scores_own" ON public.maturity_scores;
    CREATE POLICY "maturity_scores_own" ON public.maturity_scores FOR ALL TO authenticated USING (user_id = (auth.uid())::text) WITH CHECK (user_id = (auth.uid())::text);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bty_patch_suggestions') THEN
    ALTER TABLE public.bty_patch_suggestions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "bty_patch_suggestions_select" ON public.bty_patch_suggestions;
    CREATE POLICY "bty_patch_suggestions_select" ON public.bty_patch_suggestions FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workforce_profiles') THEN
    ALTER TABLE public.workforce_profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "workforce_profiles_own" ON public.workforce_profiles;
    CREATE POLICY "workforce_profiles_own" ON public.workforce_profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "users_select_own" ON public.users;
    -- Restrict to own row; do not expose password via anon key (use view without password or service_role for admin).
    CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "organizations_select_authenticated" ON public.organizations;
    CREATE POLICY "organizations_select_authenticated" ON public.organizations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
