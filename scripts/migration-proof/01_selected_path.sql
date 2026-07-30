-- Part 2 — EXECUTABLE proof of 20260802000000_foundry_practice_run_selected_path_v1.sql
-- against a disposable PostgreSQL. Run with:  psql -v ON_ERROR_STOP=1 -f 01_selected_path.sql
-- (CWD = bty-app). Prereq schema is the MINIMAL accurate contract; the real migration file is
-- applied via \i (never a copy). Any assertion failure RAISES and psql exits non-zero.
\set ON_ERROR_STOP on
\set MIG 'supabase/migrations/20260802000000_foundry_practice_run_selected_path_v1.sql'

drop table if exists public.foundry_arena_practice_runs cascade;
drop table if exists public.other_runs cascade;
create table public.foundry_arena_practice_runs (
  id uuid primary key default gen_random_uuid()
);

-- Apply the REAL migration.
\i :MIG

-- 1) column exists · jsonb · nullable · no default
do $$
declare r record;
begin
  select data_type, is_nullable, column_default into r
  from information_schema.columns
  where table_schema='public' and table_name='foundry_arena_practice_runs' and column_name='selected_path';
  if not found then raise exception 'selected_path column absent'; end if;
  if r.data_type <> 'jsonb' then raise exception 'selected_path type=% (expected jsonb)', r.data_type; end if;
  if r.is_nullable <> 'YES' then raise exception 'selected_path not nullable'; end if;
  if r.column_default is not null then raise exception 'selected_path has a default (%)', r.column_default; end if;
end $$;

-- 2) named check constraint on the EXACT table
do $$
begin
  if not exists (select 1 from pg_constraint
    where conname='foundry_practice_run_selected_path_object_check'
      and conrelid='public.foundry_arena_practice_runs'::regclass) then
    raise exception 'object-check constraint not on the target table';
  end if;
end $$;

-- 3) NULL accepted · object accepted
insert into public.foundry_arena_practice_runs(selected_path) values (null);
insert into public.foundry_arena_practice_runs(selected_path) values ('{"v":1,"primaryChoiceId":"primary_1"}'::jsonb);

-- 4) array rejected · scalar rejected (expect check_violation)
do $$
begin
  begin insert into public.foundry_arena_practice_runs(selected_path) values ('[]'::jsonb);
    raise exception 'ASSERT: array should be rejected';
  exception when check_violation then null; end;
  begin insert into public.foundry_arena_practice_runs(selected_path) values ('5'::jsonb);
    raise exception 'ASSERT: scalar should be rejected';
  exception when check_violation then null; end;
end $$;

-- 5) re-execution succeeds (idempotent)
\i :MIG

-- 6) partial-state recovery: column present but constraint dropped → re-run re-adds it
alter table public.foundry_arena_practice_runs drop constraint foundry_practice_run_selected_path_object_check;
\i :MIG
do $$
begin
  if not exists (select 1 from pg_constraint
    where conname='foundry_practice_run_selected_path_object_check'
      and conrelid='public.foundry_arena_practice_runs'::regclass) then
    raise exception 'constraint not restored after partial-state recovery';
  end if;
end $$;

-- 7) a same-named constraint on ANOTHER table must not suppress creation on the target
alter table public.foundry_arena_practice_runs drop constraint foundry_practice_run_selected_path_object_check;
create table public.other_runs (id int, selected_path jsonb);
alter table public.other_runs
  add constraint foundry_practice_run_selected_path_object_check
  check (selected_path is null or jsonb_typeof(selected_path)='object');
\i :MIG
do $$
begin
  if not exists (select 1 from pg_constraint
    where conname='foundry_practice_run_selected_path_object_check'
      and conrelid='public.foundry_arena_practice_runs'::regclass) then
    raise exception 'conrelid-scoped guard failed: target constraint not re-added';
  end if;
end $$;

-- 8) no unexpected side effects: no index / no default / RLS still disabled
do $$
begin
  if exists (select 1 from pg_indexes where schemaname='public'
      and tablename='foundry_arena_practice_runs' and indexname <> 'foundry_arena_practice_runs_pkey') then
    raise exception 'unexpected index created on target table';
  end if;
  if (select relrowsecurity from pg_class where oid='public.foundry_arena_practice_runs'::regclass) then
    raise exception 'RLS was enabled by the migration (unexpected)';
  end if;
end $$;

\echo 'PART2_SELECTED_PATH: PASS'
