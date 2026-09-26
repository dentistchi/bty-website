-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- BTY FOUNDER CONSOLIDATION — LIVE-SCHEMA PREFLIGHT (READ-ONLY)
-- One SELECT, no writes, no DDL, no function creation. Paste into the Supabase SQL editor
-- and copy the single JSON cell it returns back to Claude.
-- Auth rows are read through to_jsonb(row) so no GoTrue column name is assumed; token
-- material is stripped before output.
with
  ids(a, b) as (
    select '81f08aa1-44a2-40b1-9190-7866151461a7'::text, '18b1ee80-2200-4bc6-91d7-039ba43f6a50'::text
  ),
  merge_tables(schema_name, table_name) as (
    values
      ('auth','users'), ('auth','identities'), ('auth','sessions'), ('auth','refresh_tokens'),
      ('public','user_day'), ('public','user_learning_paths'), ('public','arena_profiles'),
      ('public','bty_action_captures'), ('public','bty_today_dismissals'),
      ('public','user_conversation_preferences'), ('public','bty_foundry_event_history_dismissals'),
      ('public','foundry_events'), ('public','foundry_event_quizzes'), ('public','foundry_module_drafts'),
      ('public','foundry_program_generation_attempts'), ('public','foundry_programs'),
      ('public','bty_tracked_announcements'), ('public','bty_tracked_announcement_recipients'),
      ('public','bty_announcement_thread_messages'), ('public','bty_announcement_thread_message_reads'),
      ('public','foundry_host_followup_contacts'), ('public','bty_org_memberships'),
      ('public','bty_org_membership_responsibilities'), ('public','foundry_host_grants'),
      ('public','bty_platform_admin_grants'), ('public','bty_microsoft_authority_snapshots'),
      ('public','bty_microsoft_directory_authority'), ('public','arena_consent_log'),
      ('public','clinical_reasoning_traces'), ('public','foundry_teams_training_deliveries'),
      ('public','foundry_teams_training_delivery_attempts'), ('public','memberships')
  ),
  rels as (
    select c.oid, n.nspname as schema_name, c.relname as table_name
    from merge_tables m
    join pg_namespace n on n.nspname = m.schema_name
    join pg_class c on c.relnamespace = n.oid and c.relname = m.table_name and c.relkind in ('r','p')
  )
