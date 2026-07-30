#!/usr/bin/env bash
# Part 4 — EXECUTABLE negative index-guard matrix. For each case we pre-create a same-named object
# with a WRONG definition, run the REAL one-shell migration, and assert it FAILS CLOSED (psql exits
# non-zero) without replacing the wrong object — real PL/pgSQL execution, not a TS model.
# Requires PG* env pointing at a disposable database. PSQL var may override the psql command.
set -u
PSQL="${PSQL:-psql}"
MIG="supabase/migrations/20260803000000_foundry_arena_draft_one_shell_v1.sql"
IDX="foundry_arena_scenario_drafts_one_shell_idx"
CANON="((guided_answers ->> 'practiceSetupVersion') is not null)"
fails=0

reset() {
  $PSQL -q -v ON_ERROR_STOP=1 <<SQL
drop schema if exists other cascade;
-- Drop ANY relation named like the index (a prior case may have left it as a table/view/index).
do \$\$
declare v_kind text;
begin
  select case c.relkind when 'r' then 'table' when 'i' then 'index' when 'v' then 'view'
                        when 'm' then 'materialized view' else 'table' end
  into v_kind from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relname='$IDX' and n.nspname='public';
  if found then execute 'drop '||v_kind||' if exists public.$IDX cascade'; end if;
end \$\$;
drop table if exists public.foundry_arena_scenario_drafts cascade;
drop table if exists public.wrong_tbl cascade;
create table public.foundry_arena_scenario_drafts (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null, source_event_id uuid not null,
  guided_answers jsonb not null default '{}'::jsonb, scenario_draft jsonb, status text not null default 'draft',
  revision int not null default 0);
SQL
}

# run_case N "description" "setup-sql" "expect fail|pass"
run_case() {
  local n="$1" desc="$2" setup="$3" expect="$4"
  reset
  if ! $PSQL -q -v ON_ERROR_STOP=1 -c "$setup" >/dev/null 2>&1; then
    echo "CASE $n ($desc): SETUP FAILED"; fails=$((fails+1)); return; fi
  # capture the state of the pre-created object (definition) if it is an index
  local before; before=$($PSQL -tAq -c "select coalesce(pg_get_indexdef('public.$IDX'::regclass),'') where exists (select 1 from pg_class c join pg_namespace nz on nz.oid=c.relnamespace where c.relname='$IDX' and nz.nspname='public')" 2>/dev/null)
  $PSQL -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1; local rc=$?
  # count relations named $IDX in public (must never become 2)
  local cnt; cnt=$($PSQL -tAq -c "select count(*) from pg_class c join pg_namespace nz on nz.oid=c.relnamespace where c.relname='$IDX' and nz.nspname='public'" 2>/dev/null)
  local after; after=$($PSQL -tAq -c "select coalesce(pg_get_indexdef('public.$IDX'::regclass),'') where exists (select 1 from pg_class c join pg_namespace nz on nz.oid=c.relnamespace where c.relname='$IDX' and nz.nspname='public')" 2>/dev/null)
  local ok=1
  if [ "$expect" = "fail" ]; then
    [ "$rc" -ne 0 ] || { ok=0; echo "CASE $n ($desc): expected FAIL-CLOSED but migration succeeded"; }
    [ "$before" = "$after" ] || { ok=0; echo "CASE $n ($desc): pre-existing object was MODIFIED"; }
    [ "${cnt:-0}" -le 1 ] || { ok=0; echo "CASE $n ($desc): a SECOND same-named relation appeared (cnt=$cnt)"; }
  else # pass (schema-scoped: public index correctly created)
    [ "$rc" -eq 0 ] || { ok=0; echo "CASE $n ($desc): expected SUCCESS but migration failed"; }
    local good; good=$($PSQL -tAq -c "select case when indisunique and pg_get_expr(indpred,indrelid) is not null then 1 else 0 end from pg_index where indexrelid='public.$IDX'::regclass" 2>/dev/null)
    [ "${good:-0}" = "1" ] || { ok=0; echo "CASE $n ($desc): public index missing/incorrect after run"; }
  fi
  if [ "$ok" = "1" ]; then echo "CASE $n ($desc): PASS ($([ "$expect" = fail ] && echo fail-closed || echo created))"; else fails=$((fails+1)); fi
}

run_case 1  "predicate OR true"        "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) where $CANON or true;" fail
run_case 2  "predicate AND filter"     "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) where $CANON and (owner_user_id is not null);" fail
run_case 3  "version = '1'"            "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) where ((guided_answers ->> 'practiceSetupVersion') = '1');" fail
run_case 4  "wrong JSON key"           "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) where ((guided_answers ->> 'setupVersion') is not null);" fail
run_case 5  "wrong JSON column"        "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) where ((scenario_draft ->> 'practiceSetupVersion') is not null);" fail
run_case 6  "IS NULL not IS NOT NULL"  "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) where ((guided_answers ->> 'practiceSetupVersion') is null);" fail
run_case 7  "non-partial"              "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id);" fail
run_case 8  "non-unique"              "create index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) where $CANON;" fail
run_case 9  "reversed key order"       "create unique index $IDX on public.foundry_arena_scenario_drafts (source_event_id, owner_user_id) where $CANON;" fail
run_case 10 "extra key column"         "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id, revision) where $CANON;" fail
run_case 11 "INCLUDE column"           "create unique index $IDX on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id) include (revision) where $CANON;" fail
run_case 12 "wrong table"              "create table public.wrong_tbl (owner_user_id uuid, source_event_id uuid, guided_answers jsonb); create unique index $IDX on public.wrong_tbl (owner_user_id, source_event_id) where $CANON;" fail
run_case 13 "same-named table"         "create table public.$IDX (x int);" fail
run_case 15 "expression key"           "create unique index $IDX on public.foundry_arena_scenario_drafts ((lower(owner_user_id::text)), source_event_id) where $CANON;" fail
# Case 14 — same NAME in ANOTHER schema: fully-qualified create + public-scoped guard means NO
# ambiguity; the public index is correctly created. This proves schema-scoping (not a failure).
run_case 14 "same name other schema"   "create schema other; create table other.d (owner_user_id uuid, source_event_id uuid, guided_answers jsonb); create unique index $IDX on other.d (owner_user_id, source_event_id) where $CANON;" pass

echo "----"
if [ "$fails" -eq 0 ]; then echo "PART4_NEGATIVE_MATRIX: PASS (15/15)"; else echo "PART4_NEGATIVE_MATRIX: FAIL ($fails)"; exit 1; fi
