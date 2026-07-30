-- ============================================================================
-- CANONICAL read-only live audit query for migrations 20260726–20260729 (Slice 3.2I-R5B1A.1-R2.2).
-- Paste into the Supabase SQL Editor and run. It returns ONE row / ONE JSON value:
--   { "serverVersionNum": <int>, "effects": [ { effectId, objectType, objectIdentity, grp,
--     properties, definitionDigest, comparisonMode, autoComparable, manualReason }, ... ] }
-- Export that single JSON cell to a file and pass it to:
--   npm run compare:foundry-migration-audit -- <that-file>
--
-- STRICTLY read-only: only pg_catalog / information_schema. NO INSERT/UPDATE/DELETE/ALTER/CREATE/
-- DROP/GRANT/REVOKE. It NEVER selects application rows, so it cannot leak Training text, emails,
-- guided_answers JSON, or constraint statements — only structured catalog metadata + version-stable
-- digests. This is the SAME query the disposable-Postgres generator runs to build the EXPECTED
-- manifest (build-expected-manifest.sh), so live and expected are produced identically.
-- Running this audit does NOT authorize any migration repair or schema apply.
-- ============================================================================
with
cols(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
  select 'column:'||table_schema||'.'||table_name||'.'||column_name,
         'column', table_schema||'.'||table_name||'.'||column_name,
         case when table_name='user_conversation_preferences' then 'g27'
              when table_name in ('foundry_participant_followups','foundry_participant_followup_audit') then 'g28'
              else 'g26' end,
         jsonb_build_object('data_type',data_type,'is_nullable',is_nullable,'column_default',column_default),
         null::text, 'structured', true, null::text
  from information_schema.columns
  where table_schema='public' and (
    (table_name='foundry_event_training_content' and column_name='shared_question') or
    (table_name='foundry_event_document_content' and column_name='shared_question') or
    (table_name='foundry_event_training_progress' and column_name in
       ('shared_understanding_response','shared_response_submitted_at','host_review_status','host_reviewed_at',
        'host_reviewed_by','host_reviewed_by_snapshot','host_review_note')) or
    (table_name='user_conversation_preferences' and column_name='personalize_today_from_reflections') or
    (table_name in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit'))
  )
),
tbls(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
  select 'table:public.'||t, 'table', 'public.'||t,
    case when t='foundry_shared_review_audit' then 'g26' else 'g28' end,
    (select jsonb_agg(c.column_name order by c.ordinal_position) from information_schema.columns c
       where c.table_schema='public' and c.table_name=t),
    null::text, 'structured', true, null::text
  from unnest(array['foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit']) as t
  where exists (select 1 from information_schema.tables it where it.table_schema='public' and it.table_name=t)
),
cons(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
  select 'constraint:public.'||c.conrelid::regclass::text||'.'||c.conname, 'constraint',
         c.conrelid::regclass::text||'.'||c.conname,
         case when c.conrelid::regclass::text like '%followup%' then 'g28' else 'g26' end,
         jsonb_build_object('contype',c.contype::text),
         md5(regexp_replace(pg_get_constraintdef(c.oid),'\s+',' ','g')),
         'structured+digest', true, null::text
  from pg_constraint c
  where c.connamespace='public'::regnamespace
    and c.conrelid::regclass::text in (
      'foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit',
      'foundry_event_training_progress','foundry_event_training_content','foundry_event_document_content')
    and c.contype in ('c','u')
),
idx(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
  select 'index:public.'||ic.relname, 'index', 'public.'||ic.relname,
         case when ic.relname like 'foundry_shared_review%' then 'g26' else 'g28' end,
         jsonb_build_object('is_unique',i.indisunique,'target',i.indrelid::regclass::text,
           'keys',(select string_agg(a.attname,',' order by k.ord) from unnest(i.indkey) with ordinality k(attnum,ord)
                    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum),
           'predicate',pg_get_expr(i.indpred,i.indrelid)),
         md5(regexp_replace(pg_get_indexdef(i.indexrelid),'\s+',' ','g')),
         'structured+digest', true, null::text
  from pg_index i join pg_class ic on ic.oid=i.indexrelid join pg_namespace n on n.oid=ic.relnamespace
  where n.nspname='public' and ic.relname in
    ('foundry_shared_review_audit_participant_idx','foundry_followups_owner_due_idx',
     'foundry_followups_event_idx','foundry_followup_audit_followup_idx')
),
fns(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
  select 'function:public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', 'function',
         'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
         case when p.proname='bty_foundry_submit_followup' then 'g29'
              when p.proname='bty_foundry_set_shared_review' then 'g26' else 'g28' end,
         jsonb_build_object('identity_args',pg_get_function_identity_arguments(p.oid),
           'result',pg_get_function_result(p.oid),'language',l.lanname,'volatility',p.provolatile,
           'strict',p.proisstrict,'security_definer',p.prosecdef,'proconfig',to_jsonb(p.proconfig)),
         md5(regexp_replace(btrim(p.prosrc),'\s+',' ','g')),
         'structured+body_digest', true, null::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.proname in
    ('bty_foundry_set_shared_review','bty_foundry_materialize_followup','bty_foundry_submit_followup','bty_foundry_get_my_followup')
),
rls(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
  select 'rls:public.'||c.relname, 'rls', 'public.'||c.relname,
         case when c.relname like '%shared_review%' then 'g26' else 'g28' end,
         jsonb_build_object('rls_enabled', c.relrowsecurity,
           'policy_count', (select count(*) from pg_policy pol where pol.polrelid=c.oid)),
         null::text, 'structured', true, null::text
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in
    ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
),
allrows as (
  select * from cols union all select * from tbls union all select * from cons
  union all select * from idx union all select * from fns union all select * from rls
)
select json_build_object(
  'serverVersionNum', current_setting('server_version_num')::int,
  'effects', coalesce(json_agg(json_build_object(
    'effectId',effect_id,'objectType',object_type,'objectIdentity',object_identity,'grp',grp,
    'properties',properties,'definitionDigest',definition_digest,'comparisonMode',comparison_mode,
    'autoComparable',auto_comparable,'manualReason',manual_reason) order by effect_id), '[]'::json)
) as audit
from allrows;
