-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-3D (fix) — distinguish open-link from wrong-account on claim
-- ============================================================================
-- create-or-replace of bty_foundry_claim_assignment. Behaviour is identical
-- EXCEPT the "no assignment for this user" branch now distinguishes:
--
--   * the event has an assigned_overlay recipient set but NONE match this user
--     -> 'no_matching_assignment'  (wrong account on an assigned event; the UI
--        shows a neutral "no matching assignment was connected" — no disclosure)
--   * the event has no assignment overlay at all (ordinary open-link room)
--     -> 'not_applicable'          (the UI stays SILENT — assignments are not a
--        concept for this room, so a message would be noise)
--
-- Everything else is unchanged: match ONLY by immutable user_id_snapshot, row
-- lock, idempotent same-participant, conflict-safe against a different one,
-- assigned -> completed on a fresh claim, service-role only, pinned search_path.
-- No XP / identity / access / participant writes.
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
  v_is_assigned boolean;
begin
  select * into v_row
    from public.foundry_event_assignments a
   where a.event_id = p_event_id
     and a.user_id_snapshot = p_auth_user_id
     and a.status <> 'revoked'
   for update;

  if not found then
    -- Distinguish "assigned event, wrong account" from "open-link room".
    select exists (
      select 1 from public.foundry_event_participation_mode m
       where m.event_id = p_event_id and m.mode = 'assigned_overlay'
    ) into v_is_assigned;
    result := case when v_is_assigned then 'no_matching_assignment' else 'not_applicable' end;
    assignment_id := null;
    return next;
    return;
  end if;

  if v_row.participant_id is not null then
    if v_row.participant_id = p_participant_id then
      result := 'already_claimed';
      assignment_id := v_row.id;
      return next;
      return;
    else
      result := 'claim_conflict';
      assignment_id := v_row.id;
      return next;
      return;
    end if;
  end if;

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
-- ROLLBACK: re-apply 20260723000000_foundry_assignment_claim_v1.sql (the prior
-- definition without the not_applicable branch). No data changes either way.
-- ============================================================================
