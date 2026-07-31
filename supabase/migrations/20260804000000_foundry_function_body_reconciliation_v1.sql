-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Foundry function body RECONCILIATION V1 (Slice 3.2I-R5B1A.1-R2.8).
-- ===========================================================================
-- WHY
-- A runtime-attested PostgreSQL-17 audit (packet d5171bbd5033…) proved the live
-- bodies of two SECURITY DEFINER functions differ from repository authority. The
-- live bodies were then exported read-only, verified against the attested
-- digests, and measured on an identical behavior matrix:
--
--   bty_foundry_set_shared_review
--     repository ea748569… : 24/24   live 52cc335a… : 24/24
--     The two bodies tokenize IDENTICALLY (258 tokens); the only differences are
--     whitespace and one deleted comment. Semantic no-op. The repository body is
--     canonical because its provenance and tests are known; live provenance is not.
--
--   bty_foundry_submit_followup
--     repository 20260728 ba0ba9e6… :  5/22  (raises 42702 — the ambiguity defect)
--     repository 20260729 99c66ac7… : 16/22
--     live                21cdd472… : 16/22
--     BOTH the repository final authority AND live fail the SAME six cases.
--
-- THE DEFECT (present in 20260728, 20260729, and live alike)
-- The RESPONDED branch ends with `return query` but no `return;`. In PL/pgSQL
-- `return query` APPENDS rows and CONTINUES executing, so both the idempotent
-- retry path and the conflicting-outcome path fall through into the UPDATE and
-- the audit INSERT. Measured consequences:
--   * a conflicting second outcome OVERWRITES the first while the caller — which
--     reads only data[0] — is told 'already_responded'. First-response-wins is
--     violated and a learner's recorded answer is silently replaced.
--   * an identical retry rewrites responded_at and appends a DUPLICATE audit row
--     while the caller is told 'unchanged'. Retries are not idempotent and the
--     append-only audit no longer reflects what the user actually did.
--   * every such call returns TWO rows; the contradicting second row is discarded.
-- The 3.1B-3K device gate submitted exactly once, so it could not surface this.
--
-- FIX
--   * terminate the RESPONDED branch explicitly (`return;`) — no fall-through
--   * NULL-safe outcome comparison (`is not distinct from`)
--   * explicit terminal `return;` on the success path so every branch's control
--     flow is unambiguous
-- The signature, return shape, volatility, SECURITY DEFINER, search_path and the
-- grant/revoke contract are UNCHANGED, so the deployed Worker needs no change.
-- The existing 20260729 `#variable_conflict use_column` ambiguity correction is
-- preserved verbatim — no 42702 may reappear.
--
-- AUTHORITY
-- This migration becomes the FINAL body authority for both functions. It does NOT
-- rewrite history: 20260726 still introduced set_shared_review, 20260728 still
-- introduced submit_followup, and 20260729 still corrected the 42702 ambiguity.
--
-- SCOPE — bodies only. No table, column, index, policy, trigger, grant or ACL
-- change. `create or replace function` preserves the existing ACL, so the
-- service_role-only EXECUTE boundary proven by the audit manifest is untouched.
-- Safe to reapply: re-running produces byte-identical bodies.
--
-- ROLLBACK: re-apply the previous bodies, whose exact text is preserved as
-- packet-bound forensic evidence in docs/audit/forensics/live_body_*.sql. This
-- migration touches no rows, so there is nothing to undo in data.
-- ===========================================================================

