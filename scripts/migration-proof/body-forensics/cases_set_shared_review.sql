-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BEHAVIOR MATRIX — public.bty_foundry_set_shared_review (Slice 3.2I-R2.7).
-- ===========================================================================
-- Every case records (a) the OBSERVED behavior of whichever body is installed and
-- (b) the CONTRACT expectation derived from the deployed caller
-- (src/lib/bty/foundry/events/foundrySharedReviewService.ts) and the migration's
-- own documented intent. `ok` is contract compliance, NOT "matches the repo body" —
-- so an unknown live body can be judged on merit rather than on recency.
--
-- The caller contract (setSharedReview) requires:
--   * a single row whose `result` is one of
--     reviewed | unchanged | not_owner | no_progress | no_shared_response | invalid_status
--     (any other value is coerced to "no_progress" by the caller — a silent failure)
--   * owner re-check INSIDE the function (a foreign owner must never mutate)
--   * review NEVER touches completed_at / XP / the learner response
--   * one audit row per real change; an identical (status, note) resubmission
--     writes nothing new
-- ===========================================================================

\set ON_ERROR_STOP off

create table if not exists _bf_result (
  fn text, case_no int, name text, observed text, expected text, ok boolean
);
delete from _bf_result where fn = 'set_shared_review';

create or replace function _bf_ssr(p_event uuid, p_part uuid, p_owner uuid, p_status text, p_note text)
returns text language plpgsql as $fn$
declare v text;
begin
  select result into v from public.bty_foundry_set_shared_review(p_event, p_part, p_owner, p_status, p_note);
  return coalesce(v, '<null>');
exception when others then
  return 'ERROR:' || SQLSTATE;
end $fn$;

create or replace function _bf_rec(p_case int, p_name text, p_observed text, p_expected text)
returns void language plpgsql as $fn$
begin
  insert into _bf_result values ('set_shared_review', p_case, p_name, p_observed, p_expected, p_observed is not distinct from p_expected);
end $fn$;

-- How many rows ONE call emits. Exception-safe so a raising body records an observation
-- rather than aborting the statement and silently dropping the case from the matrix.
create or replace function _bf_rows(p_event uuid, p_part uuid, p_owner uuid, p_status text, p_note text)
returns text language plpgsql as $fn$
declare n int;
begin
  select count(*) into n from public.bty_foundry_set_shared_review(p_event, p_part, p_owner, p_status, p_note);
  return n::text;
exception when others then
  return 'ERROR:' || SQLSTATE;
end $fn$;

\i scripts/migration-proof/body-forensics/fixtures.sql

-- 1 — authorized owner, submitted response, valid status → reviewed
select _bf_rec(1, 'authorized owner ALIGNED',
  _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'ALIGNED', 'note one'), 'reviewed');

-- 2 — the review actually landed on the target row (status/note/reviewer/timestamp)
select _bf_rec(2, 'target row updated (status, note, reviewer, snapshot, reviewed_at set)',
  (select case when host_review_status = 'ALIGNED' and host_review_note = 'note one'
                and host_reviewed_by = '11111111-1111-1111-1111-111111111111'
                and host_reviewed_by_snapshot = '11111111-1111-1111-1111-111111111111'
                and host_reviewed_at is not null then 'updated' else 'NOT-updated' end
     from public.foundry_event_training_progress where id = 'e1111111-1111-1111-1111-111111111111'), 'updated');

-- 3 — exactly one audit row, prev NULL → ALIGNED
select _bf_rec(3, 'one audit row written with prev_status NULL and new_status ALIGNED',
  (select coalesce(string_agg(coalesce(prev_status, 'NULL') || '>' || new_status, ','), '<none>')
     from public.foundry_shared_review_audit), 'NULL>ALIGNED');

-- 4 — learner content and completion are never touched by a review
select _bf_rec(4, 'learner response + completion untouched by review',
  (select case when shared_understanding_response = 'fixture shared answer' and completed_at is null
               then 'untouched' else 'MUTATED' end
     from public.foundry_event_training_progress where id = 'e1111111-1111-1111-1111-111111111111'), 'untouched');

-- 5 — identical (status, note) resubmission → unchanged
select _bf_rec(5, 'identical resubmission returns unchanged',
  _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'ALIGNED', 'note one'), 'unchanged');

-- 6 — …and wrote no duplicate audit row
select _bf_rec(6, 'idempotent resubmission writes no second audit row',
  (select count(*)::text from public.foundry_shared_review_audit), '1');

