-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1A-3 — Professional Identity Curation (write path)
-- ============================================================================
-- Adds the ADMIN CURATION write surface on top of the 3.1A-1 canonical
-- membership foundation. This is identity curation for future learning
-- routing — NOT evaluation, scoring, access-role inference, or Learning Path
-- assignment.
--
-- Pieces (all additive + idempotent):
--   1. role_started_on DATE column on bty_org_memberships — the CANONICAL role
--      start date. Calendar date, no timezone. (The pre-existing
--      role_started_at timestamptz is left in place but is now vestigial: it is
--      all-NULL and was read only by this feature's own code, which is repointed
--      to role_started_on. No destructive DDL in a correction slice.)
--   2. bty_org_membership_identity_audit — append-only, DURABLE history of every
--      successful identity change (before + after + actor + timestamp). Audit
--      durability is achieved by immutable UUID SNAPSHOT columns (no FK), with the
--      live FKs set ON DELETE SET NULL. History therefore survives deletion of the
--      membership, the subject user, or the actor — WITHOUT the audit table
--      blocking those deletions. See the AUDIT DELETION POLICY note below.
--   3. A cross-field CHECK on bty_org_memberships enforcing job_family ↔
--      primary_role compatibility at the DB level, so an incompatible pair can
--      NEVER be injected through a direct API/RPC call (defence-in-depth).
--   4. bty_curate_membership_identity(...) — a SECURITY DEFINER plpgsql RPC that
--      curates identity on an EXISTING membership the user already has in the
--      selected organization, and (re)designates it primary, in ONE transaction.
--      It NEVER changes organization_id, never creates/merges/deletes/repoints a
--      membership row. EXECUTE is revoked from public/anon/authenticated and
--      granted to service_role only.
--
-- NON-GOALS (deliberately NOT done here):
--   * does NOT touch the legacy `memberships`/`organizations` tables
--   * does NOT change the Arena access gate (still arena_membership_requests)
--   * no XP / AIR / Arena / Reflection / readiness read or write
--   * no Learning Path, module, privilege, or historical-recalc side effect
--   * no secondary roles, no reporting hierarchy, no scheduled transfers
--   * no NEW membership creation — curation only touches existing rows
--
-- SAFETY: `add column if not exists`, `create table if not exists`, guarded
-- `add constraint`, `create or replace function`. Existing rows (job_family and
-- primary_role both NULL from the backfill) satisfy the new CHECK.
-- ROLLBACK: drop the function, drop the constraint, drop the audit table, drop
-- the role_started_on column. Nothing else references them; the access gate is
-- untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Canonical role start date — a calendar DATE (no timezone).
-- ---------------------------------------------------------------------------
alter table public.bty_org_memberships
  add column if not exists role_started_on date;

-- ---------------------------------------------------------------------------
-- 2. Append-only identity-change audit (DURABLE history; never overwritten,
--    never cascaded away). role_started_on is DATE to match the curated value.
--
--    AUDIT DELETION POLICY (measured, not inferred — Slice 3.1A-3 correction):
--    Permanent deletion blocking is NOT intentional in this product, and an
--    earlier ON DELETE RESTRICT draft would have broken live paths:
--      * public.bty_org_memberships.user_id already references auth.users
--        ON DELETE CASCADE (20260718000000) — user deletion is an EXPECTED,
--        already-shipped contract, not a hypothetical.
--      * src/app/api/admin/users/route.ts DELETE calls auth.admin.deleteUser()
--        — a live admin account-removal path.
--      * src/engine/integration/e2e-test-fixtures.service.ts and
--        e2e-three-contract-users.service.ts delete fixture users every run and
--        explicitly rely on "cascades FK children".
--    RESTRICT on membership_id/user_id/changed_by would have blocked all three
--    (and deadlocked against the existing cascade: deleting a user cascades to
--    the membership, which the audit would then refuse).
--
--    Therefore audit durability is provided WITHOUT blocking deletion:
--      * membership_id / user_id / changed_by  → nullable, ON DELETE SET NULL.
--        These are convenience joins only.
--      * *_snapshot uuid NOT NULL              → immutable, FK-free record of
--        which membership, subject, and actor the change applied to. Nothing can
--        null or remove them.
--      * prev_*/new_* columns already snapshot the full before/after identity,
--        so a record remains interpretable with every referenced row gone.
--    ON DELETE CASCADE is deliberately NOT used anywhere here — deleting a user
--    must never erase the history of who changed what.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_org_membership_identity_audit (
  id uuid primary key default gen_random_uuid(),
  -- Live FKs go NULL when the referenced row is deleted: they are convenience joins,
  -- NOT the record of what happened.
  membership_id uuid null references public.bty_org_memberships (id) on delete set null,
  user_id uuid null references auth.users (id) on delete set null,
  changed_by uuid null references auth.users (id) on delete set null,
  -- Immutable UUID snapshots — the AUTHORITATIVE, non-nullable audit record. These are
  -- plain uuid columns with NO foreign key, so no deletion anywhere can ever blank or
  -- remove them. History survives membership removal and account offboarding intact.
  membership_id_snapshot uuid not null,
  user_id_snapshot uuid not null,
  changed_by_snapshot uuid not null,
  changed_at timestamptz not null default now(),
  prev_organization_id uuid null,
  prev_job_family_key text null,
  prev_primary_role_key text null,
  prev_role_started_on date null,
  prev_is_primary boolean null,
  new_organization_id uuid null,
  new_job_family_key text null,
  new_primary_role_key text null,
  new_role_started_on date null,
  new_is_primary boolean null
);
-- Indexed on the SNAPSHOT (never nulled) so history stays queryable after deletion.
create index if not exists bty_org_membership_identity_audit_membership_idx
  on public.bty_org_membership_identity_audit (membership_id_snapshot, changed_at desc);