-- 1. Host shared-understanding review — repository body, unchanged semantics.
--    Reinstated verbatim from 20260726000000 so the repository is the single
--    source of truth for the live body (live differs only in whitespace/comment).
create or replace function public.bty_foundry_set_shared_review(
  p_event_id uuid,
  p_participant_id uuid,
  p_owner_user_id uuid,
  p_status text,
  p_note text
)
returns table (result text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid;
  v_prog record;
  v_note text;
begin
  if p_status not in ('ALIGNED', 'PARTIALLY_CLEAR', 'FOLLOW_UP_NEEDED') then
    return query select 'invalid_status'::text;
    return;
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  select owner_user_id into v_owner from public.foundry_events where id = p_event_id;
  if v_owner is null or v_owner <> p_owner_user_id then
    return query select 'not_owner'::text;
    return;
  end if;

  select id, shared_understanding_response, host_review_status, host_review_note
    into v_prog
    from public.foundry_event_training_progress
   where event_id = p_event_id and participant_id = p_participant_id
   for update;

  if v_prog.id is null then
    return query select 'no_progress'::text;
    return;
  end if;
  if v_prog.shared_understanding_response is null then
    return query select 'no_shared_response'::text;
    return;
  end if;

  -- Idempotent: an identical (status, note) resubmission writes nothing new.
  if v_prog.host_review_status = p_status
     and coalesce(v_prog.host_review_note, '') = coalesce(v_note, '') then
    return query select 'unchanged'::text;
    return;
  end if;

  update public.foundry_event_training_progress
     set host_review_status = p_status,
         host_reviewed_at = now(),
         host_reviewed_by = p_owner_user_id,
         host_reviewed_by_snapshot = p_owner_user_id,
         host_review_note = v_note,
         updated_at = now()
   where id = v_prog.id;

  insert into public.foundry_shared_review_audit
    (event_id, participant_id, prev_status, new_status, reviewed_by, reviewed_by_snapshot, note)
  values
    (p_event_id, p_participant_id, v_prog.host_review_status, p_status, p_owner_user_id, p_owner_user_id, v_note);

  return query select 'reviewed'::text;
end
$$;

-- 2. Follow-up SUBMIT — first-response-wins, exactly-one-row, no fall-through.
--    The row is locked BEFORE PENDING/RESPONDED is evaluated, so two concurrent
--    submissions serialize: the second re-reads the committed RESPONDED row and
--    takes the idempotent / conflict branch instead of mutating again.
create or replace function public.bty_foundry_submit_followup(
  p_followup_id uuid,
  p_auth_user_id uuid,
  p_outcome text
)
returns table (result text, status text, outcome text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_row record;
begin
  if p_outcome not in ('APPLIED', 'PARTLY_APPLIED', 'NOT_YET', 'BLOCKED') then
    return query select 'invalid_outcome'::text, null::text, null::text;
    return;
  end if;

  -- Row lock precedes the state decision. Under READ COMMITTED a concurrent
  -- writer's COMMIT is re-read here, so v_row carries the winning state.
  select f.id, f.user_id_snapshot, f.status, f.outcome, f.event_id
    into v_row
    from public.foundry_participant_followups f
   where f.id = p_followup_id
   for update;

  if v_row.id is null then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;

  if v_row.user_id_snapshot is distinct from p_auth_user_id then
    return query select 'not_owner'::text, null::text, null::text;
    return;
  end if;

  -- ALREADY ANSWERED — terminal. The missing `return;` here is precisely the
  -- defect this migration corrects: without it PL/pgSQL appends the row and
  -- CONTINUES into the UPDATE + audit INSERT below, overwriting the first
  -- response while reporting 'unchanged' / 'already_responded' to the caller.
  if v_row.status = 'RESPONDED' then
    if v_row.outcome is not distinct from p_outcome then
      -- identical resubmission: no update, no timestamp rewrite, no audit row
      return query select 'unchanged'::text, v_row.status, v_row.outcome;
    else
      -- conflicting second outcome: the FIRST response stands
      return query select 'already_responded'::text, v_row.status, v_row.outcome;
    end if;
    return;
  end if;

  update public.foundry_participant_followups
     set status = 'RESPONDED',
         outcome = p_outcome,
         responded_at = now(),
         updated_at = now()
   where id = p_followup_id;

  insert into public.foundry_participant_followup_audit
    (followup_id, event_id, user_id_snapshot, event_type, previous_status, new_status, outcome, actor_user_id)
  values
    (p_followup_id, v_row.event_id, p_auth_user_id, 'RESPONDED', 'PENDING', 'RESPONDED', p_outcome, p_auth_user_id);

  return query select 'responded'::text, 'RESPONDED'::text, p_outcome;
  return;
end
$$;
