-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-3N — Host Action Verification & Revision V1
-- Action Review Authority: explicit reviewer_membership -> learner_membership edge.
-- ============================================================================
-- WHY: Arena Action Contracts are Arena-born (user_id-scoped) and have NO Foundry
-- event owner. Remote Host verification needs a SAFE, provable reviewer->learner
-- authority edge. Membership RESPONSIBILITIES are unary identity facts and cannot
-- express "reviewer X may review learner Y". This adds that binary edge. See ADR-006.
--
-- SCOPE INVARIANTS (V1): explicit ONE-HOP edge only; default deny; same organization;
-- non-self (membership AND user); both user-bound; authority_key='ACTION_REVIEWER' only.
-- Foundry event ownership / participation / role titles grant NOTHING.
--
-- SECURITY MODEL: ALL mutations via the SECURITY DEFINER RPC (runs as object owner).
-- service_role gets SELECT-only on both tables + EXECUTE on the RPC; NO direct
-- INSERT/UPDATE/DELETE/TRUNCATE. State-table trigger re-validates ACTIVE edges.
-- Audit is APPEND-ONLY at the DB layer (UPDATE/DELETE rejected; INSERT open for the RPC).
--
-- REVOKE LIFECYCLE: the RPC branches by operation. ASSIGN fully validates both
-- memberships (exist + active + user-bound + same-org + non-self). REVOKE operates
-- ONLY on the stored ACTIVE edge (selected FOR UPDATE) and does NOT re-validate
-- membership activity/binding, and takes organization_id from the stored row -- so
-- permission teardown stays possible after an employee departs / role is removed /
-- a membership goes inactive. Removing an edge NEVER grants access: the product
-- authority resolver independently requires active memberships + an active edge, so
-- an inactive membership grants zero review access even before the cleanup revoke.
--
-- ATOMICITY: the whole migration runs inside ONE transaction (begin;...commit;). Any
-- failure rolls back every object -- a partial apply is impossible.
--
-- AUDIT FK-FREE CONVENIENCE COLUMNS: audit.authority_id / audit.changed_by are plain
-- nullable UUIDs (NO foreign key). A live FK with ON DELETE SET NULL would UPDATE the
-- audit row on parent deletion, which the append-only trigger rejects -> deletion
-- deadlock. The immutable NOT NULL snapshot columns are the authoritative record.
--
-- DELETE SEMANTICS: state membership/org FKs use ON DELETE RESTRICT (never CASCADE) so
-- authorization state cannot silently vanish. NOTE for apply-review: memberships.user_id
-- -> auth.users is ON DELETE CASCADE, so an active edge blocks user deletion until revoked.
--
-- ADDITIVE + IDEMPOTENT. Touches NO existing table. Escalation columns NOT referenced
-- (deferred to Slice 3.1B-3O).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Authority state table (reviewer->learner MEMBERSHIP edge; org-scoped).
-- ---------------------------------------------------------------------------
create table if not exists public.bty_org_action_review_authority (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.bty_organizations (id) on delete restrict,
  reviewer_membership_id uuid not null
    references public.bty_org_memberships (id) on delete restrict,
  learner_membership_id uuid not null
    references public.bty_org_memberships (id) on delete restrict,
  authority_key text not null,
  status text not null default 'active',
  started_on date not null default current_date,
  assigned_by uuid null references auth.users (id) on delete set null,
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bty_action_review_authority_key_check
    check (authority_key in ('ACTION_REVIEWER')),
  constraint bty_action_review_authority_status_check
    check (status in ('active', 'revoked')),
  constraint bty_action_review_authority_no_self
    check (reviewer_membership_id <> learner_membership_id),
  constraint bty_action_review_authority_revoked_consistency
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    )
);

-- 2. Indexes: one active edge per (reviewer, learner, authority) + hot-path lookups.
create unique index if not exists bty_action_review_authority_one_active
  on public.bty_org_action_review_authority
     (reviewer_membership_id, learner_membership_id, authority_key)
  where (status = 'active');
create index if not exists bty_action_review_authority_reviewer_active_idx
  on public.bty_org_action_review_authority (reviewer_membership_id)
  where (status = 'active');
create index if not exists bty_action_review_authority_learner_active_idx
  on public.bty_org_action_review_authority (learner_membership_id)
  where (status = 'active');

