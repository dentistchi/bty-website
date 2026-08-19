-- =============================================================================
-- READ-ONLY LEDGER-GAP AUDIT — SUPPLEMENT for the three earlier gaps
--   20260805050000_foundry_practice_generation_spend_containment_v1
--   20260806000000_foundry_practice_generation_contract_v1
--   20260807000000_foundry_program_generation_attempts_v1
--
-- Companion to R4-R2G_ledger_gap_audit_12_24.sql. Same rules: SELECT ONLY, no
-- writes, no migration-history change, never errors on an absent object.
--
-- WHY THESE THREE NEED CARE. They sit inside a chain where 20260805040000,
-- 050000 and 20260806000000 all touch the SAME function
-- (start_foundry_practice_generation_attempt_governed_v1), so the function's
-- mere existence proves nothing. The discriminators used here are the objects
-- each migration ALONE creates, plus the function's ARGUMENT-COUNT SET, which
-- moves 15 -> {15,16} -> {16} across the three steps and so distinguishes them.
--
-- One statement, one result grid.
-- =============================================================================
with
practice_attempts as (select to_regclass('public.foundry_practice_generation_attempts') as oid),
-- The outcome CHECK exists both BEFORE and AFTER 20260805050000 under the same
-- auto-generated name; only its DEFINITION changed. 'review_execution_failed' is
-- the value that migration alone introduces, so the definition is the fingerprint.
outcome_def as (
  select pg_get_constraintdef(c.oid) as d
    from pg_constraint c
   where c.conname = 'foundry_practice_generation_attempts_outcome_check'
     and c.conrelid = to_regclass('public.foundry_practice_generation_attempts')
),
-- Argument-count set of the governed-start function, as text like '15,16'.
start_arity as (
  select string_agg(distinct p.pronargs::text, ',' order by p.pronargs::text) as arities,
         count(*) as overloads
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'start_foundry_practice_generation_attempt_governed_v1'
),
audit as (

-- ============================================================ 20260805050000
select
  '20260805050000'::text as migration_version,
  'foundry_practice_generation_spend_containment_v1'::text as migration_name,
  ('submission_intent_id col + intent UNIQUE idx + sysblock idx + outcome CHECK admits '
   || 'review_execution_failed + is_system_block_v1()')::text as expected_fingerprint,
  format('col=%s | intent_uniq=%s | sysblock_idx=%s | is_system_block_fn=%s | outcome_def=%s',
    coalesce((select data_type from information_schema.columns
      where table_schema='public' and table_name='foundry_practice_generation_attempts'
        and column_name='submission_intent_id'),'ABSENT'),
    case when exists (select 1 from pg_indexes where schemaname='public'
      and indexname='foundry_practice_gen_attempt_intent_uniq') then 'present' else 'ABSENT' end,
    case when exists (select 1 from pg_indexes where schemaname='public'
      and indexname='foundry_practice_gen_attempt_sysblock_idx') then 'present' else 'ABSENT' end,
    case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='foundry_practice_generation_is_system_block_v1')
      then 'present' else 'ABSENT' end,
    coalesce((select d from outcome_def),'ABSENT'))::text as observed,
  case when exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='foundry_practice_generation_attempts'
               and column_name='submission_intent_id')
        and exists (select 1 from pg_indexes where schemaname='public'
             and indexname='foundry_practice_gen_attempt_intent_uniq')
        and exists (select 1 from pg_indexes where schemaname='public'
             and indexname='foundry_practice_gen_attempt_sysblock_idx')
        and exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='foundry_practice_generation_is_system_block_v1')
        and coalesce((select d from outcome_def),'') like '%review_execution_failed%'
       then 'PASS' else 'FAIL' end::text as verdict

-- ============================================================ 20260806000000
union all select
  '20260806000000',
  'foundry_practice_generation_contract_v1',
  'review_exec CHECK exists AND the 15-arg governed-start overload has been dropped (only 16 remains)',
  format('review_exec_chk=%s | convalidated=%s | start_arities=%s (overloads=%s)',
    coalesce((select pg_get_constraintdef(oid) from pg_constraint
      where conname='foundry_practice_gen_attempt_review_exec_chk'
        and conrelid=to_regclass('public.foundry_practice_generation_attempts')),'ABSENT'),
    coalesce((select convalidated::text from pg_constraint
      where conname='foundry_practice_gen_attempt_review_exec_chk'
        and conrelid=to_regclass('public.foundry_practice_generation_attempts')),'n/a'),
    coalesce((select arities from start_arity),'NONE'),
    coalesce((select overloads::text from start_arity),'0')),
  case when exists (select 1 from pg_constraint
             where conname='foundry_practice_gen_attempt_review_exec_chk'
               and conrelid=to_regclass('public.foundry_practice_generation_attempts'))
        and coalesce((select arities from start_arity),'') = '16'
       then 'PASS'
       when exists (select 1 from pg_constraint
             where conname='foundry_practice_gen_attempt_review_exec_chk'
               and conrelid=to_regclass('public.foundry_practice_generation_attempts'))
       then 'AMBIGUOUS'
       else 'FAIL' end

