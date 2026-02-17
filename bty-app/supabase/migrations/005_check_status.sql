-- 상태 검사 SQL: status 컬럼 및 관련 스키마 존재 여부 확인

-- 1) office_assignments 테이블 존재 여부
select exists (
  select from information_schema.tables
  where table_schema = 'public' and table_name = 'office_assignments'
) as office_assignments_exists;

-- 2) office_assignments.status 컬럼 존재 여부
select exists (
  select from information_schema.columns
  where table_schema = 'public'
    and table_name = 'office_assignments'
    and column_name = 'status'
) as office_assignments_status_exists;

-- 3) enum 타입 존재 여부
select typname as enum_name
from pg_type
where typnamespace = (select oid from pg_namespace where nspname = 'public')
  and typtype = 'e'
  and typname in ('sso_level', 'job_function', 'membership_status')
order by typname;

-- 4) workforce_profiles.sso_level 컬럼 존재 여부
select exists (
  select from information_schema.columns
  where table_schema = 'public'
    and table_name = 'workforce_profiles'
    and column_name = 'sso_level'
) as workforce_profiles_sso_level_exists;

-- 5) office_assignments의 모든 컬럼 목록
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'office_assignments'
order by ordinal_position;

-- 6) office_assignments의 constraints (unique, FK 등)
select
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conrelid = 'public.office_assignments'::regclass
order by contype, conname;

-- 7) office_assignments의 indexes
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'office_assignments';

-- 8) office_assignments의 triggers
select
  trigger_name,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public' and event_object_table = 'office_assignments';