-- 3. RLS on + initial client revokes (no permissive policy = deny anon/authenticated).
revoke all on public.bty_org_action_review_authority from anon, public, authenticated;
alter table public.bty_org_action_review_authority enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Append-only audit table. authority_id / changed_by are FK-FREE nullable
--    convenience columns (see header). The *_snapshot columns are the immutable,
--    NOT NULL, FK-free authoritative record. MUST exist before its trigger.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_org_action_review_authority_audit (
  id uuid primary key default gen_random_uuid(),
  authority_id uuid null,
  changed_by uuid null,
  authority_id_snapshot uuid not null,
  reviewer_membership_id_snapshot uuid not null,
  learner_membership_id_snapshot uuid not null,
  organization_id_snapshot uuid not null,
  changed_by_snapshot uuid not null,
  authority_key text not null,
  action text not null,
  prev_status text null,
  new_status text null,
  changed_at timestamptz not null default now(),
  constraint bty_action_review_authority_audit_action_check
    check (action in ('assign', 'revoke'))
);

-- 5. Audit index.
create index if not exists bty_action_review_authority_audit_reviewer_idx
  on public.bty_org_action_review_authority_audit
     (reviewer_membership_id_snapshot, changed_at desc);

-- 6. RLS on + initial client revokes for the audit table.
revoke all on public.bty_org_action_review_authority_audit from anon, public, authenticated;
alter table public.bty_org_action_review_authority_audit enable row level security;

-- ---------------------------------------------------------------------------
-- 7. State validation function. Full membership/org validation applies ONLY to
--    ACTIVE edges (a revoke transition to 'revoked' is never blocked by a
--    now-inactive membership).
-- ---------------------------------------------------------------------------
create or replace function public.bty_action_review_authority_validate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rev record;
  v_lrn record;
begin
  if new.authority_key is distinct from 'ACTION_REVIEWER' then
    raise exception 'invalid_action_review_authority' using errcode = 'P0001';
  end if;
  if new.reviewer_membership_id = new.learner_membership_id then
    raise exception 'action_review_self' using errcode = 'P0001';
  end if;
  if new.status = 'active' and new.revoked_at is not null then
    raise exception 'action_review_revoked_inconsistent' using errcode = 'P0001';
  end if;
  if new.status = 'revoked' and new.revoked_at is null then
    raise exception 'action_review_revoked_inconsistent' using errcode = 'P0001';
  end if;

  if new.status = 'active' then
    select m.user_id, m.organization_id, m.status
      into v_rev
      from public.bty_org_memberships m
     where m.id = new.reviewer_membership_id;
    if not found then
      raise exception 'reviewer_membership_missing' using errcode = 'P0002';
    end if;
    if v_rev.status is distinct from 'active' then
      raise exception 'reviewer_membership_inactive' using errcode = 'P0001';
    end if;
    if v_rev.user_id is null then
      raise exception 'reviewer_membership_unbound' using errcode = 'P0001';
    end if;

    select m.user_id, m.organization_id, m.status
      into v_lrn
      from public.bty_org_memberships m
     where m.id = new.learner_membership_id;
    if not found then
      raise exception 'learner_membership_missing' using errcode = 'P0002';
    end if;
    if v_lrn.status is distinct from 'active' then
      raise exception 'learner_membership_inactive' using errcode = 'P0001';
    end if;
    if v_lrn.user_id is null then
      raise exception 'learner_membership_unbound' using errcode = 'P0001';
    end if;

    if v_rev.organization_id is distinct from v_lrn.organization_id then
      raise exception 'action_review_cross_org' using errcode = 'P0001';
    end if;
    if new.organization_id is distinct from v_rev.organization_id then
      raise exception 'action_review_cross_org' using errcode = 'P0001';
    end if;
    if v_rev.user_id = v_lrn.user_id then
      raise exception 'action_review_self' using errcode = 'P0001';
    end if;
    if new.started_on > current_date then
      raise exception 'action_review_future_start' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.bty_action_review_authority_validate()
  from public, anon, authenticated;

-- 8. State validation trigger.
create or replace trigger bty_action_review_authority_validate_trg
  before insert or update on public.bty_org_action_review_authority
  for each row execute function public.bty_action_review_authority_validate();

-- ---------------------------------------------------------------------------
-- 9. Audit immutability function. Append-only: any UPDATE/DELETE is rejected,
--    INSERT (from the trusted RPC) is allowed. Statement-level so it fires even
--    when zero rows match (verifiable on an empty table).
-- ---------------------------------------------------------------------------
create or replace function public.bty_action_review_authority_audit_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'action_review_authority_audit_immutable' using errcode = 'P0001';
end;
$$;

