-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-1 — Leadership Responsibility Assignments
-- ============================================================================
-- The next ADDITIVE canonical identity dimension on top of 3.1A-1/-3. A person
-- has ONE primary role but may hold ZERO OR MORE leadership responsibilities
-- simultaneously, so this is a 0..n membership-scoped layer -- NOT a second
-- primary role, and NOT a user-global attribute.
--
-- IDENTITY FACTS ONLY. This migration grants nothing: no Arena/Foundry access,
-- no audience routing, no Learning Path or Module assignment, no XP/AIR/
-- readiness/scoring/evaluation, no change to arena_membership_requests approval.
-- Slice 3.1B-2 owns any resolver that READS these rows.
--
-- Pieces (all additive + idempotent):
--   1. bty_org_membership_responsibilities -- CURRENT STATE, one row per
--      (membership, responsibility). status active|removed. A partial unique
--      index makes a duplicate ACTIVE assignment impossible at the DB level.
--   2. bty_org_membership_responsibility_audit -- append-only history using the
--      SAME durability contract proven in 3.1A-3: nullable live FKs
--      ON DELETE SET NULL + immutable FK-free NOT NULL snapshots, so history
--      survives offboarding WITHOUT blocking the product's canonical user
--      deletion path (auth.users deletion is already shipped and cascades).
--   3. bty_curate_membership_responsibility(...) -- ONE atomic SECURITY DEFINER
--      RPC covering assign | revise_date | remove. State change + history row
--      happen in a single transaction -> no partial persistence.
--
-- KEY NAMING: `TEAM_LEAD`, not `LEAD`. `office_assignments.is_lead` is a
-- PRE-EXISTING office-scoped AUTHORIZATION flag (it narrows office_manager
-- scope in src/lib/authz-utils.ts). The concepts are unrelated, so the
-- canonical key is namespaced to make confusing them impossible. This slice
-- never reads or writes is_lead.
--
-- NEVER INFERRED from any legacy signal: leader_started_at (tenure math),
-- is_leader_track (training track), legacy job_function ('leader'/'staff'),
-- certified_leader_grants (earned time-boxed cert), office_assignments.is_lead.
-- Nothing is back-filled: every row here is an explicit admin action.
--
-- ROLLBACK: drop the function, drop the audit table, drop the state table.
-- Nothing else references them; every other system is untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Current-state responsibilities. Membership-scoped: responsibilities belong
--    to the MEMBERSHIP, not to the user, so moving organizations can never
--    silently carry them along (a different membership = different rows).
--    started_on DATE is nullable: NULL means UNKNOWN and stays NULL.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_org_membership_responsibilities (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null
    references public.bty_org_memberships (id) on delete cascade,
  responsibility_key text not null,
  started_on date null,
  status text not null default 'active',
  assigned_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bty_org_membership_responsibility_key_check
    check (
      responsibility_key in (
        'PARTNER', 'CLINICAL_DIRECTOR', 'TRAINER', 'TEAM_LEAD', 'PEOPLE_MANAGER'
      )
    ),
  constraint bty_org_membership_responsibility_status_check
    check (status in ('active', 'removed'))
);

-- A membership may hold a responsibility at most ONCE while ACTIVE. Partial, so
-- a previously removed row does not block re-assignment later (history is kept).
create unique index if not exists bty_org_membership_responsibility_one_active
  on public.bty_org_membership_responsibilities (membership_id, responsibility_key)
  where (status = 'active');

create index if not exists bty_org_membership_responsibility_membership_idx
  on public.bty_org_membership_responsibilities (membership_id)
  where (status = 'active');

revoke all on public.bty_org_membership_responsibilities from anon, public, authenticated;
alter table public.bty_org_membership_responsibilities enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Append-only history. Removal is recorded HONESTLY -- the state row flips to
--    'removed' and a history row is written; nothing is ever hard-deleted here.
--    Durability contract identical to bty_org_membership_identity_audit
--    (3.1A-3): live FKs SET NULL for convenience joins, immutable NOT NULL
--    snapshots as the authoritative record. No CASCADE, no RESTRICT.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_org_membership_responsibility_audit (
  id uuid primary key default gen_random_uuid(),
  responsibility_id uuid null
    references public.bty_org_membership_responsibilities (id) on delete set null,
  membership_id uuid null
    references public.bty_org_memberships (id) on delete set null,
  changed_by uuid null references auth.users (id) on delete set null,
  -- Immutable, FK-free, authoritative: nothing can null or remove these.
  responsibility_id_snapshot uuid not null,
  membership_id_snapshot uuid not null,
  changed_by_snapshot uuid not null,
  responsibility_key text not null,
  action text not null,
  changed_at timestamptz not null default now(),
  prev_started_on date null,
  prev_status text null,
  new_started_on date null,
  new_status text null,
  constraint bty_org_membership_responsibility_audit_action_check
    check (action in ('assign', 'revise_date', 'remove'))
);

create index if not exists bty_org_membership_responsibility_audit_membership_idx
  on public.bty_org_membership_responsibility_audit (membership_id_snapshot, changed_at desc);

