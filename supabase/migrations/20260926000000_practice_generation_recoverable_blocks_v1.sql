-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Practice generation — RECOVERABLE SYSTEM BLOCKS, read-only projection. V1
--
-- PRODUCTION-EFFECTIVE. Idempotent, replay-safe, ADDITIVE ONLY: one read-only
-- function. No table, no column, no grant and no existing function is touched.
--
-- WHY A FUNCTION AND NOT A QUERY IN THE ROUTE. The membership test is
-- `foundry_practice_generation_is_system_block_v1`, and PostgREST cannot call a
-- function inside a filter — so a route-level query would have to re-list the
-- terminal reason codes in TypeScript. That is the one thing this area has
-- consistently refused: `20260805050000` introduced the helper precisely "so the
-- vocabulary cannot fork", and a second copy in application code would fork it in
-- the place hardest to keep in step.
--
-- It returns the SAME set the admission clause hides behind: completed, system-block
-- by the canonical predicate, and not already recovered.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.foundry_practice_generation_recoverable_blocks_v1();
-- =============================================================================

create or replace function public.foundry_practice_generation_recoverable_blocks_v1()
returns table (
  recoverable_draft_id uuid,
  recoverable_attempt_id uuid,
  recoverable_outcome text,
  recoverable_terminal_reason_code text,
  recoverable_failed_deploy_sha text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    a.draft_id,
    a.id,
    a.outcome,
    a.terminal_reason_code,
    a.deploy_version
  from public.foundry_practice_generation_attempts a
 where a.lifecycle_state = 'completed'
   and public.foundry_practice_generation_is_system_block_v1(a.outcome, a.terminal_reason_code)
   and not exists (
     select 1
       from public.foundry_practice_generation_system_block_recoveries r
      where r.blocked_attempt_id = a.id
   )
 order by a.started_at desc;
$$;

/*
  OUT parameter names are deliberately prefixed. A plpgsql/sql function whose OUT params shadow
  columns it selects raises 42702 at runtime only, which mocked tests never see; measured in this
  codebase already, so the prefix is cheaper than the incident.
*/
comment on function public.foundry_practice_generation_recoverable_blocks_v1() is
  'Completed system-block attempts that have NOT been recovered — exactly the set the admission clause hides behind, projected for an operator. Reuses the canonical system-block predicate rather than re-listing terminal reason codes. Returns ids and build identity only: no scenario, no learner response, no reviewer output, no owner email.';

revoke all on function public.foundry_practice_generation_recoverable_blocks_v1() from public, anon, authenticated;
