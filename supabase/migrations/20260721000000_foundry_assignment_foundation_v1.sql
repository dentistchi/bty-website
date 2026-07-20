-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-3B — Identity-Bound Foundry Participation: SCHEMA FOUNDATION
-- ============================================================================
-- MIGRATION-ONLY. This creates the database foundation for identity-bound
-- Foundry assignment and NOTHING ELSE. It does not create assignments, does not
-- resolve audiences, does not claim participation, adds no learner or Host UI,
-- enforces no access, and changes NO existing Foundry room behavior. Publish-time
-- assignment creation is Slice 3.1B-3C; claiming is 3.1B-3D.
--
-- Product contract (docs/FOUNDRY_IDENTITY_BOUND_PARTICIPATION_CONTRACT.md):
--   * Foundry participation stays anonymous and link-based.
--   * ASSIGNED_OVERLAY does NOT gate entry — it means the event ALSO carries a
--     frozen canonical recipient set. Anonymous joining is unaffected.
--   * Assignment is identity-bound via the EXISTING claim seam (claim-xp /
--     linked_user_id); this slice only lays the tables the later claim writes to.
--   * Host-assigns-to-member is a NEW authorization shape with no precedent in
--     this product, so every future write is service-role-only through a
--     SECURITY DEFINER RPC with explicit Host + same-organization checks. This
--     migration ships the client-deny tables + one guarded validation RPC that
--     PROVES the boundary; it is wired to no product behavior.
--   * No backfill. Existing events are OPEN_LINK by absence of a mode row; the
--     15 historical participants and 7 unlinked progress rows are untouched.
--
-- Pieces (all additive + idempotent):
--   1. foundry_event_participation_mode — one optional row per event. ABSENT ⇒
--      OPEN_LINK (so every one of the 19 existing events keeps working with zero
--      backfill). A row with 'assigned_overlay' means the event also has a
--      recipient snapshot; it never blocks anonymous joins.
--   2. foundry_event_audience_snapshot — the immutable audience DECLARATION
--      resolved at publish (type/detail/resolver version/resolved-by/count).
--   3. foundry_event_assignments — the immutable RECIPIENT SET, one row per
--      (event, membership), with the claim + completion linkage the later slices
--      fill in. Durability = 3.1A-3 pattern (SET NULL live FKs + NOT NULL
--      snapshots) so offboarding is never blocked.
--   4. foundry_event_assignment_audit — append-only history of every assignment
--      state change (who/when/before/after).
--   5. bty_foundry_assign_membership(...) — a SECURITY DEFINER VALIDATION RPC
--      that proves the secure write boundary (Host + active + same-org +
--      canonical-user-from-membership). EXECUTE service_role only. NOT called by
--      any product code in this slice.
--
-- ROLLBACK: drop the function, the audit table, the assignments table, the
-- audience snapshot table, the participation-mode table. Nothing else references
-- them; every existing Foundry table, participant, and behavior is unchanged.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Participation mode — ABSENCE means OPEN_LINK. Chosen over a column on
--    foundry_events so the existing table is never rewritten and historical
--    events need no backfill: no row = today's behavior, exactly.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_event_participation_mode (
  event_id uuid primary key references public.foundry_events (id) on delete cascade,
  mode text not null,
  set_by uuid null references auth.users (id) on delete set null,
  set_at timestamptz not null default now(),
  constraint foundry_event_participation_mode_check
    check (mode in ('open_link', 'assigned_overlay'))
);

revoke all on public.foundry_event_participation_mode from anon, public, authenticated;
alter table public.foundry_event_participation_mode enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Audience snapshot — the immutable DECLARATION captured at publish. One row
--    per event. Mirrors the immutability intent of foundry_event_module: it
--    records what audience was resolved, by which resolver version, when, by
--    whom, and how many members it produced — enough to reproduce the historical
--    audience without recomputation.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_event_audience_snapshot (
  event_id uuid primary key references public.foundry_events (id) on delete cascade,
  organization_id uuid not null references public.bty_organizations (id) on delete restrict,
  audience_type text not null,
  audience_detail text null,
  resolver_version text not null,
  resolved_count integer not null,
  resolved_at timestamptz not null default now(),
  resolved_by uuid null references auth.users (id) on delete set null,
  resolved_by_snapshot uuid not null,
  constraint foundry_event_audience_snapshot_type_check
    check (audience_type in ('everyone', 'leaders', 'job_group', 'specific_role')),
  constraint foundry_event_audience_snapshot_count_check
    check (resolved_count >= 0)
);

revoke all on public.foundry_event_audience_snapshot from anon, public, authenticated;
alter table public.foundry_event_audience_snapshot enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Assignments — the immutable RECIPIENT SET. One row per (event, membership).
--    membership_id is the canonical organizational target; user_id is captured
--    as a VALUE at publish time (snapshot) so a later membership change never
--    silently transfers the assignment. Durability follows 3.1A-3: live FKs
--    SET NULL, immutable NOT NULL snapshots.
--
--    Claim linkage: participant_id/claimed_at are filled by the FUTURE claim
--    (3.1B-3D). A partial unique index guarantees one participant claims at most
--    one assignment per event, and the row's own PK guarantees one assignment is
--    claimed by at most one participant.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events (id) on delete cascade,
  organization_id uuid not null references public.bty_organizations (id) on delete restrict,
  -- Live convenience FKs (nullable, SET NULL) + immutable value snapshots.
  membership_id uuid null references public.bty_org_memberships (id) on delete set null,
  user_id uuid null references auth.users (id) on delete set null,
  membership_id_snapshot uuid not null,
  user_id_snapshot uuid not null,
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  assigned_by uuid null references auth.users (id) on delete set null,
  assigned_by_snapshot uuid not null,
  -- Claim + completion linkage — filled by later slices, nullable here.
  participant_id uuid null references public.foundry_event_participants (id) on delete set null,
  claimed_at timestamptz null,
  completed_at timestamptz null,
  revoked_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint foundry_event_assignment_status_check
    check (status in ('assigned', 'claimed', 'completed', 'revoked')),
  -- At most ONE assignment per (event, membership) — deterministic duplicate
  -- prevention keyed on the immutable snapshot so it holds even if the live FK
  -- is later nulled by offboarding.
  constraint foundry_event_assignment_event_membership_unique
    unique (event_id, membership_id_snapshot)
);

