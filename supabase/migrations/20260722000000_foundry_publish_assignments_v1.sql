-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-3C — Publish-Time Audience Snapshot + Assignment Creation
-- ============================================================================
-- Connects the 3.1B-3B schema foundation to the real publish path. Adds TWO
-- SECURITY DEFINER functions, both service-role only:
--
--   1. bty_foundry_resolve_audience(actor, audience_type, audience_detail)
--      -- READ-ONLY. Returns the eligible active memberships for the actor's OWN
--      organization under a canonical audience. Used for the pre-flight
--      zero-recipient check BEFORE any event is created, so an assigned publish
--      with zero recipients creates nothing at all.
--
--   2. bty_foundry_publish_assignments(event_id, actor, audience_type,
--      audience_detail) -- THE ATOMIC WRITE. In ONE function transaction:
--      derive org from the actor, freeze the audience snapshot, resolve the
--      recipient memberships, insert one assignment per member, append one audit
--      row per assignment, and write the participation-mode row. If ANY step
--      raises, the whole function rolls back -> no snapshot, no assignments, no
--      audit, no mode row. The CALLER then compensates the event it created.
--
-- CANONICAL RESOLUTION (mirrors the domain resolvers; legacy signals NEVER used):
--   everyone       -> all active memberships in the org
--   leaders        -> active memberships with >=1 ACTIVE canonical responsibility
--                     (PARTNER, CLINICAL_DIRECTOR, TRAINER, TEAM_LEAD, PEOPLE_MANAGER)
--   job_group      -> active memberships whose job_family_key = detail
--   specific_role  -> active memberships whose primary_role_key = detail
-- No job_function, is_leader_track, leader_started_at, office_assignments.is_lead,
-- certified_leader_grants, tenure, title, or XP is ever consulted.
--
-- ORG ISOLATION: organization is DERIVED from the actor's own active primary
-- membership. The caller cannot supply an org, member ids, user ids, a count, or
-- an actor snapshot. A Host therefore can only ever assign within their own org.
--
-- IDENTITY: user_id_snapshot is derived from each membership row, never trusted.
-- Assignment != participation: participant_id stays NULL (claim is 3.1B-3D).
--
-- ROLLBACK: drop both functions. The 3.1B-3B tables and every existing behavior
-- are untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Shared resolver body as a language-sql helper the two functions reuse, so the
-- pre-flight count and the atomic write can never diverge. Returns membership id
-- + user id for the eligible set in the given org under the given audience.
-- SECURITY DEFINER + pinned search_path; service-role only.
-- ---------------------------------------------------------------------------
create or replace function public.bty_foundry_eligible_memberships(
  p_organization_id uuid,
  p_audience_type text,
  p_audience_detail text
)
returns table (membership_id uuid, user_id uuid)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select m.id, m.user_id
    from public.bty_org_memberships m
   where m.organization_id = p_organization_id
     and m.status = 'active'
     and (
       p_audience_type = 'everyone'
       or (
         p_audience_type = 'leaders'
         and exists (
           select 1 from public.bty_org_membership_responsibilities r
            where r.membership_id = m.id
              and r.status = 'active'
              and r.responsibility_key in
                ('PARTNER', 'CLINICAL_DIRECTOR', 'TRAINER', 'TEAM_LEAD', 'PEOPLE_MANAGER')
         )
       )
       or (p_audience_type = 'job_group' and m.job_family_key = p_audience_detail)
       or (p_audience_type = 'specific_role' and m.primary_role_key = p_audience_detail)
     );
$$;