revoke execute on function public.bty_action_review_authority_audit_immutable()
  from public, anon, authenticated;

-- 10. Audit immutable UPDATE/DELETE trigger (applies to service-role direct ops too).
create or replace trigger bty_action_review_authority_audit_immutable_trg
  before update or delete on public.bty_org_action_review_authority_audit
  for each statement execute function public.bty_action_review_authority_audit_immutable();

-- ---------------------------------------------------------------------------
-- 11. Explicit service_role table privilege boundary. SELECT-only on both tables;
--     no direct INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER. All mutation flows
--     through the SECURITY DEFINER RPC (runs as object owner, not caller).
-- ---------------------------------------------------------------------------
revoke all on public.bty_org_action_review_authority from service_role;
revoke all on public.bty_org_action_review_authority_audit from service_role;
grant select on public.bty_org_action_review_authority to service_role;
grant select on public.bty_org_action_review_authority_audit to service_role;

-- ---------------------------------------------------------------------------
-- 12. Atomic curation RPC (assign | revoke). service_role-only EXECUTE. Actor is
--     NEVER trusted from a browser. Branches by operation: ASSIGN fully validates
--     memberships; REVOKE acts only on the stored ACTIVE edge (teardown-safe).
-- ---------------------------------------------------------------------------
create or replace function public.bty_curate_action_review_authority(
  p_reviewer_membership_id uuid,
  p_learner_membership_id uuid,
  p_authority_key text,
  p_action text,
  p_started_on date,
  p_changed_by uuid
)
returns table (
  authority_id uuid,
  organization_id uuid,
  reviewer_membership_id uuid,
  learner_membership_id uuid,
  authority_key text,
  action text,
  prev_status text,
  new_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rev record;
  v_lrn record;
  v_row public.bty_org_action_review_authority%rowtype;
  v_id uuid;
  v_org uuid;
  v_started date;
  v_prev text;
  v_new text;
begin
  -- ===== COMMON VALIDATION (assign + revoke) =====
  if p_changed_by is null then
    raise exception 'action_review_actor_missing' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_changed_by) then
    raise exception 'action_review_actor_invalid' using errcode = 'P0001';
  end if;
  if p_authority_key is distinct from 'ACTION_REVIEWER' then
    raise exception 'invalid_action_review_authority' using errcode = 'P0001';
  end if;
  -- NULL-safe: NULL NOT IN (...) is NULL, so a null action must be rejected explicitly
  -- (otherwise it would fall through the assign/else branch into revoke).
  if p_action is null or p_action not in ('assign', 'revoke') then
    raise exception 'invalid_action_review_action' using errcode = 'P0001';
  end if;
  if p_reviewer_membership_id is null then
    raise exception 'reviewer_membership_missing' using errcode = 'P0002';
  end if;
  if p_learner_membership_id is null then
    raise exception 'learner_membership_missing' using errcode = 'P0002';
  end if;
  if p_reviewer_membership_id = p_learner_membership_id then
    raise exception 'action_review_self' using errcode = 'P0001';
  end if;

  if p_action = 'assign' then
    -- ===== ASSIGN PATH: full identity/org validation =====
    select m.user_id, m.organization_id, m.status
      into v_rev
      from public.bty_org_memberships m
     where m.id = p_reviewer_membership_id
     for update;
    if not found then
      raise exception 'reviewer_membership_missing' using errcode = 'P0002';
    end if;
    if v_rev.status is distinct from 'active' then
      raise exception 'reviewer_membership_inactive' using errcode = 'P0001';
    end if;
    if v_rev.user_id is null then
      raise exception 'reviewer_membership_unbound' using errcode = 'P0001';
    end if;

    select m.user_id, m.organization_id, m.status
      into v_lrn
      from public.bty_org_memberships m
     where m.id = p_learner_membership_id
     for update;
    if not found then
      raise exception 'learner_membership_missing' using errcode = 'P0002';
    end if;
    if v_lrn.status is distinct from 'active' then
      raise exception 'learner_membership_inactive' using errcode = 'P0001';
    end if;
    if v_lrn.user_id is null then
      raise exception 'learner_membership_unbound' using errcode = 'P0001';
    end if;

    if v_rev.organization_id is distinct from v_lrn.organization_id then
      raise exception 'action_review_cross_org' using errcode = 'P0001';
    end if;
    if v_rev.user_id = v_lrn.user_id then
      raise exception 'action_review_self' using errcode = 'P0001';
    end if;
    v_org := v_rev.organization_id;

    select * into v_row
      from public.bty_org_action_review_authority r
     where r.reviewer_membership_id = p_reviewer_membership_id
       and r.learner_membership_id = p_learner_membership_id
       and r.authority_key = p_authority_key
       and r.status = 'active'
     for update;
    if found then
      raise exception 'action_review_already_active' using errcode = 'P0001';
    end if;

    v_started := coalesce(p_started_on, current_date);
    if v_started > current_date then
      raise exception 'action_review_future_start' using errcode = 'P0001';
    end if;

    insert into public.bty_org_action_review_authority
      (organization_id, reviewer_membership_id, learner_membership_id,
       authority_key, status, started_on, assigned_by)
    values
      (v_org, p_reviewer_membership_id, p_learner_membership_id,
       p_authority_key, 'active', v_started, p_changed_by)
    returning id into v_id;
    v_prev := null;
    v_new := 'active';

  else
    -- ===== REVOKE PATH: operate ONLY on the stored ACTIVE edge (teardown-safe).
    -- No membership activity/binding re-validation; org from the stored row.
    select * into v_row
      from public.bty_org_action_review_authority r
     where r.reviewer_membership_id = p_reviewer_membership_id
       and r.learner_membership_id = p_learner_membership_id
       and r.authority_key = p_authority_key
       and r.status = 'active'
     for update;
    if not found then
      raise exception 'action_review_not_active' using errcode = 'P0002';
    end if;

    v_id := v_row.id;
    v_org := v_row.organization_id;
    v_prev := v_row.status;
    update public.bty_org_action_review_authority
       set status = 'revoked',
           revoked_at = now(),
           revoked_by = p_changed_by,
           updated_at = now()
     where id = v_id;
    v_new := 'revoked';
  end if;

  -- ===== COMMON AUDIT (exactly one row per successful operation) =====
  insert into public.bty_org_action_review_authority_audit (
    authority_id, changed_by,
    authority_id_snapshot, reviewer_membership_id_snapshot,
    learner_membership_id_snapshot, organization_id_snapshot, changed_by_snapshot,
    authority_key, action, prev_status, new_status
  ) values (
    v_id, p_changed_by,
    v_id, p_reviewer_membership_id,
    p_learner_membership_id, v_org, p_changed_by,
    p_authority_key, p_action, v_prev, v_new
  );

  authority_id := v_id;
  organization_id := v_org;
  reviewer_membership_id := p_reviewer_membership_id;
  learner_membership_id := p_learner_membership_id;
  authority_key := p_authority_key;
  action := p_action;
  prev_status := v_prev;
  new_status := v_new;
  return next;