-- ============================================================ 20260807000000
union all select
  '20260807000000',
  'foundry_program_generation_attempts_v1',
  '2 program-generation tables + 3 named CHECKs + 5 indexes + RLS on both',
  format('attempts=%s | calls=%s | chks=%s/3 | idx=%s/5 | rls=%s/2',
    coalesce(to_regclass('public.foundry_program_generation_attempts')::text,'ABSENT'),
    coalesce(to_regclass('public.foundry_program_generation_attempt_calls')::text,'ABSENT'),
    (select count(*) from pg_constraint
       where conname in ('foundry_program_gen_attempt_lifecycle_consistent',
                         'foundry_program_gen_attempt_refusal_consistent',
                         'foundry_program_gen_call_lifecycle_consistent')
         and conrelid in (to_regclass('public.foundry_program_generation_attempts'),
                          to_regclass('public.foundry_program_generation_attempt_calls'))),
    (select count(*) from pg_indexes where schemaname='public'
       and indexname in ('foundry_program_gen_attempt_intent_uniq','foundry_program_gen_attempt_draft_idx',
                         'foundry_program_gen_attempt_outcome_idx','foundry_program_gen_call_seq_uniq',
                         'foundry_program_gen_call_attempt_idx')),
    (select count(*) from pg_class
       where oid in (to_regclass('public.foundry_program_generation_attempts'),
                     to_regclass('public.foundry_program_generation_attempt_calls'))
         and relrowsecurity)),
  case when to_regclass('public.foundry_program_generation_attempts') is not null
        and to_regclass('public.foundry_program_generation_attempt_calls') is not null
        and (select count(*) from pg_constraint
               where conname in ('foundry_program_gen_attempt_lifecycle_consistent',
                                 'foundry_program_gen_attempt_refusal_consistent',
                                 'foundry_program_gen_call_lifecycle_consistent')
                 and conrelid in (to_regclass('public.foundry_program_generation_attempts'),
                                  to_regclass('public.foundry_program_generation_attempt_calls'))) = 3
        and (select count(*) from pg_indexes where schemaname='public'
               and indexname in ('foundry_program_gen_attempt_intent_uniq','foundry_program_gen_attempt_draft_idx',
                                 'foundry_program_gen_attempt_outcome_idx','foundry_program_gen_call_seq_uniq',
                                 'foundry_program_gen_call_attempt_idx')) = 5
        and (select count(*) from pg_class
               where oid in (to_regclass('public.foundry_program_generation_attempts'),
                             to_regclass('public.foundry_program_generation_attempt_calls'))
                 and relrowsecurity) = 2
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------- durable-data corroboration
-- Schema cannot distinguish 20260805040000 from 050000 on the shared function.
-- A stored row carrying a submission_intent_id proves the column was writable,
-- corroborating 050000. Absence proves nothing, so this is CONTEXT, not a verdict.
union all select
  '20260805050000',
  '(corroboration) rows carrying a submission_intent_id',
  'any durable practice-attempt row with submission_intent_id not null',
  /*
    COUNTED THROUGH query_to_xml, NOT a direct FROM. PostgreSQL resolves table
    references at PARSE time, so a plain `select count(*) from public.t` inside a
    CASE still aborts the whole statement when `t` is absent — coalesce cannot
    save it. Passing the query as TEXT defers resolution to execution, where the
    CASE guard genuinely short-circuits. This audit must survive a database where
    the migration never ran; that is the entire point of it.
  */
  case
    when to_regclass('public.foundry_practice_generation_attempts') is null then 'table ABSENT'
    when not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='foundry_practice_generation_attempts'
        and column_name='submission_intent_id') then 'column ABSENT'
    else format('rows_with_intent=%s | rows_total=%s',
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.foundry_practice_generation_attempts where submission_intent_id is not null',
        false, true, '')))[1]::text,
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.foundry_practice_generation_attempts',
        false, true, '')))[1]::text)
  end,
  'CONTEXT'

union all select
  '20260807000000',
  '(corroboration) program-generation attempt rows',
  'durable rows in the two tables this migration created',
  case
    when to_regclass('public.foundry_program_generation_attempts') is null
      or to_regclass('public.foundry_program_generation_attempt_calls') is null then 'tables ABSENT'
    else format('attempts_rows=%s | call_rows=%s',
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.foundry_program_generation_attempts', false, true, '')))[1]::text,
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.foundry_program_generation_attempt_calls', false, true, '')))[1]::text)
  end,
  'CONTEXT'
)
select * from audit order by migration_version, verdict desc;
