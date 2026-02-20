-- 최종 검증 SQL: 마이그레이션 후 스키마 상태 확인

-- 1) enum 타입 확인
select typname as enum_name, 
       array_agg(enumlabel order by enumsortorder) as enum_values
from pg_type t
join pg_enum e on t.oid = e.enumtypid
where typnamespace = (select oid from pg_namespace where nspname = 'public')
  and typtype = 'e'
  and typname in ('sso_level', 'job_function', 'membership_status')
group by typname
order by typname;

-- 2) workforce_profiles.sso_level 확인
select 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'workforce_profiles'
  and column_name = 'sso_level';

-- 3) office_assignments 테이블 구조 확인
select 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'office_assignments'
order by ordinal_position;

-- 4) office_assignments constraints 확인
select
  conname as constraint_name,
  contype as constraint_type,
  case contype
    when 'p' then 'PRIMARY KEY'
    when 'u' then 'UNIQUE'
    when 'f' then 'FOREIGN KEY'
    when 'c' then 'CHECK'
    else contype::text
  end as constraint_type_name,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.office_assignments'::regclass
order by contype, conname;

-- 5) office_assignments indexes 확인
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'office_assignments'
order by indexname;

-- 6) office_assignments triggers 확인
select
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public' 
  and event_object_table = 'office_assignments'
order by trigger_name;

-- 7) RLS 상태 확인 (현재는 적용하지 않지만 상태만 확인)
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('office_assignments', 'workforce_profiles', 'memberships', 'regions', 'offices')
order by tablename;

-- 8) FK 관계 확인
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints as tc
join information_schema.key_column_usage as kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage as ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name = 'office_assignments'
order by tc.table_name, kcu.column_name;
