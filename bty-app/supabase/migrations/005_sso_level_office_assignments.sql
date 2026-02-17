-- 권한 모델 B 확장: SSO level, office_assignments
-- RLS는 나중에 적용 (개발 단계에서는 API 레벨 권한체크만)
-- Idempotent: 여러 번 실행해도 안전

-- 1) enum sso_level 생성
do $$ begin
  create type public.sso_level as enum ('staff', 'manager');
exception
  when duplicate_object then null;
end $$;

-- 2) workforce_profiles에 sso_level 추가
alter table public.workforce_profiles
  add column if not exists sso_level public.sso_level;

-- team='sso'이고 sso_level이 null이면 'staff'로 기본값 설정
update public.workforce_profiles
set sso_level = 'staff'::public.sso_level
where team = 'sso' and sso_level is null;

-- 3) job_function enum (office_assignments에서 사용)
do $$ begin
  create type public.job_function as enum ('other', 'dentist', 'hygienist', 'assistant', 'receptionist', 'manager');
exception
  when duplicate_object then null;
end $$;

-- 4) membership_status enum (office_assignments에서 사용)
do $$ begin
  create type public.membership_status as enum ('active', 'invited', 'disabled');
exception
  when duplicate_object then null;
end $$;

-- 5) office_assignments 테이블 생성 (없으면)
create table if not exists public.office_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6) office_assignments에 missing 컬럼 추가 (이미 테이블이 있으면)
alter table public.office_assignments
  add column if not exists job_function public.job_function not null default 'other',
  add column if not exists is_lead boolean not null default false,
  add column if not exists status public.membership_status not null default 'active',
  add column if not exists is_primary boolean not null default false;

-- 7) unique constraint (없으면 추가)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.office_assignments'::regclass
      and conname = 'office_assignments_user_office_unique'
  ) then
    alter table public.office_assignments
      add constraint office_assignments_user_office_unique unique (user_id, office_id);
  end if;
end $$;

-- 8) indexes (없으면 생성)
create index if not exists office_assignments_user_id on public.office_assignments (user_id);
create index if not exists office_assignments_office_id on public.office_assignments (office_id);
create index if not exists office_assignments_status on public.office_assignments (status);

-- 9) updated_at 트리거 함수 (없으면 생성)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 10) office_assignments에 updated_at 트리거 연결
drop trigger if exists set_updated_at_office_assignments on public.office_assignments;
create trigger set_updated_at_office_assignments
  before update on public.office_assignments
  for each row
  execute function public.set_updated_at();
