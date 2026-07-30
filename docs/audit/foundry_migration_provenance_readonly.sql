-- ============================================================================
-- GENERATED — do not hand-edit. Regenerate: bash scripts/migration-proof/build-expected-manifest.sh
-- Self-authenticating read-only live audit for migrations 20260726-20260729 (Slice R2.4).
-- Paste into the Supabase SQL Editor and run. Returns ONE row / ONE JSON value (column "audit")
-- carrying the packetId + every component digest, so the comparator can prove exactly which
-- manifest / migration files / security map / query body / comparator contract produced it.
-- STRICTLY read-only (pg_catalog / information_schema / aclexplode). Authorizes NO repair or apply.
-- ============================================================================
select json_build_object(
  'auditSchemaVersion', 'r2.4',
  'auditPacketVersion', 'r2.4',
  'packetId', 'b841a33b189ac9b8121a4c4edd48c8662c630d483f0391cec05fa71ac244cd35',
  'expectedManifestDigest', 'ccb5c71fb5956e771b489d5395bc691a770e0cc1309d7cac7739f58eba44fd6d',
  'provenanceDigest', '22fc47c918287661027f041c69647cd28f41491fcc69740b6519afbd81f42767',
  'securityStatementMapDigest', 'f0d46b8b9aa4a13188c578e173183b9257e98d72a168cea5b7ea1aa5ff63120d',
  'auditQueryBodyDigest', '4ea030f1a098b1693e3a7da1b8484568e10635c35bf828c01fd229629fed9c0f',
  'comparatorContractVersion', 'r2.4',
  'migrationChecksums', '{"20260726000000":"8231a657c173dd99b9faa3872a895873fc98ca8b7d092f0cbfd0ccfc27624cd1","20260727000000":"b06b376232b874f1138bdb0419f4113b7decd38a8e0869a052a4af784c6c7cad","20260728000000":"381246235014f5da761d44fcd0d0e13d4cee0c373c71edc35f73fed8b2453027","20260729000000":"abe8ae0b206bf5002edae9383fc057fcbfce7a25cd7462d973ec73d3e8a3abc2"}'::json,
  'serverVersionNum', current_setting('server_version_num')::int,
  'effects', (
    -- CANONICAL audit query BODY (Slice 3.2I-R5B1A.1-R2.4). Returns ONE json array of effects. It is
    -- (a) run directly on disposable Postgres to build the EXPECTED manifest, and (b) inlined verbatim
    -- as a subquery into the generated live audit SQL (docs/audit/foundry_migration_provenance_readonly.sql)
    -- so expected and live can NEVER drift. Its SHA-256 is the auditQueryBodyDigest bound into packetId.
    -- STRICTLY read-only: pg_catalog / information_schema + aclexplode() only. No application rows.
    -- Privileges are compared as EXACT ACL tuples (aclexplode of the object ACL) — never effective
    -- has_*_privilege() access, which owner rights / PUBLIC / role inheritance can falsely satisfy.
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
               'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,
               'security_definer',p.prosecdef,'proconfig',to_jsonb(p.proconfig)),
             encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
             'structured+body_digest', true, null::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
      where n.nspname='public' and p.proname in
        ('bty_foundry_set_shared_review','bty_foundry_materialize_followup','bty_foundry_submit_followup','bty_foundry_get_my_followup')
    ),
    rls(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'rls:public.'||c.relname, 'rls', 'public.'||c.relname,
             case when c.relname like '%shared_review%' then 'g26' else 'g28' end,
             jsonb_build_object('rls_enabled', c.relrowsecurity), null::text, 'structured', true, null::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in
        ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
    ),
    pol(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'policies:public.'||c.relname, 'policies', 'public.'||c.relname,
             case when c.relname like '%shared_review%' then 'g26' else 'g28' end,
             coalesce((select jsonb_agg(jsonb_build_object(
                 'name',pp.polname,'cmd',pp.polcmd::text,'permissive',pp.polpermissive,
                 'roles',(select jsonb_agg(r.rolname order by r.rolname) from pg_roles r where r.oid = any(pp.polroles)),
                 'using',pg_get_expr(pp.polqual,pp.polrelid),
                 'withCheck',pg_get_expr(pp.polwithcheck,pp.polrelid)) order by pp.polname)
               from pg_policy pp where pp.polrelid=c.oid), '[]'::jsonb),
             null::text, 'structured', true, null::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in
        ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
    ),
    -- EXACT function ACL (Gate 1): the explicit tuple set for migration-controlled roles only. Expected
    -- = exactly [{service_role, EXECUTE, grantable:false}]; PUBLIC/anon/authenticated revoked → absent.
    facl(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'acl:function:public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', 'acl_function',
             'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
             case when p.proname='bty_foundry_submit_followup' then 'g29'
                  when p.proname='bty_foundry_set_shared_review' then 'g26' else 'g28' end,
             jsonb_build_object('tuples', coalesce((
               select jsonb_agg(jsonb_build_object(
                   'grantee', case when a.grantee=0 then 'PUBLIC' else gr.rolname end,
                   'privilege', a.privilege_type, 'grantable', a.is_grantable)
                 order by (case when a.grantee=0 then 'PUBLIC' else gr.rolname end), a.privilege_type)
               from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               left join pg_roles gr on gr.oid=a.grantee
               where a.grantee=0 or gr.rolname in ('anon','authenticated','service_role')), '[]'::jsonb)),
             null::text, 'structured', true, null::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in
        ('bty_foundry_set_shared_review','bty_foundry_materialize_followup','bty_foundry_submit_followup','bty_foundry_get_my_followup')
    ),
    -- EXACT table ACL (Gate 1): explicit tuples for controlled roles. Expected = [] (revoke all;
    -- owner implicit rights are NOT explicit ACL grants and are excluded).
    tacl(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'acl:table:public.'||c.relname, 'acl_table', 'public.'||c.relname,
             case when c.relname like '%shared_review%' then 'g26' else 'g28' end,
             jsonb_build_object('tuples', coalesce((
               select jsonb_agg(jsonb_build_object(
                   'grantee', case when a.grantee=0 then 'PUBLIC' else gr.rolname end,
                   'privilege', a.privilege_type, 'grantable', a.is_grantable)
                 order by (case when a.grantee=0 then 'PUBLIC' else gr.rolname end), a.privilege_type)
               from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
               left join pg_roles gr on gr.oid=a.grantee
               where a.grantee=0 or gr.rolname in ('anon','authenticated','service_role')), '[]'::jsonb)),
             null::text, 'structured', true, null::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in
        ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
    ),
    allrows as (
      select * from cols union all select * from tbls union all select * from cons union all select * from idx
      union all select * from fns union all select * from rls union all select * from pol
      union all select * from facl union all select * from tacl
    )
    select coalesce(json_agg(json_build_object(
      'effectId',effect_id,'objectType',object_type,'objectIdentity',object_identity,'grp',grp,
      'properties',properties,'definitionDigest',definition_digest,'comparisonMode',comparison_mode,
      'autoComparable',auto_comparable,'manualReason',manual_reason) order by effect_id), '[]'::json)
    from allrows
  )
) as audit;
