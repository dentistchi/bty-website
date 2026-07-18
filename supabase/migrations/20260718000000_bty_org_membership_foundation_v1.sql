-- ============================================================================
-- Slice 3.1A-1 — Canonical Organization Membership Foundation (Phase 1)
-- ============================================================================
-- Establishes the MINIMUM truthful canonical identity core:
--   bty_enterprises → bty_organizations → bty_org_memberships
-- and backfills every DISTINCT approved Arena member into a transitional
-- bootstrap organization (BTY_LEGACY under enterprise BTY_DSO) with UNKNOWN
-- professional identity (job_family/role/dates left NULL — never guessed from
-- the legacy leader/staff free text).
--
-- NAMING: the plain `organizations` name is already occupied by a live,
-- out-of-band {id,name,slug} admin table (2 rows, read by GET /api/admin/
-- organizations). These canonical tables are therefore namespaced `bty_*` and
-- do NOT touch that legacy table.
--
-- NON-GOALS (deliberately NOT done here):
--   * does NOT touch the legacy `memberships` table or its 9 readers
--   * does NOT change the Arena access gate (still arena_membership_requests
--     .status = 'approved'); no dual-read, no cutover
--   * no office/region/authority/specialty/function dimensions (deferred)
--   * no Practice audience filtering
--
-- SAFETY: additive + idempotent. Client-deny RLS; service-role writes only.
-- Rollback = drop the three bty_* tables (nothing else references them; the
-- access gate is untouched so no access is restored by rollback).
--
-- MEASUREMENT-DRIVEN ADJUSTMENT: source_membership_request_id is BIGINT (the
-- request PK `id` is bigserial, not uuid).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enterprises (the DSO umbrella)
-- ---------------------------------------------------------------------------
create table if not exists public.bty_enterprises (
  id uuid primary key default gen_random_uuid(),
  enterprise_key text not null unique,
  display_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bty_enterprises_status_check check (status in ('active', 'inactive'))
);

-- ---------------------------------------------------------------------------
-- 2. Organizations (legal/operational units under an enterprise)
-- ---------------------------------------------------------------------------
create table if not exists public.bty_organizations (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.bty_enterprises (id) on delete restrict,
  organization_key text not null,
  display_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bty_organizations_status_check check (status in ('active', 'inactive')),
  constraint bty_organizations_ent_key_unique unique (enterprise_id, organization_key)
);
create index if not exists bty_organizations_enterprise_idx
  on public.bty_organizations (enterprise_id);

-- ---------------------------------------------------------------------------
-- 3. Canonical organization membership
--    job_family_key / primary_role_key are NULLABLE — NULL means unknown.
--    There is deliberately no UNKNOWN key value. Office/region/authority/
--    specialty/function are NOT columns here (deferred to normalized junctions).
-- ---------------------------------------------------------------------------
create table if not exists public.bty_org_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.bty_organizations (id) on delete restrict,
  status text not null default 'active',
  is_primary boolean not null default false,
  joined_at timestamptz null,
  job_family_key text null,
  primary_role_key text null,
  role_started_at timestamptz null,
  identity_source text not null,
  source_membership_request_id bigint null
    references public.arena_membership_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bty_org_membership_status_check
    check (status in ('active', 'inactive')),
  constraint bty_org_membership_identity_source_check
    check (identity_source in ('legacy_approved_request', 'membership_approval', 'admin_curated')),
  -- Stable-key taxonomy (CHECK-constrained text, mirrored by the app taxonomy
  -- module). NULL = unknown. Adding a harmless key later is a CHECK edit, not an
  -- enum migration.
  constraint bty_org_membership_job_family_check
    check (
      job_family_key is null or job_family_key in (
        'CLINICAL_PROVIDER', 'CLINICAL_SUPPORT', 'FRONT_OFFICE_ADMIN',
        'OFFICE_MANAGEMENT', 'REGIONAL_OPERATIONS', 'ENTERPRISE_OPERATIONS',
        'SHARED_SERVICES'
      )
    ),
  constraint bty_org_membership_primary_role_check
    check (
      primary_role_key is null or primary_role_key in (
        'GENERAL_DENTIST', 'ORTHODONTIST', 'DENTAL_ASSISTANT', 'OFFICE_ADMIN',
        'OFFICE_MANAGER', 'AREA_MANAGER', 'STATE_REGIONAL_DIRECTOR',
        'DSO_OPERATIONS_MEMBER', 'SSO_SUPPORT_SPECIALIST', 'SSO_IT', 'SSO_HR'
      )
    ),
  -- One membership row per (user, organization).
  constraint bty_org_membership_user_org_unique unique (user_id, organization_id)
);
create index if not exists bty_org_membership_user_idx
  on public.bty_org_memberships (user_id);