revoke all on public.bty_org_membership_identity_audit from anon, public, authenticated;
alter table public.bty_org_membership_identity_audit enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Cross-field integrity: a fully-specified (family, role) pair MUST agree
--    with the canonical role→family map. NULL on either side = unknown = allowed
--    (this slice never guesses identity). This is a data-integrity constraint,
--    not a business computation — it mirrors ROLE_TO_FAMILY in
--    src/domain/arena/orgIdentity.ts and makes incompatible pairs unwritable.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bty_org_membership_family_role_compat'
      and conrelid = 'public.bty_org_memberships'::regclass
  ) then
    alter table public.bty_org_memberships
      add constraint bty_org_membership_family_role_compat check (
        job_family_key is null
        or primary_role_key is null
        or (primary_role_key, job_family_key) in (
          ('GENERAL_DENTIST', 'CLINICAL_PROVIDER'),
          ('ORTHODONTIST', 'CLINICAL_PROVIDER'),
          ('DENTAL_ASSISTANT', 'CLINICAL_SUPPORT'),
          ('OFFICE_ADMIN', 'FRONT_OFFICE_ADMIN'),
          ('OFFICE_MANAGER', 'OFFICE_MANAGEMENT'),
          ('AREA_MANAGER', 'REGIONAL_OPERATIONS'),
          ('STATE_REGIONAL_DIRECTOR', 'REGIONAL_OPERATIONS'),
          ('DSO_OPERATIONS_MEMBER', 'ENTERPRISE_OPERATIONS'),
          ('SSO_SUPPORT_SPECIALIST', 'SHARED_SERVICES'),
          ('SSO_IT', 'SHARED_SERVICES'),
          ('SSO_HR', 'SHARED_SERVICES')
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Atomic curation RPC. Runs as owner (SECURITY DEFINER) so it can write the
--    client-deny tables, but EXECUTE is revoked below from every non-service
--    role and granted only to service_role, so the ONLY caller is the
--    service-role admin route (which itself gates on requireAdminEmail +
--    manageable-org scope + domain validation). The RPC re-validates
--    server-authoritatively — it never trusts the caller.
--
--    MEMBERSHIP PRESERVATION (Slice 3.1A-3 correction): this RPC operates on an
--    EXISTING membership the user already has in p_organization_id. It:
--      * finds that membership (else organization_membership_missing) —
--        NEVER creates a new one;
--      * NEVER changes organization_id, never merges/deletes/repoints any row;
--      * designates it primary by setting is_primary=true on it and is_primary
--        =false on the user's other active primary — both in one transaction;
--      * curates job_family / primary_role / role_started_on on that row only.
--    Guards: the target membership must already be ACTIVE — an inactive row is
--    never curated and never promoted (organization_membership_inactive); role
--    date must be null or not later than today (role_date_future); (family, role)
--    compatibility is enforced by the CHECK above; a concurrent primary race is
--    caught by the one-active-primary unique index and surfaced as
--    primary_membership_conflict (see the exception block at the end).
--    UPDATE(s) + audit INSERT happen in one function tx → no partial persist.
-- ---------------------------------------------------------------------------
create or replace function public.bty_curate_membership_identity(
  p_user_id uuid,
  p_organization_id uuid,
  p_job_family_key text,
  p_primary_role_key text,
  p_role_started_on date,
  p_changed_by uuid
)
returns table (
  membership_id uuid,
  prev_organization_id uuid,
  prev_job_family_key text,
  prev_primary_role_key text,
  prev_role_started_on date,
  prev_is_primary boolean,
  new_organization_id uuid,
  new_job_family_key text,
  new_primary_role_key text,
  new_role_started_on date,
  new_is_primary boolean
)
language plpgsql
security definer
-- Stricter than the repo baseline (`= public`): pg_catalog is pinned FIRST so a
-- rogue same-named object in `public` cannot shadow a built-in (now(), current_date,
-- gen_random_uuid) for this SECURITY DEFINER body. Every object below is also
-- explicitly schema-qualified, so resolution never depends on the caller.
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_org uuid;
  v_status text;
  v_prev_family text;
  v_prev_role text;
  v_prev_started date;
  v_prev_primary boolean;
  v_constraint text;
begin
  -- The membership MUST already exist for (user, selected organization). We never
  -- create, and we never move an existing row's organization_id.
  -- NOTE: status is deliberately NOT filtered here — we must be able to tell
  -- "no such membership" apart from "membership exists but is inactive", and we
  -- must hold the row lock before judging its status.
  select m.id, m.organization_id, m.status, m.job_family_key, m.primary_role_key, m.role_started_on, m.is_primary
    into v_id, v_org, v_status, v_prev_family, v_prev_role, v_prev_started, v_prev_primary
    from public.bty_org_memberships m
   where m.user_id = p_user_id
     and m.organization_id = p_organization_id
   for update;

  if not found then
    raise exception 'organization_membership_missing' using errcode = 'P0002';
  end if;

  -- The target must satisfy the canonical active-state contract. An inactive
  -- membership is never curated and never promoted to primary. This raises BEFORE
  -- any UPDATE or audit INSERT, so a rejected target leaves the row byte-equivalent,
  -- writes no audit history, and demotes nobody else's primary.
  if v_status is distinct from 'active' then
    raise exception 'organization_membership_inactive' using errcode = 'P0001';
  end if;

  -- Role start date may be unknown (NULL) but never in the future.
  if p_role_started_on is not null and p_role_started_on > current_date then
    raise exception 'role_date_future' using errcode = 'P0001';
  end if;

  -- Designate the selected membership primary: demote the user's other active
  -- primary first (protects the one-active-primary partial unique index), then
  -- promote + curate the selected row. organization_id is NEVER touched.
  update public.bty_org_memberships
     set is_primary = false,
         updated_at = now()
   where user_id = p_user_id
     and status = 'active'
     and is_primary = true
     and id <> v_id;

  update public.bty_org_memberships
     set job_family_key = p_job_family_key,
         primary_role_key = p_primary_role_key,
         role_started_on = p_role_started_on,
         is_primary = true,
         identity_source = 'admin_curated',
         updated_at = now()
   where id = v_id;

  insert into public.bty_org_membership_identity_audit (
    membership_id, user_id, changed_by,
    membership_id_snapshot, user_id_snapshot, changed_by_snapshot,
    prev_organization_id, prev_job_family_key, prev_primary_role_key, prev_role_started_on, prev_is_primary,
    new_organization_id, new_job_family_key, new_primary_role_key, new_role_started_on, new_is_primary
  ) values (
    v_id, p_user_id, p_changed_by,
    v_id, p_user_id, p_changed_by,
    v_org, v_prev_family, v_prev_role, v_prev_started, v_prev_primary,
    v_org, p_job_family_key, p_primary_role_key, p_role_started_on, true
  );

  membership_id := v_id;
  prev_organization_id := v_org;
  prev_job_family_key := v_prev_family;
  prev_primary_role_key := v_prev_role;
  prev_role_started_on := v_prev_started;
  prev_is_primary := v_prev_primary;
  new_organization_id := v_org;
  new_job_family_key := p_job_family_key;
  new_primary_role_key := p_primary_role_key;
  new_role_started_on := p_role_started_on;
  new_is_primary := true;
  return next;

-- CONFLICT AWARENESS. The single-active-primary invariant is owned by the DB index
-- bty_org_membership_one_active_primary (20260718000000):
--     unique (user_id) where (status = 'active' and is_primary = true)
-- Two concurrent curations for the SAME user targeting DIFFERENT organizations do not
-- contend on the `for update` above (different rows), so the index — not the lock — is
-- what actually serializes them. Either the loser blocks on the winner's row lock and
-- then correctly demotes it, or (when neither row was primary) the loser's promotion
-- hits the index and raises 23505. We translate that into a stable, retryable reason
-- instead of leaking a raw constraint error. The handler rolls the whole function back,
-- so a conflicted attempt persists NOTHING — no half-promotion, no orphan audit row.
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'bty_org_membership_one_active_primary' then
      raise exception 'primary_membership_conflict' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- Service-role only: strip the default PUBLIC/anon/authenticated EXECUTE grant,
-- then GRANT EXECUTE explicitly to service_role (revoking from public also
-- removes service_role's inherited PUBLIC grant, so this grant is required for
-- the intended service-role route to call the function).
revoke execute on function public.bty_curate_membership_identity(uuid, uuid, text, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.bty_curate_membership_identity(uuid, uuid, text, text, date, uuid)
  to service_role;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_curate_membership_identity(uuid, uuid, text, text, date, uuid);
--   alter table public.bty_org_memberships drop constraint if exists bty_org_membership_family_role_compat;
--   drop table if exists public.bty_org_membership_identity_audit;
--   alter table public.bty_org_memberships drop column if exists role_started_on;
-- Arena access, XP, and every other system are UNCHANGED by this migration.
-- ============================================================================