-- Concurrent assign of the SAME pair is serialized by the partial unique index;
-- translate to the stable domain error. The handler rolls the whole function back
-- -> no orphan state row, NO false-success audit row.
exception
  when unique_violation then
    raise exception 'action_review_already_active' using errcode = 'P0001';
end;
$$;

-- 13. RPC execute privileges: service_role only.
revoke execute on function public.bty_curate_action_review_authority(uuid, uuid, text, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.bty_curate_action_review_authority(uuid, uuid, text, text, date, uuid)
  to service_role;

commit;

-- ============================================================================
-- ROLLBACK (manual; PARTIAL-STATE-SAFE, dependency order, NO CASCADE). Run OUTSIDE
-- the migration transaction; safe for any subset of objects existing:
--   drop function if exists public.bty_curate_action_review_authority(uuid, uuid, text, text, date, uuid);
--   do $rb$ begin
--     if to_regclass('public.bty_org_action_review_authority_audit') is not null then
--       drop trigger if exists bty_action_review_authority_audit_immutable_trg
--         on public.bty_org_action_review_authority_audit;
--     end if;
--   end $rb$;
--   drop function if exists public.bty_action_review_authority_audit_immutable();
--   do $rb$ begin
--     if to_regclass('public.bty_org_action_review_authority') is not null then
--       drop trigger if exists bty_action_review_authority_validate_trg
--         on public.bty_org_action_review_authority;
--     end if;
--   end $rb$;
--   drop function if exists public.bty_action_review_authority_validate();
--   drop table if exists public.bty_org_action_review_authority_audit;
--   drop table if exists public.bty_org_action_review_authority;
-- Arena, XP, Foundry, responsibilities, escalations, and every other system are
-- UNCHANGED by this migration.
-- ============================================================================