-- One participant may claim at most one assignment per event: enforced on the
-- claimed participant, scoped to rows that have actually been claimed.
create unique index if not exists foundry_event_assignment_one_claim_per_participant
  on public.foundry_event_assignments (event_id, participant_id)
  where (participant_id is not null);

create index if not exists foundry_event_assignment_event_idx
  on public.foundry_event_assignments (event_id);
create index if not exists foundry_event_assignment_user_idx
  on public.foundry_event_assignments (user_id_snapshot);

revoke all on public.foundry_event_assignments from anon, public, authenticated;
alter table public.foundry_event_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Append-only assignment history (3.1B-1 pattern). Every state change writes
--    a row; nothing is hard-deleted. Revocation is a status change recorded
--    here, never a DELETE.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_event_assignment_audit (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid null references public.foundry_event_assignments (id) on delete set null,
  event_id uuid null references public.foundry_events (id) on delete set null,
  changed_by uuid null references auth.users (id) on delete set null,
  assignment_id_snapshot uuid not null,
  event_id_snapshot uuid not null,
  membership_id_snapshot uuid not null,
  changed_by_snapshot uuid not null,
  action text not null,
  prev_status text null,
  new_status text null,
  changed_at timestamptz not null default now(),
  constraint foundry_event_assignment_audit_action_check
    check (action in ('assign', 'claim', 'complete', 'revoke'))
);

create index if not exists foundry_event_assignment_audit_assignment_idx
  on public.foundry_event_assignment_audit (assignment_id_snapshot, changed_at desc);

revoke all on public.foundry_event_assignment_audit from anon, public, authenticated;
alter table public.foundry_event_assignment_audit enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Secure-boundary VALIDATION RPC. This proves the schema's authorization
--    boundary is expressible and enforced, but is deliberately wired to NO
--    product behavior in this slice (3.1B-3C calls the real creation path).
--
--    It validates — server-authoritatively — that a prospective assignment is
--    legitimate, and raises a stable reason otherwise:
--      * the actor holds an ACTIVE Foundry Host grant           (not_a_host)
--      * the target membership exists and is ACTIVE              (membership_missing / membership_inactive)
--      * the target membership's organization matches the event's
--        audience-snapshot organization = SAME-ORG isolation    (cross_organization)
--    The canonical user is DERIVED from the membership, never taken from the
--    caller. EXECUTE is service_role only.
-- ---------------------------------------------------------------------------
create or replace function public.bty_foundry_validate_assignment(
  p_event_id uuid,
  p_membership_id uuid,
  p_actor_user_id uuid
)
returns table (
  ok boolean,
  organization_id uuid,
  target_user_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_is_host boolean;
  v_mstatus text;
  v_morg uuid;
  v_muser uuid;
  v_event_org uuid;
begin
  -- Actor must hold an ACTIVE Foundry Host grant. Host capability is NOT implied
  -- by authentication and is NEVER granted by any leadership responsibility.
  select exists (
    select 1 from public.foundry_host_grants g
     where g.user_id = p_actor_user_id and g.status = 'active'
  ) into v_is_host;
  if not v_is_host then
    raise exception 'not_a_host' using errcode = 'P0001';
  end if;

  -- Target membership must exist and be ACTIVE. Canonical user is derived here,
  -- never accepted from the caller.
  select m.status, m.organization_id, m.user_id
    into v_mstatus, v_morg, v_muser
    from public.bty_org_memberships m
   where m.id = p_membership_id;
  if not found then
    raise exception 'membership_missing' using errcode = 'P0002';
  end if;
  if v_mstatus is distinct from 'active' then
    raise exception 'membership_inactive' using errcode = 'P0001';
  end if;

  -- Same-organization isolation: the membership's org must match the event's
  -- resolved audience-snapshot org. An event with no snapshot yet cannot be
  -- assigned into (3.1B-3C creates the snapshot first).
  select s.organization_id into v_event_org
    from public.foundry_event_audience_snapshot s
   where s.event_id = p_event_id;
  if not found then
    raise exception 'audience_snapshot_missing' using errcode = 'P0002';
  end if;
  if v_event_org is distinct from v_morg then
    raise exception 'cross_organization' using errcode = 'P0001';
  end if;

  ok := true;
  organization_id := v_morg;
  target_user_id := v_muser;
  return next;
end;
$$;

revoke execute on function public.bty_foundry_validate_assignment(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_validate_assignment(uuid, uuid, uuid)
  to service_role;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_foundry_validate_assignment(uuid, uuid, uuid);
--   drop table if exists public.foundry_event_assignment_audit;
--   drop table if exists public.foundry_event_assignments;
--   drop table if exists public.foundry_event_audience_snapshot;
--   drop table if exists public.foundry_event_participation_mode;
-- Existing Foundry events, participants, claim-xp, XP, Arena, identity,
-- responsibilities, and access are UNCHANGED by this migration.
-- ============================================================================