create index if not exists bty_org_membership_org_idx
  on public.bty_org_memberships (organization_id);
-- At most ONE active primary membership per user.
create unique index if not exists bty_org_membership_one_active_primary
  on public.bty_org_memberships (user_id)
  where (status = 'active' and is_primary = true);

-- ---------------------------------------------------------------------------
-- 4. Security — client-deny; service-role writes only (no client policy).
-- ---------------------------------------------------------------------------
revoke all on public.bty_enterprises from anon, public, authenticated;
revoke all on public.bty_organizations from anon, public, authenticated;
revoke all on public.bty_org_memberships from anon, public, authenticated;
alter table public.bty_enterprises enable row level security;
alter table public.bty_organizations enable row level security;
alter table public.bty_org_memberships enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Seed the bootstrap enterprise + organization (idempotent).
-- ---------------------------------------------------------------------------
insert into public.bty_enterprises (enterprise_key, display_name, status)
  values ('BTY_DSO', 'BTY DSO', 'active')
  on conflict (enterprise_key) do nothing;

insert into public.bty_organizations (enterprise_id, organization_key, display_name, status)
  select e.id, 'BTY_LEGACY', 'BTY Legacy Organization', 'active'
  from public.bty_enterprises e
  where e.enterprise_key = 'BTY_DSO'
  on conflict (enterprise_id, organization_key) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Backfill — every DISTINCT approved Arena member → one active primary
--    BTY_LEGACY membership. Professional identity UNKNOWN. Idempotent.
--
--    Guards:
--      * DISTINCT ON (user_id): at most one row per user even though
--        arena_membership_requests already has unique(user_id) (defensive).
--      * ON CONFLICT (user_id, organization_id) DO NOTHING: re-run is a no-op;
--        a pre-existing (curated) BTY_LEGACY row is preserved, never overwritten.
--      * NOT EXISTS (... active primary ...): never create a second active
--        primary for a user who already has one (e.g. an admin-curated
--        membership in another org), which also protects the one-active-primary
--        index. Such users are left for manual curation.
--      * joined_at from the request (cast date→timestamptz), else NULL — never
--        invented.
-- ---------------------------------------------------------------------------
insert into public.bty_org_memberships (
  user_id, organization_id, status, is_primary, joined_at,
  identity_source, source_membership_request_id
)
select distinct on (r.user_id)
  r.user_id,
  o.id,
  'active',
  true,
  r.joined_at::timestamptz,
  'legacy_approved_request',
  r.id
from public.arena_membership_requests r
join public.bty_organizations o on o.organization_key = 'BTY_LEGACY'
join public.bty_enterprises e on e.id = o.enterprise_id and e.enterprise_key = 'BTY_DSO'
where r.status = 'approved'
  and not exists (
    select 1 from public.bty_org_memberships m
    where m.user_id = r.user_id and m.status = 'active' and m.is_primary = true
  )
order by r.user_id, r.joined_at asc nulls last, r.id asc
on conflict (user_id, organization_id) do nothing;

-- ============================================================================
-- ROLLBACK (manual, if ever needed — held; not part of forward migration):
--   delete from public.bty_org_memberships where identity_source = 'backfill'...
--   -- or, full teardown (nothing else references these tables):
--   drop table if exists public.bty_org_memberships;
--   drop table if exists public.bty_organizations;
--   drop table if exists public.bty_enterprises;
-- Arena access is UNCHANGED by this migration, so rollback restores nothing.
-- ============================================================================
