-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2I — Foundry Practice true per-primary branching: selected_path V1
-- ============================================================================
-- WHY: With causal per-primary branching, a learner's PRIMARY choice creates the
-- next reality. To (1) restore that same branch after reload/relaunch server-
-- authoritatively and (2) keep truthful completion evidence of the actual path,
-- the run must store which choices the learner made. The run table
-- (public.foundry_arena_practice_runs) has no column able to hold a decision path.
--
-- This is the ONLY migration for this slice. The branched SCENARIO itself needs
-- NO migration — it rides the existing scenario_draft / scenario_snapshot JSONB.
--
-- SHAPE: selected_path is a small stable-ID object, e.g.
--   { "v": 1, "primaryChoiceId": "primary_1",
--     "tradeoffChoiceId": "p1_tradeoff_2", "actionChoiceId": "p1_action_1" }
-- IDs only — never user-facing text, scores, or interpretation.
--
-- SAFETY: purely ADDITIVE and NULLABLE. Existing rows get NULL (legacy flat runs
-- keep NULL); no default, no NOT NULL, no backfill, no row rewrite, no index, no
-- RLS/trigger/generated-column change. Idempotent (IF NOT EXISTS). The table stays
-- client-denied (RLS on, no policy, service-role only) exactly as before.
-- ============================================================================

alter table public.foundry_arena_practice_runs
  add column if not exists selected_path jsonb null;

-- A stored path, when present, must be a JSON object (never an array/scalar).
-- Guard is TABLE-SCOPED via conrelid (regclass), not name-only: a same-named constraint
-- on a different table must not suppress adding this one (idempotency hardening, R3).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_practice_run_selected_path_object_check'
      and conrelid = 'public.foundry_arena_practice_runs'::regclass
  ) then
    alter table public.foundry_arena_practice_runs
      add constraint foundry_practice_run_selected_path_object_check
      check (selected_path is null or jsonb_typeof(selected_path) = 'object');
  end if;
end $$;
