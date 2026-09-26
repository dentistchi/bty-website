-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BTY FOUNDER MERGE — T1: AUTH IDENTITY CONSOLIDATION (A → B)
-- REVIEW ONLY. Run as ONE script in the Supabase SQL editor (role: postgres).
--
--   A (secondary, becomes a banned shell) 81f08aa1-44a2-40b1-9190-7866151461a7
--   B (canonical Founder)                 18b1ee80-2200-4bc6-91d7-039ba43f6a50
--
-- What changes:  auth.identities.user_id of A's two identities → B
--                A's auth.sessions (refresh tokens cascade), A's auth.flow_state,
--                A's bty_microsoft_authority_snapshots row
-- What never changes: identity id / provider / provider_id / identity_data, any B auth row,
--                A's auth.users row (not deleted, not banned here — Admin API does that).
--
-- Fail-closed: every precondition is asserted; any mismatch RAISEs, the DO block aborts,
-- and the final COMMIT becomes a ROLLBACK. Nothing is partially applied.
--
-- Also creates the private ledger bty_ops.founder_merge_ledger (not exposed to the API).
-- MINIMAL BY CONSTRUCTION: it holds keys, ownership values and a handful of scalar columns —
-- never message bodies, previews, metadata, training content or auth/token material. A CHECK
-- whitelists the only keys pre_image may ever contain. Retention: see LEDGER_CLEANUP.sql.
-- ===========================================================================

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- Private ledger. `bty_ops` is not in PostgREST's exposed schemas (public,
-- graphql_public), and every API role is explicitly revoked.
-- ---------------------------------------------------------------------------
create schema if not exists bty_ops;
revoke all on schema bty_ops from public, anon, authenticated, service_role;

create table if not exists bty_ops.founder_merge_ledger (
  id           bigserial primary key,
  phase        text not null check (phase in ('T1', 'T2')),
  step         text not null,
  table_name   text not null,
  action       text not null check (action in ('marker', 'reassign', 'update', 'delete')),
  -- Primary-key values of the touched row, as they were BEFORE the change.
  row_key      jsonb,
  column_name  text,
  old_value    text,
  new_value    text,
  -- Only the scalar columns a rollback must restore (user_day, membership status, host grant
  -- flags). NULL for every ownership-only move. Content can never enter: the key whitelist below
  -- rejects any other field.
  pre_image    jsonb,
  recorded_at  timestamptz not null default now(),
  constraint founder_merge_ledger_minimal_pre_image check (
    pre_image is null
    or (pre_image - array['id', 'user_id', 'day_key', 'timezone_snapshot', 'tz_fallback', 'opened_at',
                          'status', 'updated_at', 'revoked_at', 'manual_granted',
                          'microsoft_manager_granted']) = '{}'::jsonb
  ),
  constraint founder_merge_ledger_ownership_moves_have_no_pre_image check (
    step not in ('rehome', 'identity_move', 'user_day_move') or pre_image is null
  )
);
revoke all on bty_ops.founder_merge_ledger from public, anon, authenticated, service_role;
revoke all on sequence bty_ops.founder_merge_ledger_id_seq from public, anon, authenticated, service_role;

do $t1$
declare
  v_a        constant uuid := '81f08aa1-44a2-40b1-9190-7866151461a7';
  v_b        constant uuid := '18b1ee80-2200-4bc6-91d7-039ba43f6a50';
  v_tid      constant text := '10110d5c-bd30-467e-9912-e44e67777647';
  v_oid_a    constant text := '644ff2ac-9135-4bcc-9669-c382986e4b60';
  v_oid_b    constant text := 'f5767307-f693-4f8c-8e6c-5fb8a256b895';
  v_id_az_a  constant uuid := '71defecd-955c-445d-affe-6af4e86bd43a';
  v_id_go_a  constant uuid := '336defc0-f3bd-4b4b-86c9-72036be4f7a3';
  v_id_az_b  constant uuid := '0f456b7d-acd0-4bdd-a06b-36300f19eeb2';
  v_google_sub constant text := '116414797725395870095';

  v_n            int;
  v_b_sessions_0 int;
  v_b_rt_0       int;
  v_status       text;
  v_user         uuid;
