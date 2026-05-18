-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================
-- BTY Archetype Lock RPC v1
-- atomic supersede + insert (prevents race on EXCLUDE constraint)
-- ============================================================
--
-- Execution order (must be this way due to EXCLUDE constraint):
--   Step 1: UPDATE existing active lock → superseded_at = now()
--           This clears the EXCLUDE slot so Step 2 can insert.
--   Step 2: INSERT new row → returns v_new_id
--   Step 3: UPDATE old row → superseded_by_id = v_new_id  (back-link)
--
-- All three statements run in one plpgsql transaction.
-- External callers never see partial state.
-- 23P01 (exclusion_violation) is NOT caught here — propagates to the
-- TypeScript caller, which retries (lockService.ts MAX_RETRIES).
-- ============================================================

create or replace function bty_create_archetype_lock(
  p_user_id uuid,
  p_input_hash text,
  p_fingerprint_version smallint,
  p_archetype_name text,
  p_archetype_class text,
  p_selected_by text,
  p_candidate_pool jsonb,
  p_selection_reason text,
  p_input_snapshot jsonb,
  p_scenarios_completed int,
  p_contracts_completed int
) returns uuid
language plpgsql
security definer
as $$
declare
  v_old_id uuid;
  v_new_id uuid;
begin
  -- Step 1: clear the EXCLUDE slot by marking the active lock superseded.
  --         (superseded_by_id left null here; filled in Step 3 once we have v_new_id)
  update bty_archetype_naming_locks
  set superseded_at = now()
  where user_id     = p_user_id
    and superseded_at is null
  returning id into v_old_id;

  -- Step 2: insert the new lock (EXCLUDE slot is now free).
  insert into bty_archetype_naming_locks (
    user_id,
    input_hash,
    fingerprint_version,
    archetype_name,
    archetype_class,
    selected_by,
    candidate_pool,
    selection_reason,
    input_snapshot,
    scenarios_completed_at_lock,
    contracts_completed_at_lock
  ) values (
    p_user_id,
    p_input_hash,
    p_fingerprint_version,
    p_archetype_name,
    p_archetype_class,
    p_selected_by,
    p_candidate_pool,
    p_selection_reason,
    p_input_snapshot,
    p_scenarios_completed,
    p_contracts_completed
  ) returning id into v_new_id;

  -- Step 3: back-link the old row to the new one (audit trail).
  --         Skips silently when no prior lock existed (v_old_id is null).
  if v_old_id is not null then
    update bty_archetype_naming_locks
    set superseded_by_id = v_new_id
    where id = v_old_id;
  end if;

  return v_new_id;
end;
$$;

comment on function bty_create_archetype_lock is
  'Atomically supersedes the current active lock and inserts a new one. '
  'security definer — public execute revoked; service_role only (§9 Forbidden). '
  '23P01 exclusion_violation propagates to the caller for client-side retry.';

-- §9 Forbidden: users must not declare or override archetype names.
-- Revoke all non-superuser execute access; grant service_role only.
-- Supabase auto-grants anon+authenticated on new functions — revoke explicitly.
-- lockService.ts uses getSupabaseAdmin() (service role client) for this call only.
revoke execute on function bty_create_archetype_lock(
  uuid, text, smallint, text, text, text, jsonb, text, jsonb, int, int
) from public;
revoke execute on function bty_create_archetype_lock(
  uuid, text, smallint, text, text, text, jsonb, text, jsonb, int, int
) from anon;
revoke execute on function bty_create_archetype_lock(
  uuid, text, smallint, text, text, text, jsonb, text, jsonb, int, int
) from authenticated;
grant execute on function bty_create_archetype_lock(
  uuid, text, smallint, text, text, text, jsonb, text, jsonb, int, int
) to service_role;
