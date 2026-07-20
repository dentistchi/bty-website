-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-3D — Authenticated Assignment Claim
-- ============================================================================
-- Adds ONE atomic SECURITY DEFINER RPC that lets an authenticated participant
-- claim EXACTLY their own assignment for an event, extending the proven claim-xp
-- seam. It writes nothing but the assignment + its audit, and it never touches
-- XP, linked_user_id, participants, identity, responsibilities, or access.
--
-- MEASURED TIMING → assigned goes straight to completed. claim-xp is only
-- executable AFTER the Foundry completion contract is satisfied
-- (foundryTrainingService.claimXp / claimDocumentXp both gate on
-- `progress.completed_at`). So by the time this RPC runs, the participant HAS
-- completed; the assignment transitions assigned -> completed in one step, with
-- participant_id + claimed_at + completed_at all set. The intermediate 'claimed'
-- state is intentionally unreachable in this slice (reserved for a future flow
-- where auth precedes completion).
--
-- CANONICAL MATCH: the assignment is located ONLY by the immutable publish-time
-- user_id_snapshot = the authenticated user. Never by name, email, job family,
-- primary role, responsibility, legacy job_function, XP, or Host inference. The
-- client supplies NO user_id / membership_id / assignment_id — the caller passes
-- the server-derived authenticated user, the session-validated participant, and
-- the event from the join token.
--
-- WRONG ACCOUNT: an authenticated user with no matching assignment for the event
-- gets result='no_matching_assignment' — a NEUTRAL result. No transfer, no
-- disclosure of whether/whose assignment exists, and the caller keeps normal
-- open-link claim-xp behavior. Assignment is NOT access control.
--
-- ROLLBACK: drop the function. All 3.1B-3B/3C tables and every existing behavior
-- are untouched.
-- ============================================================================

create or replace function public.bty_foundry_claim_assignment(
  p_event_id uuid,
  p_participant_id uuid,
  p_auth_user_id uuid
)
returns table (result text, assignment_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.foundry_event_assignments%rowtype;
begin
  -- Locate + LOCK the caller's own assignment for this event. Match is by the
  -- immutable snapshot only. status <> 'revoked' so a revoked assignment is
  -- unclaimable. At most one row exists (unique (event_id, membership_id_snapshot)
  -- and one membership per user per org), so this is deterministic.
  select * into v_row
    from public.foundry_event_assignments a
   where a.event_id = p_event_id
     and a.user_id_snapshot = p_auth_user_id
     and a.status <> 'revoked'
   for update;

  if not found then
    -- Wrong account / open-link event / no assignment: neutral, non-disclosing.
    result := 'no_matching_assignment';
    assignment_id := null;
    return next;
    return;
  end if;

  if v_row.participant_id is not null then
    if v_row.participant_id = p_participant_id then
      -- Idempotent: the SAME participant already claimed it. No new audit.
      result := 'already_claimed';
      assignment_id := v_row.id;
      return next;
      return;
    else
      -- A DIFFERENT participant already claimed it. Never transfer, never
      -- disclose the other participant; reject.
      result := 'claim_conflict';
      assignment_id := v_row.id;
      return next;
      return;
    end if;
  end if;

  -- Fresh claim. Completion is guaranteed by the claim-xp completed gate, so the
  -- assignment transitions assigned -> completed atomically.
  update public.foundry_event_assignments
     set participant_id = p_participant_id,
         claimed_at = now(),
         completed_at = now(),
         status = 'completed',
         updated_at = now()
   where id = v_row.id;

  insert into public.foundry_event_assignment_audit (
    assignment_id, event_id, changed_by,
    assignment_id_snapshot, event_id_snapshot, membership_id_snapshot, changed_by_snapshot,
    action, prev_status, new_status
  ) values (
    v_row.id, p_event_id, p_auth_user_id,
    v_row.id, p_event_id, v_row.membership_id_snapshot, p_auth_user_id,
    'complete', v_row.status, 'completed'
  );

  result := 'claimed';
  assignment_id := v_row.id;
  return next;
end;
$$;

revoke execute on function public.bty_foundry_claim_assignment(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_claim_assignment(uuid, uuid, uuid)
  to service_role;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_foundry_claim_assignment(uuid, uuid, uuid);
-- XP, linked_user_id, participants, identity, responsibilities, access, and all
-- 3.1B-3B/3C structures are UNCHANGED by this migration.
-- ============================================================================
