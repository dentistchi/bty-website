-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.1B-3N-5C — Action Review Decisions V1 (Approve / Request revision)
-- + Option 2 surgical per-function idempotency hardening (Level, AIR).
-- ============================================================================
-- WHY: Phase 5B shipped a READ-ONLY Host Action Review queue + detail. This slice
-- adds the two reviewer decisions (approve | request_revision) as ONE canonical
-- SECURITY DEFINER command, and makes the verified-completion side-effect chain
-- (Run complete_verified + Level + XP + AIR) idempotent per run/contract so a
-- Host-Approve verification cannot double-reward against a racing QR verification.
--
-- CANONICAL INVARIANT (extended, Commander 5C): only canonical verification commands
-- may set verified_at. Allowed: (1) existing QR verify, (2) freshly-authorized Host
-- Action Review approval of a hybrid/link contract. NO other path sets verified_at.
--
-- SCOPE: Approve is allowed ONLY for measured reviewable modes (hybrid | link).
-- Request revision -> canonical 'rejected' ("Needs revision"); NO run/XP/AIR/Level.
--
-- SECURITY MODEL (mirrors 20260730000000): ALL decision mutations flow through the
-- SECURITY DEFINER RPC (runs as object owner). Decision audit is APPEND-ONLY at the
-- DB layer (UPDATE/DELETE rejected). service_role gets SELECT-only on the audit table
-- + EXECUTE on the two RPCs; no direct decision writes.
--
-- IDEMPOTENCY (Option 2):
--   * Level: atomic sentinel (arena_events RUN_LEVEL_VERIFIED_APPLIED, partial unique
--     (user_id, run_id)) + streak increment inside ONE RPC transaction. Second call =>
--     no increment. Loses no increment on crash (sentinel + increment are atomic).
--   * AIR: verifier-method-INDEPENDENT canonical identity. New event_kind discriminator
--     + partial unique (contract_id) WHERE event_kind='ACTION_CONTRACT_VERIFIED'. QR and
--     Host Approve collapse to ONE AIR verification row per contract; method = metadata.
--
-- ATOMICITY: whole migration in ONE transaction (begin;...commit;). Partial apply
-- impossible. ADDITIVE + IDEMPOTENT: only NEW columns/indexes/objects; the two partial
-- unique indexes target NEW discriminator values so NO existing row can violate them,
-- and NO existing verification flow is blocked.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PART A1 — Level effect idempotency: atomic per-run sentinel + increment RPC.
-- ---------------------------------------------------------------------------
-- Sentinel backing: partial unique index on the existing arena_events stream.
-- RUN_LEVEL_VERIFIED_APPLIED is a NEW event_type (sibling to RUN_COMPLETED_APPLIED)
-- so no existing row is covered => index creation cannot fail on duplicates.
create unique index if not exists arena_events_run_level_verified_uq
  on public.arena_events (user_id, run_id)
  where (event_type = 'RUN_LEVEL_VERIFIED_APPLIED');