select jsonb_pretty(jsonb_build_object(
  'measured_at', now(),
  'server_version', current_setting('server_version'),
  'current_user', current_user,

  -- 1/2/3. Auth table shapes, as installed.
  'auth_columns', (
    select jsonb_object_agg(t, cols) from (
      select table_name as t,
             jsonb_agg(column_name || ' ' || data_type
                       || case when is_generated = 'ALWAYS' then ' GENERATED' else '' end
                       order by ordinal_position) as cols
      from information_schema.columns
      where table_schema = 'auth' and table_name in ('users','identities','sessions','refresh_tokens')
      group by table_name) x),

  -- What this SQL-editor role may do to the auth rows the merge would touch.
  'auth_privileges', (
    select jsonb_object_agg(t, jsonb_build_object(
      'select', has_table_privilege(current_user, t, 'SELECT'),
      'update', has_table_privilege(current_user, t, 'UPDATE'),
      'delete', has_table_privilege(current_user, t, 'DELETE'),
      'owner', (select pg_get_userbyid(relowner) from pg_class where oid = to_regclass(t))))
    from unnest(array['auth.users','auth.identities','auth.sessions','auth.refresh_tokens']) t
    where to_regclass(t) is not null),

  -- Identities of A and B: every key except the raw claims blob, plus the two claims that matter.
  'identities', (
    select jsonb_agg((to_jsonb(i) - 'identity_data')
             || jsonb_build_object(
                  'owner', case when (to_jsonb(i)->>'user_id') = ids.a then 'A' else 'B' end,
                  'tid', i.identity_data->'custom_claims'->>'tid',
                  'oid', i.identity_data->'custom_claims'->>'oid',
                  'claim_email', i.identity_data->>'email')
             order by to_jsonb(i)->>'provider')
    from auth.identities i, ids
    where (to_jsonb(i)->>'user_id') in (ids.a, ids.b)),

  -- Nobody else may hold either oid or the Google subject (fail-closed resolver precondition).
  'identity_oid_owners', (
    select jsonb_agg(jsonb_build_object('oid', i.identity_data->'custom_claims'->>'oid',
                                        'user_id', to_jsonb(i)->>'user_id',
                                        'provider', to_jsonb(i)->>'provider'))
    from auth.identities i
    where lower(i.identity_data->'custom_claims'->>'oid') in
          ('644ff2ac-9135-4bcc-9669-c382986e4b60','f5767307-f693-4f8c-8e6c-5fb8a256b895')),
  'google_email_identities', (
    select jsonb_agg(jsonb_build_object('user_id', to_jsonb(i)->>'user_id',
                                        'provider_id', to_jsonb(i)->>'provider_id'))
    from auth.identities i
    where to_jsonb(i)->>'provider' = 'google' and lower(i.identity_data->>'email') = 'ddshanbit@gmail.com'),

  -- Users A and B: every column except secrets.
  'users', (
    select jsonb_agg(
             (to_jsonb(u) - 'encrypted_password' - 'confirmation_token' - 'recovery_token'
                          - 'email_change_token_new' - 'email_change_token_current'
                          - 'reauthentication_token' - 'phone_change_token')
             || jsonb_build_object('owner', case when u.id::text = ids.a then 'A' else 'B' end))
    from auth.users u, ids
    where u.id::text in (ids.a, ids.b)),

  -- Sessions and refresh tokens (counts + non-secret shape only).
  'sessions', (
    select jsonb_agg(jsonb_build_object(
             'owner', case when (to_jsonb(s)->>'user_id') = ids.a then 'A' else 'B' end,
             'row', to_jsonb(s) - 'refresh_token_hmac_key' - 'refresh_token_counter'))
    from auth.sessions s, ids
    where (to_jsonb(s)->>'user_id') in (ids.a, ids.b)),
  'refresh_tokens', (
    select jsonb_agg(jsonb_build_object(
             'owner', owner, 'revoked', revoked, 'n', n))
    from (
      select case when (to_jsonb(r)->>'user_id') = ids.a then 'A' else 'B' end as owner,
             (to_jsonb(r)->>'revoked') as revoked, count(*) as n
      from auth.refresh_tokens r, ids
      where (to_jsonb(r)->>'user_id') in (ids.a, ids.b)
      group by 1, 2) x),

  -- 4/6. Every constraint, unique index and user trigger on every table the merge touches.
  'constraints', (
    select jsonb_agg(jsonb_build_object(
             'table', r.schema_name || '.' || r.table_name, 'name', con.conname,
             'type', con.contype, 'def', pg_get_constraintdef(con.oid))
             order by r.schema_name, r.table_name, con.conname)
    from rels r join pg_constraint con on con.conrelid = r.oid),
  'unique_indexes', (
    select jsonb_agg(jsonb_build_object(
             'table', r.schema_name || '.' || r.table_name,
             'def', pg_get_indexdef(ix.indexrelid))
             order by r.schema_name, r.table_name)
    from rels r join pg_index ix on ix.indrelid = r.oid
    where ix.indisunique and not ix.indisprimary),
  'triggers', (
    select jsonb_agg(jsonb_build_object(
             'table', r.schema_name || '.' || r.table_name, 'name', tg.tgname,
             'enabled', tg.tgenabled, 'def', pg_get_triggerdef(tg.oid))
             order by r.schema_name, r.table_name, tg.tgname)
    from rels r join pg_trigger tg on tg.tgrelid = r.oid
    where not tg.tgisinternal),
  'tables_missing', (
    select jsonb_agg(m.schema_name || '.' || m.table_name)
    from merge_tables m
    where not exists (select 1 from rels r
                      where r.schema_name = m.schema_name and r.table_name = m.table_name)),

  -- Every FK in ANY schema that points at auth.users, with its delete action
  -- (finds tables PostgREST cannot see and proves what "A is never deleted" protects).
  'fks_to_auth_users', (
    select jsonb_agg(jsonb_build_object(
             'table', con.conrelid::regclass::text, 'name', con.conname,
             'on_delete', con.confdeltype, 'def', pg_get_constraintdef(con.oid))
             order by con.conrelid::regclass::text)
    from pg_constraint con
    where con.contype = 'f' and con.confrelid = 'auth.users'::regclass),

  -- 5. Legacy memberships table: shape, plus rows mentioning A or B anywhere (dynamic, so an
  --    absent table cannot break the parse).
  'legacy_memberships', case when to_regclass('public.memberships') is null then '"absent"'::jsonb else
    jsonb_build_object(
      'columns', (select jsonb_agg(column_name || ' ' || data_type order by ordinal_position)
                  from information_schema.columns
                  where table_schema = 'public' and table_name = 'memberships'),
      'rows_mentioning_A', (xpath('/row/n/text()', query_to_xml(
          $q$select count(*) as n from public.memberships m
             where to_jsonb(m)::text like '%81f08aa1-44a2-40b1-9190-7866151461a7%'$q$, false, true, '')))[1]::text::int,
      'rows_mentioning_B', (xpath('/row/n/text()', query_to_xml(
          $q$select count(*) as n from public.memberships m
             where to_jsonb(m)::text like '%18b1ee80-2200-4bc6-91d7-039ba43f6a50%'$q$, false, true, '')))[1]::text::int) end,

  -- 8. Storage: objects whose ANY column (owner, owner_id, name, metadata) mentions A or B.
  'storage_objects', case when to_regclass('storage.objects') is null then '"absent"'::jsonb else
    jsonb_build_object(
      'columns', (select jsonb_agg(column_name order by ordinal_position)
                  from information_schema.columns
                  where table_schema = 'storage' and table_name = 'objects'),
      'objects_mentioning_A', (xpath('/row/n/text()', query_to_xml(
          $q$select count(*) as n from storage.objects o
             where to_jsonb(o)::text like '%81f08aa1-44a2-40b1-9190-7866151461a7%'$q$, false, true, '')))[1]::text::int,
      'objects_mentioning_B', (xpath('/row/n/text()', query_to_xml(
          $q$select count(*) as n from storage.objects o
             where to_jsonb(o)::text like '%18b1ee80-2200-4bc6-91d7-039ba43f6a50%'$q$, false, true, '')))[1]::text::int) end,

  -- Other auth tables that hold per-user rows (MFA, one-time tokens, flow state): counts for A.
  'other_auth_rows_for_A', (
    select jsonb_object_agg(con.conrelid::regclass::text,
      (xpath('/row/n/text()', query_to_xml(format(
         'select count(*) as n from %s t where to_jsonb(t)::text like %L',
         con.conrelid::regclass, '%81f08aa1-44a2-40b1-9190-7866151461a7%'), false, true, '')))[1]::text::int)
    from pg_constraint con
    where con.contype = 'f' and con.confrelid = 'auth.users'::regclass
      and con.connamespace = 'auth'::regnamespace)
));
