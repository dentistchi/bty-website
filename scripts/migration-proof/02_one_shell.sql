-- Part 3 — EXECUTABLE proof of 20260803000000_foundry_arena_draft_one_shell_v1.sql on disposable
-- PostgreSQL. Applies the REAL migration, verifies the index via pg_catalog, and re-applies.
\set ON_ERROR_STOP on
\set MIG 'supabase/migrations/20260803000000_foundry_arena_draft_one_shell_v1.sql'

drop table if exists public.foundry_arena_scenario_drafts cascade;
create table public.foundry_arena_scenario_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  source_event_id uuid not null,
  guided_answers jsonb not null default '{}'::jsonb,
  scenario_draft jsonb,
  status text not null default 'draft',
  revision int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

\i :MIG

-- Verify the created index EXACTLY via pg_catalog.
do $$
declare
  v_oid oid; v_indrelid oid; v_unique boolean; v_relkind text;
  v_nkeys int; v_natts int; v_cols text; v_pred text; v_norm text;
begin
  select c.oid, c.relkind::text, i.indrelid, i.indisunique, i.indnkeyatts, i.indnatts
    into v_oid, v_relkind, v_indrelid, v_unique, v_nkeys, v_natts
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  join pg_index i on i.indexrelid=c.oid
  where c.relname='foundry_arena_scenario_drafts_one_shell_idx' and n.nspname='public';
  if not found then raise exception 'index not created'; end if;
  if v_relkind <> 'i' then raise exception 'relation is not an index'; end if;
  if v_indrelid <> 'public.foundry_arena_scenario_drafts'::regclass then raise exception 'wrong target table'; end if;
  if not v_unique then raise exception 'index is not UNIQUE'; end if;
  if v_nkeys <> 2 or v_natts <> 2 then raise exception 'key/att count wrong (nkeys=% natts=%) — INCLUDE or extra key present', v_nkeys, v_natts; end if;
  select string_agg(a.attname, ',' order by k.ord) into v_cols
  from pg_index i cross join lateral unnest(i.indkey) with ordinality as k(attnum,ord)
  join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
  where i.indexrelid=v_oid;
  if v_cols <> 'owner_user_id,source_event_id' then raise exception 'wrong key order: %', v_cols; end if;
  select pg_get_expr(i.indpred, i.indrelid) into v_pred from pg_index i where i.indexrelid=v_oid;
  if v_pred is null then raise exception 'index is not partial'; end if;
  v_norm := translate(replace(regexp_replace(v_pred,'\s+','','g'),'::text',''),'()','');
  if v_norm <> 'guided_answers->>''practiceSetupVersion''ISNOTNULL' then
    raise exception 'predicate not exact: % (norm=%)', v_pred, v_norm;
  end if;
  raise notice 'one-shell index verified: unique, keys=owner_user_id,source_event_id, predicate exact';
end $$;

-- Re-apply: the guard must accept the correct existing index and succeed.
\i :MIG

\echo 'PART3_ONE_SHELL: PASS'
