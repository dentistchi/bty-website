-- =============================================================================
-- READ-ONLY LEDGER-GAP AUDIT — migrations 20260812000000 .. 20260824000000
--
-- Remote supabase_migrations.schema_migrations stops at 20260811000000. This
-- script does NOT trust that ledger and does NOT trust the migration files'
-- own claims: it reads the live catalog for the smallest durable fingerprint
-- each migration must have left, and reports PASS / FAIL / AMBIGUOUS.
--
-- SELECT ONLY. It creates nothing, alters nothing, writes nothing, and does not
-- touch migration history. Safe to run any number of times.
--
-- One statement, one result grid. Read `verdict`, then `observed`.
-- =============================================================================
with
-- The ledger as it actually stands, for the range in question.
ledger as (
  select string_agg(version, ', ' order by version) as present
    from supabase_migrations.schema_migrations
   where version between '20260812000000' and '20260824000000'
),
-- The behaviour-contract reason CHECK is rewritten by THREE migrations in this
-- range (16, 18, 20), each widening the same enum. Only the final state survives,
-- so this one definition decides all three verdicts.
bcr as (
  select pg_get_constraintdef(oid) as d
    from pg_constraint
   where conname = 'foundry_program_call_behavior_contract_reason_check'
     and conrelid = to_regclass('public.foundry_program_generation_attempt_calls')
),
audit as (

-- ---------------------------------------------------------------- ledger state
select
  '00000000000000'::text as migration_version,
  '(ledger state for range 12..24)'::text as migration_name,
  'rows present in supabase_migrations.schema_migrations between 12 and 24'::text as expected_fingerprint,
  coalesce((select present from ledger), '(none in range)')::text as observed,
  'CONTEXT'::text as verdict

-- ------------------------------------------------------------------------- 12
union all select
  '20260812000000',
  'foundry_learner_decision_v1',
  'progress.decision_response_text + decision_submitted_at + foundry_progress_decision_pair_chk',
  format('cols=%s/2 | chk=%s',
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='foundry_event_training_progress'
        and column_name in ('decision_response_text','decision_submitted_at')),
    coalesce((select pg_get_constraintdef(oid) from pg_constraint
      where conname='foundry_progress_decision_pair_chk'
        and conrelid=to_regclass('public.foundry_event_training_progress')),'ABSENT')),
  case when (select count(*) from information_schema.columns
               where table_schema='public' and table_name='foundry_event_training_progress'
                 and column_name in ('decision_response_text','decision_submitted_at')) = 2
        and exists (select 1 from pg_constraint
               where conname='foundry_progress_decision_pair_chk'
                 and conrelid=to_regclass('public.foundry_event_training_progress'))
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 13
union all select
  '20260813000000',
  'foundry_behavior_observations_v1',
  'table foundry_behavior_observations + outcome/not-self CHECKs + 2 indexes + RLS enabled',
  format('table=%s | outcome_chk=%s | not_self_chk=%s | idx=%s/2 | rls=%s',
    coalesce(to_regclass('public.foundry_behavior_observations')::text,'ABSENT'),
    coalesce((select pg_get_constraintdef(oid) from pg_constraint
      where conname='foundry_observation_outcome_check'
        and conrelid=to_regclass('public.foundry_behavior_observations')),'ABSENT'),
    case when exists (select 1 from pg_constraint
      where conname='foundry_observation_not_self_check'
        and conrelid=to_regclass('public.foundry_behavior_observations')) then 'present' else 'ABSENT' end,
    (select count(*) from pg_indexes where schemaname='public'
       and indexname in ('foundry_observations_followup_idx','foundry_observations_observer_idx')),
    coalesce((select relrowsecurity::text from pg_class
       where oid=to_regclass('public.foundry_behavior_observations')),'n/a')),
  case when to_regclass('public.foundry_behavior_observations') is not null
        and exists (select 1 from pg_constraint where conname='foundry_observation_outcome_check'
              and conrelid=to_regclass('public.foundry_behavior_observations'))
        and exists (select 1 from pg_constraint where conname='foundry_observation_not_self_check'
              and conrelid=to_regclass('public.foundry_behavior_observations'))
        and (select count(*) from pg_indexes where schemaname='public'
               and indexname in ('foundry_observations_followup_idx','foundry_observations_observer_idx')) = 2
        and coalesce((select relrowsecurity from pg_class
               where oid=to_regclass('public.foundry_behavior_observations')), false)
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 14
union all select
  '20260814000000',
  'foundry_observation_occurrence_date_v1',
  'observations.observed_on (date, NOT NULL) + observation_timezone_snapshot + unique occurrence index',
  format('observed_on=%s nullable=%s | tz_snapshot=%s | uniq_idx=%s | date_idx=%s',
    coalesce((select data_type from information_schema.columns
      where table_schema='public' and table_name='foundry_behavior_observations'
        and column_name='observed_on'),'ABSENT'),
    coalesce((select is_nullable from information_schema.columns
      where table_schema='public' and table_name='foundry_behavior_observations'
        and column_name='observed_on'),'n/a'),
    case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='foundry_behavior_observations'
        and column_name='observation_timezone_snapshot') then 'present' else 'ABSENT' end,
    case when exists (select 1 from pg_indexes where schemaname='public'
        and indexname='foundry_observation_occurrence_unique') then 'present' else 'ABSENT' end,
    case when exists (select 1 from pg_indexes where schemaname='public'
        and indexname='foundry_observations_followup_date_idx') then 'present' else 'ABSENT' end),
  case when (select is_nullable from information_schema.columns
               where table_schema='public' and table_name='foundry_behavior_observations'
                 and column_name='observed_on') = 'NO'
        and exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='foundry_behavior_observations'
                 and column_name='observation_timezone_snapshot')
        and exists (select 1 from pg_indexes where schemaname='public'
               and indexname='foundry_observation_occurrence_unique')
        and exists (select 1 from pg_indexes where schemaname='public'
               and indexname='foundry_observations_followup_date_idx')
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 15
union all select
  '20260815000000',
  'foundry_program_child_refusal_code_v1',
  'attempt_calls.refusal_code + refusal_kind',
  format('cols=%s/2', (select count(*) from information_schema.columns
    where table_schema='public' and table_name='foundry_program_generation_attempt_calls'
      and column_name in ('refusal_code','refusal_kind'))),
  case when (select count(*) from information_schema.columns
               where table_schema='public' and table_name='foundry_program_generation_attempt_calls'
                 and column_name in ('refusal_code','refusal_kind')) = 2
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 16
-- SUPERSEDED BY 18 AND 20. Its end-state (enum ending at interrogative_action)
-- is overwritten by any later widening, so a wider live constraint can neither
-- confirm nor deny that 16 ran. That is AMBIGUOUS, not PASS.
union all select
  '20260816000000',
  'foundry_program_contract_reason_interrogative_v1',
  'behavior_contract_reason CHECK admits interrogative_action (superseded by 18/20)',
  coalesce((select d from bcr),'CONSTRAINT ABSENT'),
  case
    when (select d from bcr) is null then 'FAIL'
    when (select d from bcr) like '%confirmer_unauthorized%'
      or (select d from bcr) like '%action_reclaims_authority%' then 'AMBIGUOUS'
    when (select d from bcr) like '%interrogative_action%' then 'PASS'
    else 'FAIL' end

