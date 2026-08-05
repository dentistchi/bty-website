-- Copy-friendly (LF, no trailing spaces). Select all to copy.
--
-- CONTRACT step of the expand/deploy/contract rollout (Slice 3.2L Part 0B).
--
-- ORDERING PRECONDITION — this migration MUST NOT run before a 16-argument caller is
-- live at 100%. It carries the two statements that were deliberately held out of
-- 20260805050000 because both break the PREVIOUSLY deployed 15-argument Worker:
--
--   1. the NOT VALID constraint forcing a reviewer-terminal reason code to carry
--      `review_execution_failed` — the old Worker emits
--      `boundary_reviewer_terminal_failure` and has no `review_execution_failed` in
--      its vocabulary at all, so its writes would be rejected outright;
--   2. dropping the superseded 15-argument admission overload — the old Worker calls
--      exactly that arity, and losing it fails every admission with PGRST202.
--
-- Applied here, after the deployment, both are safe: the only caller passes all 16
-- arguments explicitly and already emits the honest outcome vocabulary.
--
-- A SECOND reason the drop matters, measured live rather than predicted: the
-- 16-argument overload declares `p_submission_intent_id uuid default null`, so it is
-- ALSO callable with 15 arguments. While both overloads exist, a 15-argument request
-- matches both and PostgREST refuses to choose — PGRST203, "could not choose the best
-- candidate function". Dropping the old overload removes the ambiguity permanently and
-- leaves exactly one admission path.
--
-- HISTORICAL EVIDENCE IS NOT MUTATED. Three live rows recorded under the old mapping
-- (2026-08-03 x2, 2026-08-04 x1) carry `boundary_review_rejected` beside a semantic
-- reviewer terminal reason. They are the measurement that motivated the repair. The
-- constraint is NOT VALID precisely so those rows stay exactly as they are while every
-- FUTURE write is checked. No update, no delete, no backfill.

-- ---------------------------------------------------------------------------
-- 1. FUTURE rows cannot repeat the contradiction.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foundry_practice_generation_attempts'::regclass
      and conname = 'foundry_practice_gen_attempt_review_exec_chk'
  ) then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_review_exec_chk
      check (
        terminal_reason_code is null
        or terminal_reason_code not in ('reviewer_terminal_failure', 'semantic_reviewer_terminal_failure', 'boundary_reviewer_terminal_failure')
        or outcome = 'review_execution_failed'
      ) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Retire the superseded 15-argument admission signature, so nothing can reach
--    admission without a submission intent — and so the overload ambiguity ends.
-- ---------------------------------------------------------------------------
drop function if exists public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer
);

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed):
--   -- 1. release future writes from the contradiction check
--   alter table public.foundry_practice_generation_attempts
--     drop constraint if exists foundry_practice_gen_attempt_review_exec_chk;
--   -- 2. restore the 15-argument overload by re-running the function definition from
--   --    20260805040000_foundry_practice_generation_retry_governance_v1.sql. Restoring it
--   --    re-introduces the PGRST203 ambiguity while the 16-argument overload also exists,
--   --    so a rollback that needs the OLD Worker must also drop the 16-argument overload:
--   --      drop function if exists public.start_foundry_practice_generation_attempt_governed_v1(
--   --        uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid
--   --      );
-- ---------------------------------------------------------------------------
