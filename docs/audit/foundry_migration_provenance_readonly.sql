-- ============================================================================
-- GENERATED — do not hand-edit. Regenerate: bash scripts/migration-proof/build-expected-manifest.sh
-- Runtime-attested read-only live audit for migrations 20260726-20260729 (Slice R2.5). ONE
-- statement. Run in a trusted runner (psql -f) that exposes current_query(); returns one JSON
-- value (column "audit") whose actualRuntimeQueryDigest MEASURES the statement that actually ran
-- (only the self-referential packetId + expectedRuntimeQueryDigest literals are canonicalized).
-- STRICTLY read-only. Authorizes NO repair or apply.
-- ============================================================================
select json_build_object(
  'auditSchemaVersion', 'r2.6',
  'auditPacketVersion', 'r2.6',
  'runtimeQueryContractVersion', 'r2.6',
  'comparatorContractVersion', 'r2.6',
  'packetId', 'd5171bbd503388a1ec9ac34aa11e05026b800f79f607697e809e416b2f1705d8',
  'expectedManifestDigest', '78f5ebdb9fb13fc8a6bf4ea4306bae675ac743a2524c34919d947fd833a7d82a',
  'provenanceDigest', '22fc47c918287661027f041c69647cd28f41491fcc69740b6519afbd81f42767',
  'securityStatementMapDigest', 'ebee25acb1705deeae62235a090c372f58552534e0f684598b904655e8b0c4cf',
  'constraintStatementMapDigest', 'cfcd0c08f7c2f5ae63a05aa9948d1d59732cb575a34c3f31693f56b50bb943e2',
  'auditQueryBodyDigest', 'd055bf79ecd1366ce72ecf15b1f7d2c115b635117377ad96592aa175337d8bf6',
  'migrationChecksums', '{"20260726000000":"8231a657c173dd99b9faa3872a895873fc98ca8b7d092f0cbfd0ccfc27624cd1","20260727000000":"b06b376232b874f1138bdb0419f4113b7decd38a8e0869a052a4af784c6c7cad","20260728000000":"381246235014f5da761d44fcd0d0e13d4cee0c373c71edc35f73fed8b2453027","20260729000000":"abe8ae0b206bf5002edae9383fc057fcbfce7a25cd7462d973ec73d3e8a3abc2"}'::json,
  'expectedRuntimeQueryDigest', '0681b082199b2e8250a93a820cc9ee9c5236e808017f37ac86380b96078b256e',
  'actualRuntimeQueryDigest', encode(sha256(convert_to(
    regexp_replace(
      regexp_replace(current_query(), $q1$('packetId', ')[0-9a-f]{64}(')$q1$, $r1$\1__PID__\2$r1$, 'g'),
      $q2$('expectedRuntimeQueryDigest', ')[0-9a-f]{64}(')$q2$, $r2$\1__RQD__\2$r2$, 'g'),
    'UTF8')), 'hex'),
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
    -- Ordered column names for a constraint key array (conkey / confkey) on a given relation.
    -- (inlined per constraint below via lateral subselects)
    -- PRIMARY KEY — first-class (Gate 4): ordered keys + deferrability + validation + exact def.
    pk(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'pk:'||c.conrelid::regclass::text||'.'||c.conname, 'pk', c.conrelid::regclass::text||'.'||c.conname,
             case when c.conrelid::regclass::text like '%shared_review%' then 'g26' else 'g28' end,
             jsonb_build_object('contype','p','table',c.conrelid::regclass::text,
               'keys',(select jsonb_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum),
               'deferrable',c.condeferrable,'initiallyDeferred',c.condeferred,'validated',c.convalidated),
             md5(regexp_replace(pg_get_constraintdef(c.oid),'\s+',' ','g')),
             'structured+digest', true, null::text
      from pg_constraint c where c.connamespace='public'::regnamespace and c.contype='p'
        and c.conrelid::regclass::text in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
    ),
    -- FOREIGN KEY — first-class (Gate 5): full behavioral contract, not just the target name.
    fk(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'fk:'||c.conrelid::regclass::text||'.'||c.conname, 'fk', c.conrelid::regclass::text||'.'||c.conname,
             case when c.conrelid::regclass::text like '%shared_review%' then 'g26' else 'g28' end,
             jsonb_build_object('contype','f','table',c.conrelid::regclass::text,
               'sourceColumns',(select jsonb_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum),
               'refTable',c.confrelid::regclass::text,
               'refColumns',(select jsonb_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.attnum),
               'onUpdate',c.confupdtype,'onDelete',c.confdeltype,'matchType',c.confmatchtype,
               'deferrable',c.condeferrable,'initiallyDeferred',c.condeferred,'validated',c.convalidated),
             md5(regexp_replace(pg_get_constraintdef(c.oid),'\s+',' ','g')),
             'structured+digest', true, null::text
      from pg_constraint c where c.connamespace='public'::regnamespace and c.contype='f'
        and c.conrelid::regclass::text in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
    ),
    -- UNIQUE — first-class (Gate 6): ordered keys + nulls-not-distinct + deferrability + validation.
    uniq(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'unique:'||c.conrelid::regclass::text||'.'||c.conname, 'unique', c.conrelid::regclass::text||'.'||c.conname,
             case when c.conrelid::regclass::text like '%shared_review%' then 'g26' else 'g28' end,
             jsonb_build_object('contype','u','table',c.conrelid::regclass::text,
               'keys',(select jsonb_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum),
               'nullsNotDistinct',(select not i.indnullsnotdistinct is not true from pg_index i where i.indexrelid=c.conindid),
               'deferrable',c.condeferrable,'initiallyDeferred',c.condeferred,'validated',c.convalidated),
             md5(regexp_replace(pg_get_constraintdef(c.oid),'\s+',' ','g')),
             'structured+digest', true, null::text
      from pg_constraint c where c.connamespace='public'::regnamespace and c.contype='u'
        and c.conrelid::regclass::text in ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
    ),
    -- CHECK — first-class (Gate 6): exact expression digest + validation + no-inherit + identity.
    chk(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'check:'||c.conrelid::regclass::text||'.'||c.conname, 'check', c.conrelid::regclass::text||'.'||c.conname,
             case when c.conrelid::regclass::text like '%followup%' then 'g28' else 'g26' end,
             jsonb_build_object('contype','c','table',c.conrelid::regclass::text,'validated',c.convalidated,'noInherit',c.connoinherit),
             encode(sha256(convert_to(pg_get_constraintdef(c.oid),'UTF8')),'hex'),
             'structured+body_digest', true, null::text
      from pg_constraint c where c.connamespace='public'::regnamespace and c.contype='c'
        and c.conrelid::regclass::text in (
          'foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit',
          'foundry_event_training_progress','foundry_event_training_content','foundry_event_document_content')
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
    -- EXACT function ACL (Gate 1) scoped to MIGRATION AUTHORITY (R2.6). The migrations both REVOKE from
    -- PUBLIC/anon/authenticated AND GRANT EXECUTE to service_role, so all four grantees are explicitly
    -- statement-controlled and belong in `tuples`. Expected = exactly [{service_role, EXECUTE, false}];
    -- PUBLIC/anon/authenticated revoked → absent. `environmentTuples` is empty BY CONSTRUCTION here:
    -- no Supabase-managed role sits outside function-migration authority.
    facl(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'acl:function:public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', 'acl_function',
             'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
             case when p.proname='bty_foundry_submit_followup' then 'g29'
                  when p.proname='bty_foundry_set_shared_review' then 'g26' else 'g28' end,
             jsonb_build_object(
               'controlledRoles', '["PUBLIC","anon","authenticated","service_role"]'::jsonb,
               'tuples', coalesce((
               select jsonb_agg(jsonb_build_object(
                   'grantee', case when a.grantee=0 then 'PUBLIC' else gr.rolname end,
                   'privilege', a.privilege_type, 'grantable', a.is_grantable)
                 order by (case when a.grantee=0 then 'PUBLIC' else gr.rolname end), a.privilege_type)
               from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               left join pg_roles gr on gr.oid=a.grantee
               where a.grantee=0 or gr.rolname in ('anon','authenticated','service_role')), '[]'::jsonb),
               'environmentTuples', '[]'::jsonb),
             null::text, 'structured', true, null::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in
        ('bty_foundry_set_shared_review','bty_foundry_materialize_followup','bty_foundry_submit_followup','bty_foundry_get_my_followup')
    ),
    -- EXACT table ACL (Gate 1) scoped to MIGRATION AUTHORITY (R2.6). The ONLY table privilege statement
    -- in these migrations is `revoke all on public.<t> from anon, public, authenticated;` — there is no
    -- table GRANT at all. So migration authority over these tables covers PUBLIC/anon/authenticated
    -- ONLY, and expected `tuples` = [] (all revoked; owner implicit rights are NOT explicit ACL grants).
    -- service_role's table privileges come from the Supabase ENVIRONMENT (default privileges), never
    -- from these migrations, so they are reported separately as `environmentTuples` — DIAGNOSTIC, never
    -- compared. An environment privilege is not migration drift unless it contradicts a privilege the
    -- migration explicitly controlled; if service_role were ever explicitly revoked or granted here,
    -- it would move into controlledRoles/tuples and a live mismatch would again be a real conflict.
    tacl(effect_id, object_type, object_identity, grp, properties, definition_digest, comparison_mode, auto_comparable, manual_reason) as (
      select 'acl:table:public.'||c.relname, 'acl_table', 'public.'||c.relname,
             case when c.relname like '%shared_review%' then 'g26' else 'g28' end,
             jsonb_build_object(
               'controlledRoles', '["PUBLIC","anon","authenticated"]'::jsonb,
               'tuples', coalesce((
               select jsonb_agg(jsonb_build_object(
                   'grantee', case when a.grantee=0 then 'PUBLIC' else gr.rolname end,
                   'privilege', a.privilege_type, 'grantable', a.is_grantable)
                 order by (case when a.grantee=0 then 'PUBLIC' else gr.rolname end), a.privilege_type)
               from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
               left join pg_roles gr on gr.oid=a.grantee
               where a.grantee=0 or gr.rolname in ('anon','authenticated')), '[]'::jsonb),
               'environmentTuples', coalesce((
               select jsonb_agg(jsonb_build_object(
                   'grantee', gr.rolname, 'privilege', a.privilege_type, 'grantable', a.is_grantable)
                 order by gr.rolname, a.privilege_type)
               from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
               join pg_roles gr on gr.oid=a.grantee
               where gr.rolname in ('service_role')), '[]'::jsonb)),
             null::text, 'structured', true, null::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in
        ('foundry_shared_review_audit','foundry_participant_followups','foundry_participant_followup_audit')
    ),
    allrows as (
      select * from cols union all select * from tbls
      union all select * from pk union all select * from fk union all select * from uniq union all select * from chk
      union all select * from idx
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