revoke all on public.bty_org_membership_responsibility_audit from anon, public, authenticated;
alter table public.bty_org_membership_responsibility_audit enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Atomic curation RPC (assign | revise_date | remove).
--
--    Runs as owner so it can write the client-deny tables, but EXECUTE is
--    revoked below from every non-service role and granted to service_role
--    only, so the ONLY caller is the service-role admin route (which itself
--    gates on requireAdminEmail + manageable-org scope). The RPC re-validates
--    server-authoritatively and never trusts the caller.
--
--    The target membership must EXIST and be ACTIVE -- identical contract to
--    3.1A-3 curation. Guards raise BEFORE any write, so a rejected call leaves
--    the state row byte-equivalent and writes no history.
--
--    search_path pins pg_catalog FIRST so nothing in public can shadow a
--    built-in for this SECURITY DEFINER body.
-- ---------------------------------------------------------------------------
create or replace function public.bty_curate_membership_responsibility(
  p_membership_id uuid,
  p_responsibility_key text,
  p_action text,
  p_started_on date,
  p_changed_by uuid
)
returns table (
  responsibility_id uuid,
  membership_id uuid,
  responsibility_key text,
  action text,
  prev_started_on date,
  prev_status text,
  new_started_on date,
  new_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_membership_status text;
  v_row public.bty_org_membership_responsibilities%rowtype;
  v_id uuid;
  v_prev_started date;
  v_prev_status text;
  v_new_started date;
  v_new_status text;
  v_constraint text;
begin
  -- The membership must exist. Lock it so a concurrent identity curation cannot
  -- deactivate it underneath this mutation.
  select m.status into v_membership_status
    from public.bty_org_memberships m
   where m.id = p_membership_id
   for update;

  if not found then
    raise exception 'organization_membership_missing' using errcode = 'P0002';
  end if;

  -- Responsibilities are only curated on an ACTIVE membership (canonical
  -- active-state contract, same as 3.1A-3).
  if v_membership_status is distinct from 'active' then
    raise exception 'organization_membership_inactive' using errcode = 'P0001';
  end if;

  -- Start date may be unknown (NULL) but never in the future.
  if p_started_on is not null and p_started_on > current_date then
    raise exception 'responsibility_date_future' using errcode = 'P0001';
  end if;

  -- Current ACTIVE row for this (membership, responsibility), if any.
  select * into v_row
    from public.bty_org_membership_responsibilities r
   where r.membership_id = p_membership_id
     and r.responsibility_key = p_responsibility_key
     and r.status = 'active'
   for update;

  if p_action = 'assign' then
    if found then
      -- The partial unique index also enforces this; raising here gives the
      -- admin a precise reason instead of a raw constraint error.
      raise exception 'responsibility_already_active' using errcode = 'P0001';
    end if;
    insert into public.bty_org_membership_responsibilities
      (membership_id, responsibility_key, started_on, status, assigned_by)
    values
      (p_membership_id, p_responsibility_key, p_started_on, 'active', p_changed_by)
    returning id into v_id;
    v_prev_started := null;
    v_prev_status := null;
    v_new_started := p_started_on;
    v_new_status := 'active';

  elsif p_action = 'revise_date' then
    if not found then
      raise exception 'responsibility_not_active' using errcode = 'P0002';
    end if;
    v_id := v_row.id;
    v_prev_started := v_row.started_on;
    v_prev_status := v_row.status;
    update public.bty_org_membership_responsibilities
       set started_on = p_started_on,
           updated_at = now()
     where id = v_id;
    v_new_started := p_started_on;
    v_new_status := v_row.status;

  elsif p_action = 'remove' then
    if not found then
      raise exception 'responsibility_not_active' using errcode = 'P0002';
    end if;
    v_id := v_row.id;
    v_prev_started := v_row.started_on;
    v_prev_status := v_row.status;
    -- Honest removal: flip state, never hard-delete. History is preserved and
    -- the partial unique index frees the pair for a future re-assignment.
    update public.bty_org_membership_responsibilities
       set status = 'removed',
           updated_at = now()
     where id = v_id;
    v_new_started := v_row.started_on;
    v_new_status := 'removed';

  else
    raise exception 'invalid_responsibility_action' using errcode = 'P0001';
  end if;

  insert into public.bty_org_membership_responsibility_audit (
    responsibility_id, membership_id, changed_by,
    responsibility_id_snapshot, membership_id_snapshot, changed_by_snapshot,
    responsibility_key, action,
    prev_started_on, prev_status, new_started_on, new_status
  ) values (
    v_id, p_membership_id, p_changed_by,
    v_id, p_membership_id, p_changed_by,
    p_responsibility_key, p_action,
    v_prev_started, v_prev_status, v_new_started, v_new_status
  );

  responsibility_id := v_id;
  membership_id := p_membership_id;
  responsibility_key := p_responsibility_key;
  action := p_action;
  prev_started_on := v_prev_started;
  prev_status := v_prev_status;
  new_started_on := v_new_started;
  new_status := v_new_status;
  return next;

-- Conflict awareness: a concurrent assign of the SAME pair is serialized by the
-- partial unique index bty_org_membership_responsibility_one_active. Translate
-- 23505 into the stable reason instead of leaking a constraint error. The
-- handler rolls the whole function back -> no orphan state row, no orphan audit.
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'bty_org_membership_responsibility_one_active' then
      raise exception 'responsibility_already_active' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

revoke execute on function public.bty_curate_membership_responsibility(uuid, text, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.bty_curate_membership_responsibility(uuid, text, text, date, uuid)
  to service_role;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_curate_membership_responsibility(uuid, text, text, date, uuid);
--   drop table if exists public.bty_org_membership_responsibility_audit;
--   drop table if exists public.bty_org_membership_responsibilities;
-- Arena access, XP, Foundry, Learning Paths, and every other system are
-- UNCHANGED by this migration.
-- ============================================================================
