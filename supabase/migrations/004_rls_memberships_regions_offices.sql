-- RLS: 권한 모델 B (조직 + region 스코프)
-- memberships: 본인 row만 select
-- regions / offices: 본인 memberships.region_id 범위에서만 select
-- Admin API는 service_role로 접근하므로 RLS 우회; requireAdmin이 게이트 역할.

-- memberships (테이블 없으면 생성). org_id/region_id/status로 requireAdmin 게이트.
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null,
  region_id uuid not null,
  role text not null check (role in ('staff', 'doctor', 'office_manager', 'regional_manager')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create index if not exists memberships_user_id on memberships (user_id);
create index if not exists memberships_region_id on memberships (region_id);

alter table memberships enable row level security;

drop policy if exists "memberships_select_own" on memberships;
create policy "memberships_select_own"
  on memberships for select
  using (auth.uid() = user_id);

-- regions (테이블 없으면 생성)
create table if not exists regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table regions enable row level security;

drop policy if exists "regions_select_via_memberships" on regions;
create policy "regions_select_via_memberships"
  on regions for select
  using (
    id in (
      select region_id from memberships where user_id = auth.uid()
    )
  );

-- offices (테이블 없으면 생성, office는 추후 확장)
create table if not exists offices (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists offices_region_id on offices (region_id);

alter table offices enable row level security;

drop policy if exists "offices_select_via_memberships" on offices;
create policy "offices_select_via_memberships"
  on offices for select
  using (
    region_id in (
      select region_id from memberships where user_id = auth.uid()
    )
  );
