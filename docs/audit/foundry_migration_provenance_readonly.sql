-- ============================================================================
-- READ-ONLY provenance audit for migrations 20260726–20260729 (Slice 3.2I-R5B1A.1-R2.1).
-- Paste into the Supabase SQL Editor and run. It is STRICTLY read-only: only pg_catalog /
-- information_schema / migration-history metadata. It performs NO INSERT/UPDATE/DELETE/ALTER/
-- CREATE/DROP/GRANT/REVOKE and NEVER selects application rows, so it cannot leak Training text,
-- emails, guided_answers JSON, or constraint statements. Return every result set to the engineer;
-- they will be compared against the disposable-Postgres expected definitions. Do NOT send credentials.
-- ============================================================================

-- 0) Migration ledger: which of the six versions are recorded as applied?
select version
from supabase_migrations.schema_migrations
where version in ('20260726000000','20260727000000','20260728000000','20260729000000',
                  '20260802000000','20260803000000')
order by version;

-- ---------------------------------------------------------------------------
-- 1) TABLE + COLUMN evidence (type / nullability / default / identity) for every table the four
--    migrations create or alter. No table DATA is read.
select table_name, column_name, data_type, is_nullable, column_default, is_identity, is_generated
from information_schema.columns
where table_schema='public'
  and (table_name in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
       or (table_name='user_conversation_preferences' and column_name='personalize_today_from_reflections'))
order by table_name, ordinal_position;

-- 2) CONSTRAINTS (pk/fk/check/unique) on those tables, with exact expressions.
select conrelid::regclass as tbl, conname, contype, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid in ('public.foundry_shared_review_audit'::regclass,
                   'public.foundry_participant_followups'::regclass,
                   'public.foundry_participant_followup_audit'::regclass)
order by tbl, conname;

-- 3) INDEXES + partial predicates on those tables.
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
order by tablename, indexname;

-- 4) RLS enablement + policies (command / roles / using / check) on those tables.
select c.relname as tbl, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit');

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
order by tablename, policyname;

-- 5) GRANTS on those tables (recipient / privilege).
select table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
order by table_name, grantee, privilege_type;

-- 6) TRIGGERS on those tables.
select event_object_table as tbl, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema='public'
  and event_object_table in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
order by tbl, trigger_name;

-- ---------------------------------------------------------------------------
-- 7) FUNCTION identity + attributes for every function the four migrations define. This is the
--    decisive evidence for 20260729 (the 42702 fix REPLACES bty_foundry_submit_followup).
select p.oid::regprocedure as signature,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as result_type,
       l.lanname as language,
       p.provolatile as volatility,     -- i=immutable s=stable v=volatile
       p.prosecdef as security_definer,
       p.proconfig as config             -- includes search_path if set
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
join pg_language l on l.oid=p.prolang
where n.nspname='public'
  and p.proname in ('bty_foundry_set_shared_review','bty_foundry_materialize_followup',
                    'bty_foundry_submit_followup','bty_foundry_get_my_followup')
order by p.proname;

-- 8) FULL function definitions (schema only — not application data). Compare byte-for-byte (after
--    formatting normalization) against the disposable-Postgres expected definition; for
--    20260729 the CURRENT live body must equal the FIXED (42702-resolved) body.
select p.oid::regprocedure as signature, md5(pg_get_functiondef(p.oid)) as body_md5,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('bty_foundry_set_shared_review','bty_foundry_materialize_followup',
                    'bty_foundry_submit_followup','bty_foundry_get_my_followup')
order by p.proname;