-- ------------------------------------------------------------------------- 17
union all select
  '20260817000000',
  'foundry_program_repair_freeze_verdict_v1',
  'attempt_calls.repair_freeze_violated (boolean, nullable)',
  format('col=%s nullable=%s',
    coalesce((select data_type from information_schema.columns
      where table_schema='public' and table_name='foundry_program_generation_attempt_calls'
        and column_name='repair_freeze_violated'),'ABSENT'),
    coalesce((select is_nullable from information_schema.columns
      where table_schema='public' and table_name='foundry_program_generation_attempt_calls'
        and column_name='repair_freeze_violated'),'n/a')),
  case when exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='foundry_program_generation_attempt_calls'
                 and column_name='repair_freeze_violated')
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 18
-- SUPERSEDED BY 20, same constraint.
union all select
  '20260818000000',
  'foundry_program_contract_reason_role_authority_v1',
  'behavior_contract_reason CHECK admits confirmer_unauthorized (superseded by 20)',
  coalesce((select d from bcr),'CONSTRAINT ABSENT'),
  case
    when (select d from bcr) is null then 'FAIL'
    when (select d from bcr) like '%action_reclaims_authority%' then 'AMBIGUOUS'
    when (select d from bcr) like '%confirmer_unauthorized%' then 'PASS'
    else 'FAIL' end