-- 7 — changing the note alone is a real change
select _bf_rec(7, 'note-only change is a real review',
  _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'ALIGNED', 'note two'), 'reviewed');

-- 8 — changing the status records the previous status in the audit chain
select _bf_rec(8, 'status transition audits prev>new',
  (select _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
                  '11111111-1111-1111-1111-111111111111', 'FOLLOW_UP_NEEDED', 'note two')), 'reviewed');
select _bf_rec(9, 'audit chain after transition',
  (select coalesce(string_agg(coalesce(prev_status, 'NULL') || '>' || new_status, ',' order by changed_at, new_status), '<none>')
     from public.foundry_shared_review_audit), 'NULL>ALIGNED,ALIGNED>ALIGNED,ALIGNED>FOLLOW_UP_NEEDED');

-- 10 — whitespace-only note normalizes to NULL (not a stored blank)
select _bf_rec(10, 'whitespace-only note normalizes to NULL',
  (select _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
                  '11111111-1111-1111-1111-111111111111', 'PARTIALLY_CLEAR', '   ')), 'reviewed');
select _bf_rec(11, 'blank note stored as NULL',
  (select coalesce(host_review_note, '<null>') from public.foundry_event_training_progress
    where id = 'e1111111-1111-1111-1111-111111111111'), '<null>');

-- 12 — every allowed status is accepted
select _bf_rec(12, 'PARTIALLY_CLEAR accepted (already applied above)',
  (select host_review_status from public.foundry_event_training_progress
    where id = 'e1111111-1111-1111-1111-111111111111'), 'PARTIALLY_CLEAR');

-- 13 — invalid status rejected
select _bf_rec(13, 'invalid status rejected',
  _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'NOT_A_STATUS', null), 'invalid_status');

-- 14 — AUTHORIZATION: a foreign owner is refused
select _bf_rec(14, 'foreign owner refused',
  _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222', 'ALIGNED', 'intruder'), 'not_owner');

-- 15 — …and mutated nothing
select _bf_rec(15, 'foreign owner mutated nothing',
  (select host_review_status || '|' || coalesce(host_review_note, '<null>')
     from public.foundry_event_training_progress where id = 'e1111111-1111-1111-1111-111111111111'), 'PARTIALLY_CLEAR|<null>');

-- 16 — ACCOUNT ISOLATION: owner A cannot review owner B's event
select _bf_rec(16, 'cross-account review refused',
  _bf_ssr('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c1111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'ALIGNED', null), 'not_owner');
select _bf_rec(17, 'other account row untouched',
  (select coalesce(host_review_status, '<null>') from public.foundry_event_training_progress
    where id = 'e3333333-3333-3333-3333-333333333333'), '<null>');

-- 18 — unknown event id is refused (never leaks existence)
select _bf_rec(18, 'unknown event refused as not_owner',
  _bf_ssr('00000000-0000-0000-0000-000000000000', 'c1111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'ALIGNED', null), 'not_owner');

-- 19 — participant with no progress row
select _bf_rec(19, 'no progress row',
  _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111', 'ALIGNED', null), 'no_progress');

-- 20 — progress row without a submitted shared response
select _bf_rec(20, 'no shared response',
  _bf_ssr('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111', 'ALIGNED', null), 'no_shared_response');

-- 21 — RETURN SHAPE: the caller reads `result` off the first row
select _bf_rec(21, 'returns TABLE(result text)',
  (select pg_get_function_result(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'bty_foundry_set_shared_review'),
  'TABLE(result text)');

-- 21b — a single call must return EXACTLY ONE row (the caller reads data[0] and
--       would silently ignore a second, contradicting row)
select _bf_rec(24, 'one call returns exactly one row',
  _bf_rows('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111',
           '11111111-1111-1111-1111-111111111111', 'PARTIALLY_CLEAR', '   '), '1');

-- 22 — SECURITY: definer + pinned search_path (privilege-escalation surface)
select _bf_rec(22, 'security definer with pinned search_path',
  (select case when p.prosecdef then 'definer' else 'invoker' end || '|' ||
          coalesce(array_to_string(p.proconfig, ','), '<none>')
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'bty_foundry_set_shared_review'),
  'definer|search_path=pg_catalog, public');

-- 23 — no audit row was written by any refused call
select _bf_rec(23, 'refused calls wrote no audit rows',
  (select count(*)::text from public.foundry_shared_review_audit), '4');

drop function _bf_ssr(uuid, uuid, uuid, text, text);
drop function _bf_rows(uuid, uuid, uuid, text, text);
drop function _bf_rec(int, text, text, text);
