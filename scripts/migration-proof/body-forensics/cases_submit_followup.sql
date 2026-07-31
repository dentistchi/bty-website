-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BEHAVIOR MATRIX — public.bty_foundry_submit_followup (Slice 3.2I-R2.7).
-- ===========================================================================
-- Contract derived from the deployed caller
-- (src/lib/bty/foundry/events/foundryFollowupService.ts → submitFollowup):
--   * returns ONE row of (result, status, outcome)
--   * result ∈ responded | unchanged | already_responded | invalid_outcome | not_found | not_owner
--     (anything else, or ANY raised error, is coerced to "error" by the caller — the
--      exact 42702 device-gate defect that migration 20260729 exists to fix)
--   * first response wins: a conflicting second outcome must NOT overwrite
--   * one RESPONDED audit row per real transition
-- ===========================================================================

\set ON_ERROR_STOP off

create table if not exists _bf_result (
  fn text, case_no int, name text, observed text, expected text, ok boolean
);
delete from _bf_result where fn = 'submit_followup';

-- Returns "result|status|outcome", or "ERROR:<sqlstate>" — the caller maps any raise to "error".
create or replace function _bf_sf(p_fu uuid, p_user uuid, p_outcome text)
returns text language plpgsql as $fn$
declare r record;
begin
  select * into r from public.bty_foundry_submit_followup(p_fu, p_user, p_outcome);
  return coalesce(r.result, '<null>') || '|' || coalesce(r.status, '<null>') || '|' || coalesce(r.outcome, '<null>');
exception when others then
  return 'ERROR:' || SQLSTATE;
end $fn$;

create or replace function _bf_rec(p_case int, p_name text, p_observed text, p_expected text)
returns void language plpgsql as $fn$
begin
  insert into _bf_result values ('submit_followup', p_case, p_name, p_observed, p_expected, p_observed is not distinct from p_expected);
end $fn$;

-- How many rows ONE call emits. Exception-safe so a raising body records an observation
-- rather than aborting the statement and silently dropping the case from the matrix.
create or replace function _bf_rows(p_fu uuid, p_user uuid, p_outcome text)
returns text language plpgsql as $fn$
declare n int;
begin
  select count(*) into n from public.bty_foundry_submit_followup(p_fu, p_user, p_outcome);
  return n::text;
exception when others then
  return 'ERROR:' || SQLSTATE;
end $fn$;

\i scripts/migration-proof/body-forensics/fixtures.sql

-- 1 — THE DEVICE-GATE DEFECT: a valid submission must not raise 42702 (OUT param vs column).
--     This is the single discriminator between the 20260728 body and the 20260729 hotfix.
select _bf_rec(1, 'valid submission does not raise 42702 (ambiguity hotfix present)',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'NOT_YET'),
  'responded|RESPONDED|NOT_YET');

-- 2 — the target row actually transitioned
select _bf_rec(2, 'target row RESPONDED with outcome + responded_at',
  (select status || '|' || coalesce(outcome, '<null>') || '|' ||
          case when responded_at is not null then 'ts' else 'NO-ts' end
     from public.foundry_participant_followups where id = 'f1111111-1111-1111-1111-111111111111'),
  'RESPONDED|NOT_YET|ts');

-- 3 — exactly one RESPONDED audit row with the full transition recorded
select _bf_rec(3, 'one RESPONDED audit row PENDING>RESPONDED with outcome + actor',
  (select coalesce(string_agg(event_type || ':' || coalesce(previous_status, 'NULL') || '>' || new_status ||
                              ':' || coalesce(outcome, 'NULL') ||
                              ':' || case when actor_user_id = 'd1111111-1111-1111-1111-111111111111' then 'actor-ok' else 'ACTOR-WRONG' end, ','), '<none>')
     from public.foundry_participant_followup_audit where followup_id = 'f1111111-1111-1111-1111-111111111111'),
  'RESPONDED:PENDING>RESPONDED:NOT_YET:actor-ok');

-- 4 — IDEMPOTENCY: the identical resubmission returns unchanged (retry-safe)
select _bf_rec(4, 'identical resubmission returns unchanged',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'NOT_YET'),
  'unchanged|RESPONDED|NOT_YET');

-- 5 — …and wrote no second audit row
select _bf_rec(5, 'retry writes no duplicate audit row',
  (select count(*)::text from public.foundry_participant_followup_audit
    where followup_id = 'f1111111-1111-1111-1111-111111111111'), '1');

-- 6 — FIRST RESPONSE WINS: a conflicting second outcome must not overwrite
select _bf_rec(6, 'conflicting second outcome refused',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'APPLIED'),
  'already_responded|RESPONDED|NOT_YET');