-- ------------------------------------------------------------------------- 19
union all select
  '20260819000000',
  'foundry_module_builder_step_graph_v2',
  'foundry_module_drafts_current_step_check upper bound widened 8 -> 9',
  coalesce((select pg_get_constraintdef(oid) from pg_constraint
    where conname='foundry_module_drafts_current_step_check'
      and conrelid=to_regclass('public.foundry_module_drafts')),'ABSENT'),
  case when (select pg_get_constraintdef(oid) from pg_constraint
               where conname='foundry_module_drafts_current_step_check'
                 and conrelid=to_regclass('public.foundry_module_drafts')) like '%9%'
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 20
union all select
  '20260820000000',
  'foundry_program_contract_reason_action_authority_v1',
  'behavior_contract_reason CHECK admits action_reclaims_authority (final state of the chain)',
  coalesce((select d from bcr),'CONSTRAINT ABSENT'),
  case when (select d from bcr) like '%action_reclaims_authority%' then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 21
union all select
  '20260821000000',
  'foundry_program_semantic_reason_diagnostics_v1',
  'attempt_calls.scenario_contract_reason + evidence_policy_rule + their two CHECKs',
  format('cols=%s/2 | scenario_chk=%s | evidence_chk=%s',
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='foundry_program_generation_attempt_calls'
        and column_name in ('scenario_contract_reason','evidence_policy_rule')),
    case when exists (select 1 from pg_constraint
      where conname='foundry_program_call_scenario_contract_reason_check'
        and conrelid=to_regclass('public.foundry_program_generation_attempt_calls')) then 'present' else 'ABSENT' end,
    case when exists (select 1 from pg_constraint
      where conname='foundry_program_call_evidence_policy_rule_check'
        and conrelid=to_regclass('public.foundry_program_generation_attempt_calls')) then 'present' else 'ABSENT' end),
  case when (select count(*) from information_schema.columns
               where table_schema='public' and table_name='foundry_program_generation_attempt_calls'
                 and column_name in ('scenario_contract_reason','evidence_policy_rule')) = 2
        and exists (select 1 from pg_constraint
               where conname='foundry_program_call_scenario_contract_reason_check'
                 and conrelid=to_regclass('public.foundry_program_generation_attempt_calls'))
        and exists (select 1 from pg_constraint
               where conname='foundry_program_call_evidence_policy_rule_check'
                 and conrelid=to_regclass('public.foundry_program_generation_attempt_calls'))
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 22
union all select
  '20260822000000',
  'foundry_learner_reflection_v1',
  'progress.learner_reflection_text + _submitted_at + pair CHECK + length CHECK',
  format('cols=%s/2 | pair=%s | len=%s',
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='foundry_event_training_progress'
        and column_name in ('learner_reflection_text','learner_reflection_submitted_at')),
    case when exists (select 1 from pg_constraint
      where conname='foundry_progress_learner_reflection_pair_chk'
        and conrelid=to_regclass('public.foundry_event_training_progress')) then 'present' else 'ABSENT' end,
    case when exists (select 1 from pg_constraint
      where conname='foundry_progress_learner_reflection_len_chk'
        and conrelid=to_regclass('public.foundry_event_training_progress')) then 'present' else 'ABSENT' end),
  case when (select count(*) from information_schema.columns
               where table_schema='public' and table_name='foundry_event_training_progress'
                 and column_name in ('learner_reflection_text','learner_reflection_submitted_at')) = 2
        and exists (select 1 from pg_constraint
               where conname='foundry_progress_learner_reflection_pair_chk'
                 and conrelid=to_regclass('public.foundry_event_training_progress'))
        and exists (select 1 from pg_constraint
               where conname='foundry_progress_learner_reflection_len_chk'
                 and conrelid=to_regclass('public.foundry_event_training_progress'))
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 23
union all select
  '20260823000000',
  'foundry_participant_apply_windows_v1',
  'table + 4 CHECK/UNIQUE + 2 indexes + RLS + 2 SECURITY DEFINER functions',
  format('table=%s | cons=%s/4 | idx=%s/2 | rls=%s | fns=%s/2 secdef=%s/2',
    coalesce(to_regclass('public.foundry_participant_apply_windows')::text,'ABSENT'),
    (select count(*) from pg_constraint
       where conrelid=to_regclass('public.foundry_participant_apply_windows')
         and conname in ('foundry_apply_window_days_check','foundry_apply_window_title_len_check',
                         'foundry_apply_window_order_check','foundry_apply_window_unique_progress')),
    (select count(*) from pg_indexes where schemaname='public'
       and indexname in ('foundry_apply_windows_owner_due_idx','foundry_apply_windows_event_idx')),
    coalesce((select relrowsecurity::text from pg_class
       where oid=to_regclass('public.foundry_participant_apply_windows')),'n/a'),
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname in
         ('bty_foundry_materialize_apply_window','bty_foundry_list_my_apply_windows')),
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef
         and p.proname in ('bty_foundry_materialize_apply_window','bty_foundry_list_my_apply_windows'))),
  case when to_regclass('public.foundry_participant_apply_windows') is not null
        and (select count(*) from pg_constraint
               where conrelid=to_regclass('public.foundry_participant_apply_windows')
                 and conname in ('foundry_apply_window_days_check','foundry_apply_window_title_len_check',
                                 'foundry_apply_window_order_check','foundry_apply_window_unique_progress')) = 4
        and (select count(*) from pg_indexes where schemaname='public'
               and indexname in ('foundry_apply_windows_owner_due_idx','foundry_apply_windows_event_idx')) = 2
        and coalesce((select relrowsecurity from pg_class
               where oid=to_regclass('public.foundry_participant_apply_windows')), false)
        and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.prosecdef and p.proname in
                 ('bty_foundry_materialize_apply_window','bty_foundry_list_my_apply_windows')) = 2
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------------------------------- 24
union all select
  '20260824000000',
  'foundry_guidance_material_types_v1',
  'content_type CHECK admits 4 values + 2 evidence columns + widened completion CHECK',
  format('content_type=%s || evidence_cols=%s/2 || completion=%s',
    coalesce((select pg_get_constraintdef(oid) from pg_constraint
      where conname='foundry_events_content_type_check'
        and conrelid=to_regclass('public.foundry_events')),'ABSENT'),
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='foundry_event_training_progress'
        and column_name in ('written_guidance_read_at','discussion_self_reported_at')),
    coalesce((select pg_get_constraintdef(oid) from pg_constraint
      where conrelid=to_regclass('public.foundry_event_training_progress')
        and conname like 'foundry_training_progress_completed_needs_evidence%'),'ABSENT')),
  case when (select pg_get_constraintdef(oid) from pg_constraint
               where conname='foundry_events_content_type_check'
                 and conrelid=to_regclass('public.foundry_events')) like '%written_guidance%'
        and (select pg_get_constraintdef(oid) from pg_constraint
               where conname='foundry_events_content_type_check'
                 and conrelid=to_regclass('public.foundry_events')) like '%live_discussion%'
        and (select count(*) from information_schema.columns
               where table_schema='public' and table_name='foundry_event_training_progress'
                 and column_name in ('written_guidance_read_at','discussion_self_reported_at')) = 2
        and (select pg_get_constraintdef(oid) from pg_constraint
               where conrelid=to_regclass('public.foundry_event_training_progress')
                 and conname like 'foundry_training_progress_completed_needs_evidence%')
              like '%written_guidance_read_at%'
       then 'PASS' else 'FAIL' end