-- Atomic level effect. Sentinel claim + streak increment + band evaluation run in
-- ONE function transaction. Replaces the former non-transactional TS increment.
-- ENGINE §5: threshold 3 consecutive complete_verified runs -> band up; 72h cooldown.
create or replace function public.bty_apply_run_level_verified(
  p_user_id uuid,
  p_run_id text
)
returns table (
  applied boolean,
  band_changed boolean,
  new_consecutive integer,
  resolved_band text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inserted integer := 0;
  v_consecutive integer;
  v_band text;
  v_cooldown_until timestamptz;
  v_in_cooldown boolean;
  v_next integer;
  v_next_band text;
  v_threshold constant integer := 3;
begin
  if p_user_id is null then
    raise exception 'run_level_user_missing' using errcode = 'P0001';
  end if;
  if p_run_id is null or btrim(p_run_id) = '' then
    raise exception 'run_level_run_missing' using errcode = 'P0001';
  end if;

  -- 1. Atomic sentinel claim. row_count = 0 means already applied for this run.
  insert into public.arena_events (user_id, run_id, event_type, step, scenario_id, xp)
  values (p_user_id, p_run_id, 'RUN_LEVEL_VERIFIED_APPLIED', 7, 'level_effect', 0)
  on conflict (user_id, run_id) where (event_type = 'RUN_LEVEL_VERIFIED_APPLIED')
  do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select coalesce(r.consecutive_verified_completions, 0),
           coalesce(r.current_band, 'mid')
      into v_consecutive, v_band
      from public.arena_level_records r
     where r.user_id = p_user_id;
    applied := false;
    band_changed := false;
    new_consecutive := coalesce(v_consecutive, 0);
    resolved_band := coalesce(v_band, 'mid');
    return next;
    return;
  end if;

  -- 2. Ensure level record exists (any unique conflict is benign).
  insert into public.arena_level_records (user_id, updated_at)
  values (p_user_id, now())
  on conflict do nothing;

  -- 3. Read + lock the level row so concurrent different-run increments serialize.
  select coalesce(r.consecutive_verified_completions, 0),
         coalesce(r.current_band, 'mid'),
         r.cooldown_until
    into v_consecutive, v_band, v_cooldown_until
    from public.arena_level_records r
   where r.user_id = p_user_id
   for update;

  v_in_cooldown := v_cooldown_until is not null and now() < v_cooldown_until;

  -- During cooldown: no increment / no evaluation (ENGINE §5 rule 8), just touch.
  if v_in_cooldown then
    update public.arena_level_records r
       set last_evaluation_at = now(),
           updated_at = now()
     where r.user_id = p_user_id;
    applied := true;
    band_changed := false;
    new_consecutive := v_consecutive;
    resolved_band := v_band;
    return next;
    return;
  end if;

  v_next := least(32767, greatest(0, v_consecutive) + 1);

  if v_next >= v_threshold then
    v_next_band := case v_band
      when 'easy' then 'mid'
      when 'mid' then 'hard'
      when 'hard' then 'extreme'
      when 'extreme' then 'extreme'
      else 'mid'
    end;
    update public.arena_level_records r
       set consecutive_verified_completions = 0,
           current_band = v_next_band,
           last_band_change_at = now(),
           cooldown_until = now() + interval '72 hours',
           last_evaluation_at = now(),
           updated_at = now()
     where r.user_id = p_user_id;
    applied := true;
    band_changed := true;
    new_consecutive := 0;
    resolved_band := v_next_band;
    return next;
    return;
  end if;

  update public.arena_level_records r
     set consecutive_verified_completions = v_next,
         last_evaluation_at = now(),
         updated_at = now()
   where r.user_id = p_user_id;
  applied := true;
  band_changed := false;
  new_consecutive := v_next;
  resolved_band := v_band;
  return next;
end;
$$;

revoke execute on function public.bty_apply_run_level_verified(uuid, text)
  from public, anon, authenticated;
grant execute on function public.bty_apply_run_level_verified(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- PART A2 — AIR effect idempotency: method-INDEPENDENT canonical identity.
-- ---------------------------------------------------------------------------
-- event_kind discriminator (nullable). Only the action-contract verification insert
-- sets 'ACTION_CONTRACT_VERIFIED'; re-exposure/other rows stay NULL. QR + Host Approve
-- are DIFFERENT methods for the SAME canonical effect and must collapse to one row.
alter table public.le_verification_log
  add column if not exists event_kind text;

-- One final AIR verification evidence row per contract, regardless of verify method.
-- Predicate targets a NEW discriminator value => no existing row is covered.
create unique index if not exists le_verification_log_contract_verified_uq
  on public.le_verification_log (contract_id)
  where (event_kind = 'ACTION_CONTRACT_VERIFIED' and contract_id is not null);

-- ---------------------------------------------------------------------------
-- PART B1 — Current-review-cycle projection fields on the learner-facing contract.
--           Reviewer identity is NOT stored here (audit-only). Smallest durable set.
-- ---------------------------------------------------------------------------
alter table public.bty_action_contracts
  add column if not exists revision_note text;
alter table public.bty_action_contracts
  add column if not exists reviewed_at timestamptz;

-- revision_note: NULL, or trimmed meaningful text <= 500 chars. Existing rows are NULL.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bty_action_contracts_revision_note_check'
      and conrelid = 'public.bty_action_contracts'::regclass
  ) then
    alter table public.bty_action_contracts
      add constraint bty_action_contracts_revision_note_check
      check (
        revision_note is null
        or (btrim(revision_note) <> '' and char_length(revision_note) <= 500)
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- PART B2 — Append-only decision audit (immutable snapshot of every decision).
--           Reviewer/learner identity + membership + org + prev/new status + note.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_action_review_decision_audit (
  id uuid primary key default gen_random_uuid(),
  action_contract_id uuid not null,
  reviewer_user_id_snapshot uuid not null,
  reviewer_membership_id_snapshot uuid not null,
  learner_user_id_snapshot uuid not null,
  learner_membership_id_snapshot uuid not null,
  organization_id_snapshot uuid not null,
  decision text not null,
  previous_status text not null,
  resulting_status text not null,
  revision_note text null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint bty_action_review_decision_audit_decision_check
    check (decision in ('approve', 'request_revision')),
  constraint bty_action_review_decision_audit_note_check
    check (
      revision_note is null
      or (btrim(revision_note) <> '' and char_length(revision_note) <= 500)
    )
);

create index if not exists bty_action_review_decision_audit_contract_idx
  on public.bty_action_review_decision_audit (action_contract_id, decided_at desc);
create index if not exists bty_action_review_decision_audit_reviewer_idx
  on public.bty_action_review_decision_audit (reviewer_membership_id_snapshot, decided_at desc);

revoke all on public.bty_action_review_decision_audit from anon, public, authenticated;
alter table public.bty_action_review_decision_audit enable row level security;

-- Append-only: reject UPDATE/DELETE (statement-level; fires even on empty match).
create or replace function public.bty_action_review_decision_audit_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'action_review_decision_audit_immutable' using errcode = 'P0001';
end;
$$;

revoke execute on function public.bty_action_review_decision_audit_immutable()
  from public, anon, authenticated;

create or replace trigger bty_action_review_decision_audit_immutable_trg
  before update or delete on public.bty_action_review_decision_audit
  for each statement execute function public.bty_action_review_decision_audit_immutable();

-- service_role: SELECT-only. All inserts flow through the SECURITY DEFINER RPC.
revoke all on public.bty_action_review_decision_audit from service_role;
grant select on public.bty_action_review_decision_audit to service_role;

-- ---------------------------------------------------------------------------
-- PART B3 — Canonical review-decision RPC. Atomic authority-recheck + CAS + audit.
--   Reviewer + learner memberships are DERIVED from DB truth (contract owner +
--   actor's active ACTION_REVIEWER edge). NO client-supplied membership/org ids.
--   The app route STILL calls resolveActionReviewAuthority immediately before this
--   (defense in depth). Approve side effects (Run/Level/XP/AIR) run in the app layer
--   ONLY when transition_applied = true (Commander Refinement C side-effect gate).
-- ---------------------------------------------------------------------------
create or replace function public.bty_resolve_action_review(
  p_action_contract_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_revision_note text
)
returns table (
  transition_applied boolean,
  stale_reason text,
  decision text,
  previous_status text,
  resulting_status text,
  reviewed_at timestamptz,
  revision_note text,
  decision_audit_id uuid,
  learner_user_id uuid,
  verification_mode text,
  contract_run_id uuid,
  contract_session_id text,
  arena_scenario_id text,
  le_activation_type text,
  weight numeric,
  chosen_at timestamptz,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_contract record;
  v_learner_user uuid;
  v_edge record;
  v_edge_count integer := 0;
  v_note text;
  v_now timestamptz := now();
  v_prev text;
  v_new text;
  v_audit_id uuid;
  v_updated integer := 0;
begin
  -- ===== input validation =====
  if p_actor_user_id is null then
    raise exception 'action_review_actor_missing' using errcode = 'P0001';
  end if;
  if p_action_contract_id is null then
    raise exception 'action_review_contract_missing' using errcode = 'P0002';
  end if;
  if p_decision is null or p_decision not in ('approve', 'request_revision') then
    raise exception 'action_review_invalid_decision' using errcode = 'P0001';
  end if;

  -- revision note: required + trimmed + 1..500 for request_revision; NULL for approve.
  if p_decision = 'request_revision' then
    v_note := btrim(coalesce(p_revision_note, ''));
    if char_length(v_note) < 1 then
      raise exception 'action_review_note_required' using errcode = 'P0001';
    end if;
    if char_length(v_note) > 500 then
      raise exception 'action_review_note_too_long' using errcode = 'P0001';
    end if;
  else
    v_note := null;
  end if;

  -- 1. Lock the contract row.
  select c.id, c.user_id, c.status, c.verified_at, c.verification_mode,
         c.run_id, c.session_id, c.arena_scenario_id, c.le_activation_type,
         c.weight, c.chosen_at, c.deadline_at
    into v_contract
    from public.bty_action_contracts c
   where c.id = p_action_contract_id
   for update;

  -- 3. Confirm the action still exists.
  if not found then
    transition_applied := false;
    stale_reason := 'not_found';
    decision := p_decision;
    previous_status := null;
    resulting_status := null;
    return next;
    return;
  end if;

  v_learner_user := v_contract.user_id;

  -- 5. Self-review forbidden at the user level (belt with the edge non-self rule).
  if v_learner_user = p_actor_user_id then
    raise exception 'action_review_self_forbidden' using errcode = 'P0001';
  end if;

  -- 4 + 5. Revalidate a single effective one-hop ACTION_REVIEWER edge from DB truth:
  --   reviewer_membership belongs to actor (active), learner_membership belongs to the
  --   contract owner (active), same org, non-self, active + not revoked + started.
  select count(*)
    into v_edge_count
    from public.bty_org_action_review_authority e
    join public.bty_org_memberships rm on rm.id = e.reviewer_membership_id
    join public.bty_org_memberships lm on lm.id = e.learner_membership_id
   where e.authority_key = 'ACTION_REVIEWER'
     and e.status = 'active'
     and e.revoked_at is null
     and e.started_on <= current_date
     and rm.user_id = p_actor_user_id
     and rm.status = 'active'
     and lm.user_id = v_learner_user
     and lm.status = 'active'
     and rm.organization_id = lm.organization_id
     and e.organization_id = rm.organization_id
     and rm.user_id <> lm.user_id;

  if v_edge_count = 0 then
    transition_applied := false;
    stale_reason := 'unauthorized';
    decision := p_decision;
    previous_status := v_contract.status;
    resulting_status := null;
    return next;
    return;
  end if;
  -- Fail closed on ambiguity (never "any match").
  if v_edge_count > 1 then
    transition_applied := false;
    stale_reason := 'ambiguous_authority';
    decision := p_decision;
    previous_status := v_contract.status;
    resulting_status := null;
    return next;
    return;
  end if;

  select e.id, e.organization_id, e.reviewer_membership_id, e.learner_membership_id
    into v_edge
    from public.bty_org_action_review_authority e
    join public.bty_org_memberships rm on rm.id = e.reviewer_membership_id
    join public.bty_org_memberships lm on lm.id = e.learner_membership_id
   where e.authority_key = 'ACTION_REVIEWER'
     and e.status = 'active'
     and e.revoked_at is null
     and e.started_on <= current_date
     and rm.user_id = p_actor_user_id
     and rm.status = 'active'
     and lm.user_id = v_learner_user
     and lm.status = 'active'
     and rm.organization_id = lm.organization_id
     and e.organization_id = rm.organization_id
     and rm.user_id <> lm.user_id;

  -- 6 + 7 + 8. Compare-and-set: transition ONLY from the canonical reviewable state.
  v_prev := v_contract.status;
  if p_decision = 'approve' then
    update public.bty_action_contracts c
       set status = 'approved',
           verified_at = v_now,
           completed_at = v_now,
           reviewed_at = v_now,
           revision_note = null
     where c.id = p_action_contract_id
       and c.status = 'submitted'
       and c.verified_at is null
       and c.verification_mode in ('hybrid', 'link');
    get diagnostics v_updated = row_count;
    v_new := 'approved';
  else
    update public.bty_action_contracts c
       set status = 'rejected',
           reviewed_at = v_now,
           revision_note = v_note
     where c.id = p_action_contract_id
       and c.status = 'submitted'
       and c.verified_at is null
       and c.verification_mode in ('hybrid', 'link');
    get diagnostics v_updated = row_count;
    v_new := 'rejected';
  end if;

  -- Zero-row CAS => stale / already resolved. No audit, no side effects.
  if v_updated = 0 then
    transition_applied := false;
    stale_reason := 'already_resolved';
    decision := p_decision;
    previous_status := v_prev;
    resulting_status := v_contract.status;
    return next;
    return;
  end if;

  -- 9. Exactly one immutable decision-audit row per applied transition.
  insert into public.bty_action_review_decision_audit (
    action_contract_id,
    reviewer_user_id_snapshot, reviewer_membership_id_snapshot,
    learner_user_id_snapshot, learner_membership_id_snapshot,
    organization_id_snapshot, decision, previous_status, resulting_status,
    revision_note, decided_at
  ) values (
    p_action_contract_id,
    p_actor_user_id, v_edge.reviewer_membership_id,
    v_learner_user, v_edge.learner_membership_id,
    v_edge.organization_id, p_decision, v_prev, v_new,
    v_note, v_now
  )
  returning id into v_audit_id;

  -- 10 + 11. Fresh canonical snapshot for the app layer (approve side-effect chain).
  transition_applied := true;
  stale_reason := null;
  decision := p_decision;
  previous_status := v_prev;
  resulting_status := v_new;
  reviewed_at := v_now;
  revision_note := v_note;
  decision_audit_id := v_audit_id;
  learner_user_id := v_learner_user;
  verification_mode := v_contract.verification_mode;
  contract_run_id := v_contract.run_id;
  contract_session_id := v_contract.session_id;
  arena_scenario_id := v_contract.arena_scenario_id;
  le_activation_type := v_contract.le_activation_type;
  weight := v_contract.weight;
  chosen_at := v_contract.chosen_at;
  deadline_at := v_contract.deadline_at;
  return next;
end;
$$;

revoke execute on function public.bty_resolve_action_review(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bty_resolve_action_review(uuid, uuid, text, text)
  to service_role;

commit;

-- ============================================================================
-- ROLLBACK (manual; run OUTSIDE the migration transaction; PARTIAL-STATE-SAFE):
--   drop function if exists public.bty_resolve_action_review(uuid, uuid, text, text);
--   do $rb$ begin
--     if to_regclass('public.bty_action_review_decision_audit') is not null then
--       drop trigger if exists bty_action_review_decision_audit_immutable_trg
--         on public.bty_action_review_decision_audit;
--     end if;
--   end $rb$;
--   drop function if exists public.bty_action_review_decision_audit_immutable();
--   drop table if exists public.bty_action_review_decision_audit;
--   alter table public.bty_action_contracts drop constraint if exists bty_action_contracts_revision_note_check;
--   -- (revision_note / reviewed_at columns may be left in place; harmless if kept)
--   drop index if exists public.le_verification_log_contract_verified_uq;
--   -- (le_verification_log.event_kind column may be left in place; harmless if kept)
--   drop function if exists public.bty_apply_run_level_verified(uuid, text);
--   drop index if exists public.arena_events_run_level_verified_uq;
-- Arena XP/leaderboard/season storage, Foundry, responsibilities, and every other
-- system are UNCHANGED by this migration.
-- ============================================================================
