-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BTY FOUNDER MERGE — POST-ACCEPTANCE LEDGER CLEANUP (NOT AUTOMATED; RUN BY HAND)
-- REVIEW ONLY.
--
-- Run ONLY after BOTH:
--   1. the merge is production-certified (canonical-email acceptance passed on all three
--      sign-ins, Teams Save → Today proven, Foundry/Admin authority confirmed), and
--   2. the rollback window has expired.
--
-- BEFORE RUNNING: replace __ROLLBACK_WINDOW_DAYS__ with the agreed window (e.g. 14). Left
-- unreplaced, the block fails at entry and nothing runs.
--
-- What it does, atomically:
--   * refuses unless T1 and T2 are both live (not rolled back) and the window has passed
--   * writes ONE audit row: who was merged into whom, when, and row COUNTS per step/table —
--     no keys, no values
--   * DROPS the row-level ledger. After this, T1_rollback.sql / T2_rollback.sql can no longer
--     run; recovery would be a new, forward migration.
-- ===========================================================================

begin;

set local lock_timeout = '10s';

do $cleanup$
declare
  v_window_days constant int := __ROLLBACK_WINDOW_DAYS__;
  v_t1 timestamptz;
  v_t2 timestamptz;
  v_rows int;
  v_counts jsonb;
begin
  if to_regclass('bty_ops.founder_merge_ledger') is null then
    raise exception 'CLEANUP ABORT: ledger already removed';
  end if;

  select new_value::timestamptz into v_t1
    from bty_ops.founder_merge_ledger where phase = 'T1' and step = 'committed_marker';
  select new_value::timestamptz into v_t2
    from bty_ops.founder_merge_ledger where phase = 'T2' and step = 'committed_marker';
  if v_t1 is null or v_t2 is null then
    raise exception 'CLEANUP ABORT: T1 and T2 must both be committed and not rolled back';
  end if;
  if now() < v_t2 + make_interval(days => v_window_days) then
    raise exception 'CLEANUP ABORT: rollback window open until %', v_t2 + make_interval(days => v_window_days);
  end if;

  select count(*) into v_rows from bty_ops.founder_merge_ledger;
  select jsonb_object_agg(k, n) into v_counts
    from (select phase || '/' || step || '/' || table_name || '/' || action as k, count(*) as n
            from bty_ops.founder_merge_ledger group by 1) x;

  create table if not exists bty_ops.founder_merge_audit (
    merge_key            text primary key,
    merged_from_user_id  uuid not null,
    merged_into_user_id  uuid not null,
    t1_committed_at      timestamptz not null,
    t2_committed_at      timestamptz not null,
    rows_by_step         jsonb not null,
    ledger_rows_removed  int not null,
    cleaned_at           timestamptz not null default now()
  );
  revoke all on bty_ops.founder_merge_audit from public, anon, authenticated, service_role;

  insert into bty_ops.founder_merge_audit
    (merge_key, merged_from_user_id, merged_into_user_id, t1_committed_at, t2_committed_at,
     rows_by_step, ledger_rows_removed)
  values ('founder-merge-2026-09-25',
          '81f08aa1-44a2-40b1-9190-7866151461a7', '18b1ee80-2200-4bc6-91d7-039ba43f6a50',
          v_t1, v_t2, v_counts, v_rows);

  drop table bty_ops.founder_merge_ledger;

  raise notice 'CLEANUP OK — % ledger rows removed; audit marker written', v_rows;
end
$cleanup$;

commit;