begin
  if exists (select 1 from bty_ops.founder_merge_ledger where phase = 'T1' and step not like 'rolled_back/%') then
    raise exception 'T1 ABORT: ledger already holds T1 rows — T1 has run before';
  end if;

  -- 1. Both users exist and are live.
  perform 1 from auth.users where id = v_a and deleted_at is null;
  if not found then raise exception 'T1 ABORT: user A missing or soft-deleted'; end if;
  perform 1 from auth.users where id = v_b and deleted_at is null;
  if not found then raise exception 'T1 ABORT: user B missing or soft-deleted'; end if;

  -- Lock every identity of both users for the rest of the transaction. A concurrent GoTrue
  -- sign-in updates its identity row, so it waits here and, after COMMIT, lands on B.
  perform 1 from auth.identities where user_id in (v_a, v_b) for update;

  -- 2. A holds exactly these two identities.
  select count(*) into v_n from auth.identities where user_id = v_a;
  if v_n <> 2 then raise exception 'T1 ABORT: A has % identities, expected 2', v_n; end if;

  perform 1 from auth.identities
   where id = v_id_az_a and user_id = v_a and provider = 'azure'
     and lower(identity_data->'custom_claims'->>'tid') = v_tid
     and lower(identity_data->'custom_claims'->>'oid') = v_oid_a;
  if not found then raise exception 'T1 ABORT: A azure identity % does not match audit', v_id_az_a; end if;

  perform 1 from auth.identities
   where id = v_id_go_a and user_id = v_a and provider = 'google' and provider_id = v_google_sub;
  if not found then raise exception 'T1 ABORT: A google identity % does not match audit', v_id_go_a; end if;

  -- 3. B holds exactly its one azure identity.
  select count(*) into v_n from auth.identities where user_id = v_b;
  if v_n <> 1 then raise exception 'T1 ABORT: B has % identities, expected 1', v_n; end if;

  perform 1 from auth.identities
   where id = v_id_az_b and user_id = v_b and provider = 'azure'
     and lower(identity_data->'custom_claims'->>'tid') = v_tid
     and lower(identity_data->'custom_claims'->>'oid') = v_oid_b;
  if not found then raise exception 'T1 ABORT: B azure identity % does not match audit', v_id_az_b; end if;

  -- 4. No conflicting rows: each oid is held by exactly one azure identity in this tenant, and
  --    no other google identity carries the same subject (the unique key already implies it).
  select count(*) into v_n from auth.identities
   where provider = 'azure'
     and lower(identity_data->'custom_claims'->>'tid') = v_tid
     and lower(identity_data->'custom_claims'->>'oid') = v_oid_a;
  if v_n <> 1 then raise exception 'T1 ABORT: % azure identities carry oid A, expected 1', v_n; end if;

  select count(*) into v_n from auth.identities
   where provider = 'azure'
     and lower(identity_data->'custom_claims'->>'tid') = v_tid
     and lower(identity_data->'custom_claims'->>'oid') = v_oid_b;
  if v_n <> 1 then raise exception 'T1 ABORT: % azure identities carry oid B, expected 1', v_n; end if;

  select count(*) into v_n from auth.identities where provider = 'google' and provider_id = v_google_sub;
  if v_n <> 1 then raise exception 'T1 ABORT: % google identities carry the ddshanbit subject', v_n; end if;

  -- B's snapshot must be the canonical one before and after.
  perform 1 from public.bty_microsoft_authority_snapshots
   where user_id = v_b and lower(aad_object_id) = v_oid_b;
  if not found then raise exception 'T1 ABORT: B authority snapshot missing or not oid B'; end if;

  select count(*) into v_b_sessions_0 from auth.sessions where user_id = v_b;
  select count(*) into v_b_rt_0 from auth.refresh_tokens where user_id::text = v_b::text;

  -- 5. Move A's two identities to B. ONLY user_id changes.
  -- Ledger: identity id + old/new owner only. No provider_id, no identity_data.
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, row_key, column_name, old_value, new_value)
  select 'T1', 'identity_move', 'auth.identities', 'reassign', jsonb_build_object('id', i.id),
         'user_id', i.user_id::text, v_b::text
    from auth.identities i
   where i.id in (v_id_az_a, v_id_go_a);

  update auth.identities
     set user_id = v_b
   where id in (v_id_az_a, v_id_go_a) and user_id = v_a;
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'T1 ABORT: moved % identities, expected 2', v_n; end if;

  -- 6. Revoke every A session. Refresh tokens cascade via refresh_tokens.session_id.
  --    Intentionally non-restorable: the ledger records only the COUNT, no session ids or
  --    token material.
  delete from auth.sessions where user_id = v_a;
  get diagnostics v_n = row_count;
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, new_value)
  values ('T1', 'session_revoke', 'auth.sessions', 'marker', v_n::text);
  raise notice 'T1: deleted % A sessions', v_n;

  -- 7. Refresh tokens: after the cascade A must have none. A leftover with a NULL session_id is
  --    an orphan and is removed; a leftover still pointing at a live session is impossible for
  --    a correct cascade and aborts the whole transaction.
  select count(*) into v_n from auth.refresh_tokens where user_id::text = v_a::text and session_id is not null;
  if v_n <> 0 then raise exception 'T1 ABORT: % A refresh tokens still reference a session', v_n; end if;

  delete from auth.refresh_tokens where user_id::text = v_a::text and session_id is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then raise notice 'T1: removed % orphaned A refresh tokens (null session_id)', v_n; end if;

  -- 8. Transient PKCE flow state.
  delete from auth.flow_state where user_id::text = v_a::text;
  get diagnostics v_n = row_count;
  if v_n > 5 then raise exception 'T1 ABORT: % A flow_state rows, expected about 1', v_n; end if;
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, new_value)
  values ('T1', 'flow_state_delete', 'auth.flow_state', 'marker', v_n::text);
  raise notice 'T1: deleted % A flow_state rows', v_n;

  -- 9. A's Microsoft authority snapshot (PK user_id, UNIQUE (tenant_id, aad_object_id)). Left in
  --    place it would block every future snapshot write for oid A under B. It is derived and is
  --    deliberately NOT restored on rollback, so the ledger keeps only an audit key.
  delete from public.bty_microsoft_authority_snapshots where user_id = v_a;
  get diagnostics v_n = row_count;
  if v_n > 1 then raise exception 'T1 ABORT: deleted % A snapshots, expected at most 1', v_n; end if;
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, row_key, new_value)
  values ('T1', 'snapshot_delete', 'public.bty_microsoft_authority_snapshots', 'marker',
          jsonb_build_object('user_id', v_a), v_n::text);

  -- 10. In-transaction postconditions.
  select count(*) into v_n from auth.identities where user_id = v_a;
  if v_n <> 0 then raise exception 'T1 ABORT: A still has % identities', v_n; end if;
  select count(*) into v_n from auth.identities where user_id = v_b;
  if v_n <> 3 then raise exception 'T1 ABORT: B has % identities, expected 3', v_n; end if;
  select count(*) into v_n from auth.sessions where user_id = v_a;
  if v_n <> 0 then raise exception 'T1 ABORT: A still has % sessions', v_n; end if;
  select count(*) into v_n from auth.refresh_tokens where user_id::text = v_a::text;
  if v_n <> 0 then raise exception 'T1 ABORT: A still has % refresh tokens', v_n; end if;

  select count(*) into v_n from auth.sessions where user_id = v_b;
  if v_n < v_b_sessions_0 then raise exception 'T1 ABORT: B sessions dropped from % to %', v_b_sessions_0, v_n; end if;
  select count(*) into v_n from auth.refresh_tokens where user_id::text = v_b::text;
  if v_n < v_b_rt_0 then raise exception 'T1 ABORT: B refresh tokens dropped from % to %', v_b_rt_0, v_n; end if;

  perform 1 from public.bty_microsoft_authority_snapshots
   where user_id = v_b and lower(aad_object_id) = v_oid_b;
  if not found then raise exception 'T1 ABORT: B snapshot changed'; end if;

  -- The production resolver itself must now answer B for both oids.
  select r.status, r.user_id into v_status, v_user
    from public.bty_resolve_user_from_microsoft_identity(v_tid, v_oid_a) r;
  if v_status <> 'RESOLVED' or v_user <> v_b then
    raise exception 'T1 ABORT: resolver(oid A) = % / %', v_status, v_user;
  end if;
  select r.status, r.user_id into v_status, v_user
    from public.bty_resolve_user_from_microsoft_identity(v_tid, v_oid_b) r;
  if v_status <> 'RESOLVED' or v_user <> v_b then
    raise exception 'T1 ABORT: resolver(oid B) = % / %', v_status, v_user;
  end if;

  -- Marker: the TTL gate in T2 measures from this timestamp.
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, new_value)
  values ('T1', 'committed_marker', '-', 'marker', now()::text);

  raise notice 'T1 OK — identities moved, A sessions revoked, snapshot removed';
end
$t1$;

commit;
