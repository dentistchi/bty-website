-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Supabase advisor remediation: rls_disabled_in_public (ERROR) — 16 tables.
--
-- Classification (verified against bty-app/src code references):
--   ACTIVE (written/read ONLY via getSupabaseAdmin = service_role, which
--   BYPASSES RLS — enabling RLS does NOT break app code):
--     - bty_action_contract_escalations            (submit-validation + cron, admin)
--     - bty_action_contract_validator_evaluations  (submit-validation, admin)
--     - scenario_pool_health_snapshots             (monitoring helper, admin-injected)
--
--   ORPHAN (0 code references — app never reads/writes; likely legacy/dead schema
--   superseded by live tables such as user_scenario_choice_history / arena_events /
--   pattern_states / bty_action_contracts / scenarios):
--     - bty_action_contract_escalation_resolutions, arena_choices, choice_events,
--       pattern_axis_states, action_requests, qr_tokens, action_approvals,
--       reexposure_links, action_execution_log, user_integrity_state,
--       arena_scenarios, pattern_shift_results, user_state_snapshots
--
-- No policies are created on purpose: RLS-enabled with no policy = default deny
-- for anon/authenticated. service_role bypasses RLS, so ACTIVE tables keep working;
-- ORPHAN tables are unused. The only anon-SELECT paths in the app
-- (scenarios / mirror_scenario_pool / program_catalog) are NOT in this list.
--
-- Idempotent: ALTER TABLE IF EXISTS ... ENABLE RLS is a no-op when already enabled
-- and skipped when the table is absent on an instance.
-- Rollback: ALTER TABLE IF EXISTS public.<t> DISABLE ROW LEVEL SECURITY;
-- =============================================================================

-- ACTIVE (service_role only)
ALTER TABLE IF EXISTS public.bty_action_contract_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bty_action_contract_validator_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scenario_pool_health_snapshots ENABLE ROW LEVEL SECURITY;

-- ORPHAN (0 code references)
ALTER TABLE IF EXISTS public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bty_action_contract_escalation_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.arena_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.choice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pattern_axis_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.action_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reexposure_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.action_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_integrity_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.arena_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pattern_shift_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_state_snapshots ENABLE ROW LEVEL SECURITY;
