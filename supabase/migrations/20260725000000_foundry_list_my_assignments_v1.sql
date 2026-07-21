-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-3E — Installed-app REQUIRED LEARNING surface: LEARNER READ PATH
-- ============================================================================
-- READ-ONLY. This adds ONE SECURITY DEFINER function that lets an authenticated
-- learner read THEIR OWN Foundry assignments and NOTHING ELSE. It creates no
-- assignments, writes no rows, changes no existing behavior, adds no RLS policy,
-- and touches no XP / identity / participant / access data.
--
-- Why a function (not an RLS policy): every assignment table is deny-all to the
-- anon/authenticated/public roles and is reached only through service-role
-- SECURITY DEFINER RPCs (3.1B-3B..3D). This read follows the SAME shape: the
-- caller's identity is passed as p_auth_user_id — SERVER-DERIVED from
-- auth.getUser() at the route, NEVER client-supplied — and the function returns
-- only rows whose immutable publish-time user_id_snapshot equals it. There is no
-- admin/Host/leadership widening: the only key is the caller's own snapshot.
--
-- Visibility contract (honest, per the shipped assignment states):
--   * status IN ('assigned','completed') only. 'assigned' = required-learning
--     that exists and is unclaimed by this learner; 'completed' = a matching
--     authenticated participant completed and claimed it.
--   * 'revoked' is HIDDEN from this learner list (no longer actionable). 'claimed'
--     is an unused intermediate (claim goes straight assigned->completed) and is
--     likewise excluded.
--   * Only assigned_overlay events surface — enforced by the participation-mode
--     join, so an OPEN_LINK room can NEVER appear as required learning.
--
-- Privacy: the row set is scoped to the caller's own assignments. Titles come
-- from the caller's own required events; join_version lets the route mint the
-- learner's own Room token. NO other recipient, membership, audience count,
-- reflection, response body, or audit actor is selected.
--
-- ROLLBACK: drop the function. Nothing references it; no data is touched.
-- ============================================================================

create or replace function public.bty_foundry_list_my_assignments(
  p_auth_user_id uuid
)
returns table (
  assignment_id uuid,
  event_id uuid,
  status text,
  title text,
  assigned_at timestamptz,
  completed_at timestamptz,
  join_version integer,
  participation_mode text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    a.id as assignment_id,
    a.event_id as event_id,
    a.status as status,
    e.title as title,
    a.assigned_at as assigned_at,
    a.completed_at as completed_at,
    e.join_version as join_version,
    'assigned_overlay'::text as participation_mode
  from public.foundry_event_assignments a
  join public.foundry_events e
    on e.id = a.event_id
  join public.foundry_event_participation_mode m
    on m.event_id = a.event_id
   and m.mode = 'assigned_overlay'
  where a.user_id_snapshot = p_auth_user_id
    and a.status in ('assigned', 'completed')
  order by
    case when a.status = 'assigned' then 0 else 1 end,
    coalesce(a.completed_at, a.assigned_at) desc;
$$;

revoke execute on function public.bty_foundry_list_my_assignments(uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_list_my_assignments(uuid)
  to service_role;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_foundry_list_my_assignments(uuid);
-- No tables, policies, grants, or rows are changed by this migration.
-- ============================================================================