select _bf_rec(7, 'original outcome preserved after conflict',
  (select outcome from public.foundry_participant_followups
    where id = 'f1111111-1111-1111-1111-111111111111'), 'NOT_YET');

-- 8 — AUTHORIZATION: a foreign learner cannot submit someone else's obligation
select _bf_rec(8, 'foreign learner refused',
  _bf_sf('f2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 'APPLIED'),
  'not_owner|<null>|<null>');

-- 9 — unknown obligation id
select _bf_rec(9, 'unknown followup id',
  _bf_sf('00000000-0000-0000-0000-000000000000', 'd1111111-1111-1111-1111-111111111111', 'APPLIED'),
  'not_found|<null>|<null>');

-- 10 — invalid outcome rejected before any lookup or write
select _bf_rec(10, 'invalid outcome rejected',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'NOPE'),
  'invalid_outcome|<null>|<null>');

-- 11..14 — every allowed outcome is accepted (fresh fixture per outcome)
\i scripts/migration-proof/body-forensics/fixtures.sql
select _bf_rec(11, 'outcome APPLIED accepted',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'APPLIED'),
  'responded|RESPONDED|APPLIED');
\i scripts/migration-proof/body-forensics/fixtures.sql
select _bf_rec(12, 'outcome PARTLY_APPLIED accepted',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'PARTLY_APPLIED'),
  'responded|RESPONDED|PARTLY_APPLIED');
\i scripts/migration-proof/body-forensics/fixtures.sql
select _bf_rec(13, 'outcome BLOCKED accepted',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'BLOCKED'),
  'responded|RESPONDED|BLOCKED');
\i scripts/migration-proof/body-forensics/fixtures.sql
select _bf_rec(14, 'outcome NOT_YET accepted',
  _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'NOT_YET'),
  'responded|RESPONDED|NOT_YET');

-- 15 — an already-RESPONDED obligation owned by the caller is idempotent, not re-audited
\i scripts/migration-proof/body-forensics/fixtures.sql
select _bf_rec(15, 'pre-existing RESPONDED row is idempotent',
  _bf_sf('f2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'NOT_YET'),
  'unchanged|RESPONDED|NOT_YET');
select _bf_rec(16, 'pre-existing RESPONDED row gains no audit row',
  (select count(*)::text from public.foundry_participant_followup_audit
    where followup_id = 'f2222222-2222-2222-2222-222222222222'), '0');

-- 17 — a refused foreign submission never mutates the row
select _bf_rec(17, 'foreign submission mutated nothing',
  (select status || '|' || coalesce(outcome, '<null>') from public.foundry_participant_followups
    where id = 'f1111111-1111-1111-1111-111111111111'), 'PENDING|<null>');

-- 18 — RETURN SHAPE: the caller destructures result, status, outcome
select _bf_rec(18, 'returns TABLE(result text, status text, outcome text)',
  (select pg_get_function_result(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'bty_foundry_submit_followup'),
  'TABLE(result text, status text, outcome text)');

-- 20 — ONE ROW PER CALL. The caller reads data[0] and discards anything after it,
--      so a body that appends a second row can report one outcome to the app while
--      having performed a different one. Measured on the idempotent-retry path.
\i scripts/migration-proof/body-forensics/fixtures.sql
select _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'NOT_YET');
select _bf_rec(20, 'identical retry returns exactly one row',
  _bf_rows('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'NOT_YET'), '1');

-- 21 — a conflicting second outcome must leave the stored outcome untouched
\i scripts/migration-proof/body-forensics/fixtures.sql
select _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'NOT_YET');
select _bf_sf('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'APPLIED');
select _bf_rec(21, 'first response wins after a conflicting submission',
  (select outcome from public.foundry_participant_followups
    where id = 'f1111111-1111-1111-1111-111111111111'), 'NOT_YET');
select _bf_rec(22, 'conflicting submission writes no extra audit row',
  (select count(*)::text from public.foundry_participant_followup_audit
    where followup_id = 'f1111111-1111-1111-1111-111111111111'), '1');

-- 19 — SECURITY: definer + pinned search_path
select _bf_rec(19, 'security definer with pinned search_path',
  (select case when p.prosecdef then 'definer' else 'invoker' end || '|' ||
          coalesce(array_to_string(p.proconfig, ','), '<none>')
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'bty_foundry_submit_followup'),
  'definer|search_path=pg_catalog, public');

drop function _bf_sf(uuid, uuid, text);
drop function _bf_rows(uuid, uuid, text);
drop function _bf_rec(int, text, text, text);