revoke execute on function public.bty_foundry_eligible_memberships(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_eligible_memberships(uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Read-only pre-flight: the eligible set for the ACTOR's own organization.
-- Org is derived from the actor; the caller supplies no org. Used to reject a
-- zero-recipient assigned publish before any event exists.
-- ---------------------------------------------------------------------------
create or replace function public.bty_foundry_resolve_audience(
  p_actor_user_id uuid,
  p_audience_type text,
  p_audience_detail text
)
returns table (membership_id uuid, user_id uuid, organization_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
begin
  if p_audience_type not in ('everyone', 'leaders', 'job_group', 'specific_role') then
    raise exception 'unsupported_audience' using errcode = 'P0001';
  end if;
  if p_audience_type in ('job_group', 'specific_role')
     and (p_audience_detail is null or btrim(p_audience_detail) = '') then
    raise exception 'audience_detail_required' using errcode = 'P0001';
  end if;

  select om.organization_id into v_org
    from public.bty_org_memberships om
   where om.user_id = p_actor_user_id and om.status = 'active' and om.is_primary = true;
  if not found then
    raise exception 'actor_organization_unresolved' using errcode = 'P0002';
  end if;

  return query
    select e.membership_id, e.user_id, v_org
      from public.bty_foundry_eligible_memberships(v_org, p_audience_type, p_audience_detail) e;
end;
$$;

revoke execute on function public.bty_foundry_resolve_audience(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_resolve_audience(uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- THE ATOMIC WRITE. Everything below happens in one function transaction.
-- Preconditions the caller has already met: the event EXISTS and is owned by the
-- actor; the actor is an active Foundry Host (route/service gate). This function
-- re-derives org server-authoritatively and never trusts a client value.
-- ---------------------------------------------------------------------------
create or replace function public.bty_foundry_publish_assignments(
  p_event_id uuid,
  p_actor_user_id uuid,
  p_audience_type text,
  p_audience_detail text
)
returns table (assignment_count integer, organization_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_is_host boolean;
  v_org uuid;
  v_count integer := 0;
  v_rec record;
  v_assignment_id uuid;
begin
  -- Host capability re-checked at the write boundary (defence in depth; leadership
  -- responsibility never implies Host).
  select exists (
    select 1 from public.foundry_host_grants g
     where g.user_id = p_actor_user_id and g.status = 'active'
  ) into v_is_host;
  if not v_is_host then
    raise exception 'not_a_host' using errcode = 'P0001';
  end if;

  if p_audience_type not in ('everyone', 'leaders', 'job_group', 'specific_role') then
    raise exception 'unsupported_audience' using errcode = 'P0001';
  end if;
  if p_audience_type in ('job_group', 'specific_role')
     and (p_audience_detail is null or btrim(p_audience_detail) = '') then
    raise exception 'audience_detail_required' using errcode = 'P0001';
  end if;

  -- Idempotency: a snapshot already frozen for this event = already published.
  -- Return the existing count; write nothing new.
  if exists (select 1 from public.foundry_event_audience_snapshot s where s.event_id = p_event_id) then
    select s.resolved_count, s.organization_id into v_count, v_org
      from public.foundry_event_audience_snapshot s where s.event_id = p_event_id;
    assignment_count := v_count;
    organization_id := v_org;
    return next;
    return;
  end if;

  -- Organization derived from the actor's OWN active primary membership.
  select om.organization_id into v_org
    from public.bty_org_memberships om
   where om.user_id = p_actor_user_id and om.status = 'active' and om.is_primary = true;
  if not found then
    raise exception 'actor_organization_unresolved' using errcode = 'P0002';
  end if;

  -- Insert one assignment + one audit row per eligible membership. user_id is
  -- derived from the membership, never supplied. Count as we go.
  for v_rec in
    select e.membership_id, e.user_id
      from public.bty_foundry_eligible_memberships(v_org, p_audience_type, p_audience_detail) e
  loop
    insert into public.foundry_event_assignments (
      event_id, organization_id,
      membership_id, user_id, membership_id_snapshot, user_id_snapshot,
      status, assigned_by, assigned_by_snapshot
    ) values (
      p_event_id, v_org,
      v_rec.membership_id, v_rec.user_id, v_rec.membership_id, v_rec.user_id,
      'assigned', p_actor_user_id, p_actor_user_id
    )
    returning id into v_assignment_id;

    insert into public.foundry_event_assignment_audit (
      assignment_id, event_id, changed_by,
      assignment_id_snapshot, event_id_snapshot, membership_id_snapshot, changed_by_snapshot,
      action, prev_status, new_status
    ) values (
      v_assignment_id, p_event_id, p_actor_user_id,
      v_assignment_id, p_event_id, v_rec.membership_id, p_actor_user_id,
      'assign', null, 'assigned'
    );

    v_count := v_count + 1;
  end loop;

  -- Zero recipients must NEVER produce a successful assigned publish. The caller
  -- pre-flights this, but the write path refuses too (defence in depth).
  if v_count = 0 then
    raise exception 'zero_recipients' using errcode = 'P0001';
  end if;

  -- Freeze the immutable audience declaration (PK event_id = one per event).
  insert into public.foundry_event_audience_snapshot (
    event_id, organization_id, audience_type, audience_detail,
    resolver_version, resolved_count, resolved_by, resolved_by_snapshot
  ) values (
    p_event_id, v_org, p_audience_type, p_audience_detail,
    '3.1B-3C', v_count, p_actor_user_id, p_actor_user_id
  );

  -- Record the participation mode LAST (PK event_id).
  insert into public.foundry_event_participation_mode (event_id, mode, set_by)
  values (p_event_id, 'assigned_overlay', p_actor_user_id);

  assignment_count := v_count;
  organization_id := v_org;
  return next;
end;
$$;

revoke execute on function public.bty_foundry_publish_assignments(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_publish_assignments(uuid, uuid, text, text)
  to service_role;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_foundry_publish_assignments(uuid, uuid, text, text);
--   drop function if exists public.bty_foundry_resolve_audience(uuid, text, text);
--   drop function if exists public.bty_foundry_eligible_memberships(uuid, text, text);
-- The 3.1B-3B tables and all existing Foundry behavior are UNCHANGED.
-- ============================================================================