-- ------------------------------------------------- durable-data corroboration
-- SCHEMA ALONE CANNOT SEPARATE 16 / 18 / 20 (one constraint, rewritten three
-- times). Data can corroborate: a stored value that only became legal at a given
-- stage proves the constraint permitted it when that row was written. Absence
-- proves nothing (the code may simply never have emitted it), so this is
-- CONTEXT, never a verdict.
union all select
  '20260816000000',
  '(corroboration) rows written with interrogative_action',
  'any durable attempt_call row holding behavior_contract_reason = interrogative_action',
  format('rows=%s', coalesce((select count(*)::text from public.foundry_program_generation_attempt_calls
    where behavior_contract_reason = 'interrogative_action'),'n/a')),
  'CONTEXT'

union all select
  '20260818000000',
  '(corroboration) rows written with confirmer_unauthorized',
  'any durable attempt_call row holding behavior_contract_reason = confirmer_unauthorized',
  format('rows=%s', coalesce((select count(*)::text from public.foundry_program_generation_attempt_calls
    where behavior_contract_reason = 'confirmer_unauthorized'),'n/a')),
  'CONTEXT'

union all select
  '20260820000000',
  '(corroboration) rows written with action_reclaims_authority',
  'any durable attempt_call row holding behavior_contract_reason = action_reclaims_authority',
  format('rows=%s', coalesce((select count(*)::text from public.foundry_program_generation_attempt_calls
    where behavior_contract_reason = 'action_reclaims_authority'),'n/a')),
  'CONTEXT'
)
select * from audit order by migration_version, verdict desc;
