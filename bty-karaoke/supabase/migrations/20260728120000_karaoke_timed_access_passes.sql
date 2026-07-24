-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — TIMED ACCESS PASS FOUNDATION V1 (BUILD 17). Lets a Manager ISSUE a
-- fixed-duration access pass (1h / 4h / 24h) to a canonical Host account, lets the Host
-- SELECT one, and ACTIVATES it exactly once — only when the server's first-song
-- lifecycle transition (karaoke_begin_song) actually commits. Isolated bty-karaoke
-- Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent; never rewrites or
-- regresses a prior migration.
--
-- Product decisions encoded here (see BUILD 17 spec):
--   * A pass belongs to the CANONICAL Host account (karaoke_accounts), never a Room,
--     Event, device, or provider identity.
--   * Fixed durations only: ONE_HOUR=3600, FOUR_HOURS=14400, TWENTY_FOUR_HOURS=86400.
--     No price, SKU, product id, checkout, or subscription exists anywhere.
--   * Lifecycle: AVAILABLE -> SELECTED -> ACTIVE -> EXPIRED, plus REVOKED (only from
--     AVAILABLE/SELECTED). At most ONE SELECTED and at most ONE ACTIVE per account
--     (two partial unique indexes — declarative DB rules, not app checks).
--   * SELECTION alone never starts the clock: SELECTED has no activated_at/expires_at.
--     Activation happens ONLY inside the existing atomic karaoke_begin_song transaction,
--     the instant a real waiting->playing transition commits. The SELECTED pass is the
--     first-start ACTIVATION CANDIDATE: it is allowed to permit the first start even at
--     FREE 0:00, rather than FREE enforcement blocking the start before the pass.
--   * activated_at = server clock at that commit; expires_at = activated_at + duration.
--     No extra start, relaunch, or event ever extends expires_at.
--   * FREE metering is PAUSED for the life of an ACTIVE pass WITHOUT any plan mutation:
--     segments opened while a pass covers the account are written non-metered
--     (metering_paused_by_pass=true), and the daily used-seconds sum already counts only
--     metered segments — so the FREE meter simply stops advancing and resumes, with its
--     prior remaining preserved, when the pass expires. karaoke_host_plan_assignments is
--     never touched by this migration.
--   * PRO base accounts never consume a pass (they are already unlimited): the begin
--     transaction leaves any SELECTED pass untouched for a PRO owner.
--   * Every mutation is server/service_role only, idempotency-keyed, and appends an
--     immutable audit row. Activation writes exactly ONE 'ACTIVATED' audit per pass.
--
-- Billing is explicitly out of scope: no price, checkout, subscription, StoreKit,
-- Stripe, Apple/Google Pay, promo code, refund, transfer, or gift.
--
-- Depends on: 20260722120000 (plan assignments), 20260726120000 (shadow metering:
-- karaoke_event_usage_segments, karaoke_begin_song, karaoke_free_minutes_entitlement_at,
-- karaoke_room_owner_account).
--
-- Rollback:
--   -- restore the pre-BUILD-17 begin function from 20260726120000, then:
--   alter table public.karaoke_event_usage_segments
--     drop constraint if exists usage_seg_metered_matches_plan;
--   alter table public.karaoke_event_usage_segments
--     add constraint usage_seg_metered_matches_plan check (metered = (plan_snapshot = 'FREE'));
--   alter table public.karaoke_event_usage_segments drop column if exists metering_paused_by_pass;
--   alter table public.karaoke_event_usage_segments drop column if exists pass_grant_id;
--   drop function if exists public.karaoke_timed_pass_state_at(uuid, timestamptz);
--   drop function if exists public.karaoke_timed_pass_state(uuid);
--   drop function if exists public.revoke_timed_access_pass(uuid, text, text, text);
--   drop function if exists public.select_timed_access_pass(uuid, uuid, text);
--   drop function if exists public.issue_timed_access_pass(uuid, text, text, text, text);
--   drop trigger if exists timed_access_pass_audit_no_mutate on public.timed_access_pass_audit;
--   drop function if exists public.timed_access_pass_audit_immutable();
--   drop table if exists public.timed_access_pass_audit;
--   drop table if exists public.timed_access_pass_grants;

-- 1. PASS GRANT ENTITY --------------------------------------------------------
create table if not exists public.timed_access_pass_grants (
  id                    uuid primary key default gen_random_uuid(),
  -- The canonical Host account the pass belongs to. CASCADE: a pass for a nonexistent
  -- account is meaningless; no Room/Event/queue ever cascades from here.
  account_id            uuid not null references public.karaoke_accounts(id) on delete cascade,
  pass_type             text not null check (pass_type in ('ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS')),
  -- Fixed at issue and immutable thereafter (no RPC ever updates it). The check ties the
  -- seconds to the type so the two can never drift.
  duration_seconds      int  not null,
  status                text not null default 'AVAILABLE'
                          check (status in ('AVAILABLE', 'SELECTED', 'ACTIVE', 'EXPIRED', 'REVOKED')),
  -- Opaque operator reference (e.g. 'bty_mgr'); the Manager is a shared-passcode
  -- operator, not a Host account, so this is text, never a personal identity.
  issued_by_manager     text,
  issue_reason          text,
  -- Replay guard for POST issue: a retried issue with the same key returns the same
  -- grant rather than inserting a second row.
  issue_idempotency_key text not null,
  selected_at           timestamptz,
  activated_at          timestamptz,
  expires_at            timestamptz,
  expired_at            timestamptz,
  revoked_at            timestamptz,
  revoked_by_manager    text,
  revoke_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Duration must match the fixed type.
  constraint timed_pass_duration_matches_type check (
    (pass_type = 'ONE_HOUR'         and duration_seconds = 3600)
    or (pass_type = 'FOUR_HOURS'       and duration_seconds = 14400)
    or (pass_type = 'TWENTY_FOUR_HOURS' and duration_seconds = 86400)
  ),
  -- Per-status time invariants — the timeline is always honest:
  --   AVAILABLE: nothing set (a reverted-from-SELECTED pass clears selected_at too);
  --   SELECTED : selected_at set, no activation/expiry/revocation;
  --   ACTIVE   : activated_at + expires_at set, expires_at = activated_at + duration;
  --   EXPIRED  : was ACTIVE, so activated_at + expires_at + expired_at set;
  --   REVOKED  : revoked from AVAILABLE/SELECTED only, so never activated; revoked_at set.
  constraint timed_pass_status_time_chk check (
    case status
      when 'AVAILABLE' then activated_at is null and expires_at is null and expired_at is null
                        and revoked_at is null and selected_at is null
      when 'SELECTED'  then selected_at is not null and activated_at is null and expires_at is null
                        and expired_at is null and revoked_at is null
      when 'ACTIVE'    then activated_at is not null and expires_at is not null and expired_at is null
                        and revoked_at is null
      when 'EXPIRED'   then activated_at is not null and expires_at is not null and expired_at is not null
                        and revoked_at is null
      when 'REVOKED'   then revoked_at is not null and activated_at is null and expires_at is null
                        and expired_at is null
      else false
    end
  ),
  -- expires_at is exactly activated_at + the fixed duration (no extension, ever).
  constraint timed_pass_expiry_math_chk check (
    expires_at is null or activated_at is null
    or expires_at = activated_at + make_interval(secs => duration_seconds)
  )
);

-- THE invariants (declarative, not app checks): at most one SELECTED and at most one
-- ACTIVE pass per account. Makes selection/activation race-safe under concurrency.
create unique index if not exists timed_pass_one_selected_per_account_idx
  on public.timed_access_pass_grants (account_id) where status = 'SELECTED';
create unique index if not exists timed_pass_one_active_per_account_idx
  on public.timed_access_pass_grants (account_id) where status = 'ACTIVE';

-- Replay guard for issue.
create unique index if not exists timed_pass_issue_idem_idx
  on public.timed_access_pass_grants (issue_idempotency_key);

-- Hot reads: "this account's passes, newest first" and "this account's ACTIVE-by-expiry".
create index if not exists timed_pass_account_idx
  on public.timed_access_pass_grants (account_id, created_at desc);
create index if not exists timed_pass_active_expiry_idx
  on public.timed_access_pass_grants (account_id, expires_at) where status = 'ACTIVE';

alter table public.timed_access_pass_grants enable row level security;
revoke all on table public.timed_access_pass_grants from public, anon, authenticated;
grant select, insert, update on table public.timed_access_pass_grants to service_role;

-- 2. APPEND-ONLY PASS AUDIT ---------------------------------------------------
create table if not exists public.timed_access_pass_audit (
  id              uuid primary key default gen_random_uuid(),
  pass_grant_id   uuid not null references public.timed_access_pass_grants(id) on delete cascade,
  account_id      uuid not null references public.karaoke_accounts(id) on delete cascade,
  -- Who acted: a Manager operator, the Host, or the SYSTEM (activation/expiry happen in
  -- the server lifecycle transaction, attributable to no person).
  actor_type      text not null check (actor_type in ('MANAGER', 'HOST', 'SYSTEM')),
  actor_ref       text,
  action          text not null
                    check (action in ('ISSUED', 'SELECTED', 'DESELECTED', 'ACTIVATED', 'EXPIRED', 'REVOKED')),
  from_status     text check (from_status is null or from_status in ('AVAILABLE','SELECTED','ACTIVE','EXPIRED','REVOKED')),
  to_status       text check (to_status is null or to_status in ('AVAILABLE','SELECTED','ACTIVE','EXPIRED','REVOKED')),
  -- Durable operation id for the operations that carry one (issue/select/revoke).
  idempotency_key text,
  reason          text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

-- Exactly one ACTIVATED audit row per pass — the "activation audit is exactly 1"
-- invariant enforced at the DB, not by convention.
create unique index if not exists timed_pass_audit_one_activation_idx
  on public.timed_access_pass_audit (pass_grant_id) where action = 'ACTIVATED';
create index if not exists timed_pass_audit_grant_idx
  on public.timed_access_pass_audit (pass_grant_id, created_at desc);
create index if not exists timed_pass_audit_account_idx
  on public.timed_access_pass_audit (account_id, created_at desc);

alter table public.timed_access_pass_audit enable row level security;
revoke all on table public.timed_access_pass_audit from public, anon, authenticated;
grant select, insert on table public.timed_access_pass_audit to service_role;

create or replace function public.timed_access_pass_audit_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'timed_access_pass_audit is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function public.timed_access_pass_audit_immutable() from public, anon, authenticated;
drop trigger if exists timed_access_pass_audit_no_mutate on public.timed_access_pass_audit;
create trigger timed_access_pass_audit_no_mutate
  before update or delete on public.timed_access_pass_audit
  for each row execute function public.timed_access_pass_audit_immutable();

-- 3. SEGMENT COLUMNS FOR FREE-METER PAUSE -------------------------------------
-- Additive: a segment opened while a pass covers the account is written NON-metered and
-- tagged with the covering pass. metering_paused_by_pass is the single source of the
-- non-metered decision so the CHECK never depends on the FK staying non-null (a pass row
-- is never deleted, but defense in depth). Existing rows keep pass_grant_id NULL and
-- metering_paused_by_pass=false, so their metered value is byte-identical to before.
alter table public.karaoke_event_usage_segments
  add column if not exists pass_grant_id uuid references public.timed_access_pass_grants(id) on delete set null;
alter table public.karaoke_event_usage_segments
  add column if not exists metering_paused_by_pass boolean not null default false;

-- Relax the metered<->plan CHECK to also exclude pass-covered segments. For every
-- existing row (metering_paused_by_pass=false) this is exactly the old rule; it only
-- adds the pass-covered exception. Guarded so re-running the migration is a no-op.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'usage_seg_metered_matches_plan'
       and conrelid = 'public.karaoke_event_usage_segments'::regclass
  ) then
    alter table public.karaoke_event_usage_segments drop constraint usage_seg_metered_matches_plan;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'usage_seg_metered_matches_plan_v2'
       and conrelid = 'public.karaoke_event_usage_segments'::regclass
  ) then
    alter table public.karaoke_event_usage_segments
      add constraint usage_seg_metered_matches_plan_v2
      check (metered = (plan_snapshot = 'FREE' and metering_paused_by_pass = false));
  end if;
end;
$$;

create index if not exists usage_seg_pass_grant_idx
  on public.karaoke_event_usage_segments (pass_grant_id) where pass_grant_id is not null;

-- 4. ISSUE RPC (Manager) ------------------------------------------------------
-- Race-safe issuance. service_role only. Rejects a PRO base account (they cannot consume
-- a pass); returns the same grant for a replayed idempotency key. Never touches the plan.
create or replace function public.issue_timed_access_pass(
  p_account_id      uuid,
  p_pass_type       text,
  p_reason          text,
  p_idempotency_key text,
  p_manager_actor   text default 'bty_mgr'
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_key      text := btrim(coalesce(p_idempotency_key, ''));
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_dur      int;
  v_plan     text; v_plan_n int;
  v_existing public.timed_access_pass_grants%rowtype;
  v_new_id   uuid;
begin
  if p_pass_type not in ('ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS') then
    return jsonb_build_object('ok', false, 'error', 'invalid_pass_type');
  end if;
  if v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'idempotency_key_required');
  end if;
  v_dur := case p_pass_type when 'ONE_HOUR' then 3600 when 'FOUR_HOURS' then 14400 else 86400 end;

  perform pg_advisory_xact_lock(hashtext('timed_pass:' || p_account_id::text));

  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  -- Replay: the same issue key returns its grant unchanged.
  select * into v_existing
    from public.timed_access_pass_grants where issue_idempotency_key = v_key limit 1;
  if found then
    return jsonb_build_object('ok', true, 'passGrantId', v_existing.id,
      'passType', v_existing.pass_type, 'status', v_existing.status, 'reused', true);
  end if;

  -- A PRO base account cannot consume a pass — block issuance (never a silent no-op).
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id = p_account_id and status = 'active';
  if v_plan_n = 1 and v_plan = 'PRO' then
    return jsonb_build_object('ok', false, 'error', 'account_is_pro');
  end if;

  insert into public.timed_access_pass_grants
    (account_id, pass_type, duration_seconds, issued_by_manager, issue_reason, issue_idempotency_key)
  values (p_account_id, p_pass_type, v_dur, p_manager_actor, v_reason, v_key)
  returning id into v_new_id;

  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status, idempotency_key, reason)
  values (v_new_id, p_account_id, 'MANAGER', p_manager_actor, 'ISSUED', null, 'AVAILABLE', v_key, v_reason);

  return jsonb_build_object('ok', true, 'passGrantId', v_new_id,
    'passType', p_pass_type, 'status', 'AVAILABLE', 'reused', false);
end;
$$;
revoke all on function public.issue_timed_access_pass(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.issue_timed_access_pass(uuid, text, text, text, text) to service_role;

-- 5. SELECT RPC (Host) --------------------------------------------------------
-- Host selects an AVAILABLE pass. Any currently SELECTED pass reverts to AVAILABLE first
-- (at most one SELECTED). Re-selecting the already-SELECTED pass is an idempotent no-op.
-- REVOKED/EXPIRED/ACTIVE passes cannot be selected. Selection NEVER sets activated_at.
create or replace function public.select_timed_access_pass(
  p_account_id   uuid,
  p_pass_grant_id uuid,
  p_idempotency_key text default null
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_key    text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_grant  public.timed_access_pass_grants%rowtype;
  v_prev   public.timed_access_pass_grants%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || p_account_id::text));

  select * into v_grant
    from public.timed_access_pass_grants
   where id = p_pass_grant_id and account_id = p_account_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pass_not_found');
  end if;

  if v_grant.status = 'SELECTED' then
    -- Idempotent: already the selected pass.
    return jsonb_build_object('ok', true, 'passGrantId', v_grant.id, 'status', 'SELECTED', 'changed', false);
  end if;
  if v_grant.status <> 'AVAILABLE' then
    return jsonb_build_object('ok', false, 'error', 'not_selectable', 'status', v_grant.status);
  end if;

  -- Revert any other SELECTED pass for this account back to AVAILABLE (clears selected_at).
  for v_prev in
    select * from public.timed_access_pass_grants
     where account_id = p_account_id and status = 'SELECTED' and id <> p_pass_grant_id for update
  loop
    update public.timed_access_pass_grants
       set status = 'AVAILABLE', selected_at = null, updated_at = now() where id = v_prev.id;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status, idempotency_key)
    values (v_prev.id, p_account_id, 'HOST', 'DESELECTED', 'SELECTED', 'AVAILABLE', v_key);
  end loop;

  update public.timed_access_pass_grants
     set status = 'SELECTED', selected_at = now(), updated_at = now() where id = p_pass_grant_id;
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, action, from_status, to_status, idempotency_key)
  values (p_pass_grant_id, p_account_id, 'HOST', 'SELECTED', 'AVAILABLE', 'SELECTED', v_key);

  return jsonb_build_object('ok', true, 'passGrantId', p_pass_grant_id, 'status', 'SELECTED', 'changed', true);
end;
$$;
revoke all on function public.select_timed_access_pass(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.select_timed_access_pass(uuid, uuid, text) to service_role;

-- 6. REVOKE RPC (Manager) -----------------------------------------------------
-- Manager revokes an UNUSED pass. Only AVAILABLE/SELECTED are revocable (V1 does not
-- force-revoke an ACTIVE pass). Replay-safe: a re-revoke of an already-REVOKED pass with
-- the same key returns its recorded outcome.
create or replace function public.revoke_timed_access_pass(
  p_pass_grant_id uuid,
  p_reason        text,
  p_idempotency_key text,
  p_manager_actor text default 'bty_mgr'
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_key    text := btrim(coalesce(p_idempotency_key, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_grant  public.timed_access_pass_grants%rowtype;
  v_dupe   int;
begin
  if v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'idempotency_key_required');
  end if;

  select * into v_grant from public.timed_access_pass_grants where id = p_pass_grant_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pass_not_found');
  end if;

  perform pg_advisory_xact_lock(hashtext('timed_pass:' || v_grant.account_id::text));

  -- Durable replay: same revoke key already recorded -> return its outcome, write nothing.
  select count(*) into v_dupe from public.timed_access_pass_audit
   where action = 'REVOKED' and idempotency_key = v_key;
  if v_dupe > 0 then
    return jsonb_build_object('ok', true, 'passGrantId', p_pass_grant_id, 'status', 'REVOKED', 'replayed', true);
  end if;

  select * into v_grant from public.timed_access_pass_grants where id = p_pass_grant_id for update;
  if v_grant.status not in ('AVAILABLE', 'SELECTED') then
    return jsonb_build_object('ok', false, 'error', 'not_revocable', 'status', v_grant.status);
  end if;

  update public.timed_access_pass_grants
     set status = 'REVOKED', selected_at = null, revoked_at = now(),
         revoked_by_manager = p_manager_actor, revoke_reason = v_reason, updated_at = now()
   where id = p_pass_grant_id;
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status, idempotency_key, reason)
  values (p_pass_grant_id, v_grant.account_id, 'MANAGER', p_manager_actor, 'REVOKED',
          v_grant.status, 'REVOKED', v_key, v_reason);

  return jsonb_build_object('ok', true, 'passGrantId', p_pass_grant_id, 'status', 'REVOKED', 'replayed', false);
end;
$$;
revoke all on function public.revoke_timed_access_pass(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.revoke_timed_access_pass(uuid, text, text, text) to service_role;

-- 7. PASS STATE / EFFECTIVE ENTITLEMENT READ (server authority) ---------------
-- Read-only projection at a server timestamp. Computes the effective entitlement
-- (PRO -> TIMED_ACCESS -> FREE) and the active pass's server-truth remaining seconds.
-- STABLE: it treats an ACTIVE-past-expiry pass as effectively EXPIRED (server-time truth,
-- no cron) but WRITES NOTHING — the mutation RPCs and karaoke_begin_song flip the row.
create or replace function public.karaoke_timed_pass_state_at(p_account_id uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_plan text; v_plan_n int; v_base text;
  v_active record; v_selected record;
  v_effective text; v_remaining int;
begin
  if p_as_of is null then return jsonb_build_object('outcome', 'invalid_as_of'); end if;
  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('outcome', 'account_not_found');
  end if;

  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id = p_account_id and status = 'active';
  v_base := case when v_plan_n = 1 and v_plan in ('FREE', 'PRO') then v_plan else 'FREE' end;

  -- The one ACTIVE pass that is still within its window at p_as_of (expiry is server-time).
  select id, pass_type, duration_seconds, activated_at, expires_at
    into v_active
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'ACTIVE' and expires_at > p_as_of
   order by expires_at desc limit 1;

  -- The one SELECTED pass (never grants entitlement on its own — activation candidate only).
  select id, pass_type, duration_seconds, selected_at
    into v_selected
    from public.timed_access_pass_grants
   where account_id = p_account_id and status = 'SELECTED'
   order by selected_at desc limit 1;

  if v_base = 'PRO' then
    v_effective := 'PRO';
  elsif v_active.id is not null then
    v_effective := 'TIMED_ACCESS';
  else
    v_effective := 'FREE';
  end if;

  v_remaining := case when v_active.id is not null
    then greatest(0, floor(extract(epoch from (v_active.expires_at - p_as_of)))::int) else null end;

  return jsonb_build_object(
    'outcome', 'ok',
    'asOf', p_as_of,
    'basePlan', v_base,
    'effectiveEntitlement', v_effective,
    'activePass', case when v_active.id is not null then jsonb_build_object(
      'id', v_active.id, 'passType', v_active.pass_type, 'durationSeconds', v_active.duration_seconds,
      'activatedAt', v_active.activated_at, 'expiresAt', v_active.expires_at, 'remainingSeconds', v_remaining
    ) else null end,
    'selectedPass', case when v_selected.id is not null then jsonb_build_object(
      'id', v_selected.id, 'passType', v_selected.pass_type,
      'durationSeconds', v_selected.duration_seconds, 'selectedAt', v_selected.selected_at
    ) else null end
  );
end;
$$;
revoke all on function public.karaoke_timed_pass_state_at(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_timed_pass_state_at(uuid, timestamptz) to service_role;

create or replace function public.karaoke_timed_pass_state(p_account_id uuid)
returns jsonb language sql volatile set search_path = public, pg_temp as $$
  select public.karaoke_timed_pass_state_at(p_account_id, clock_timestamp());
$$;
revoke all on function public.karaoke_timed_pass_state(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_timed_pass_state(uuid) to service_role;

-- 8. PASS-AWARE karaoke_begin_song (CREATE OR REPLACE) ------------------------
-- Identical to 20260726120000 EXCEPT the BUILD 17 block: after the canonical/not-playing
-- guards and plan resolution (so a duplicate/already-playing start never touches a pass),
-- resolve pass coverage under the account lock already held. A valid ACTIVE pass COVERS
-- the start (non-metered segment, no FREE block). A SELECTED pass is the first-start
-- ACTIVATION CANDIDATE: it permits the start even at FREE 0:00 and, once the flip commits,
-- transitions SELECTED->ACTIVE (activated_at=v_now, expires_at=v_now+duration) with exactly
-- one ACTIVATED audit. PRO owners never consume a pass. Expiry is lazy on server time.
create or replace function public.karaoke_begin_song(p_room_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_status text; v_event uuid; v_ready timestamptz; v_req_room uuid;
  v_ev_room uuid; v_ev_status text; v_first uuid; v_plan text; v_plan_n int; v_enf boolean; v_tz text; v_upd int; v_ent jsonb;
  v_active_pass uuid; v_sel_pass uuid; v_sel_dur int; v_pass_grant uuid;
  v_pass_covered boolean := false; v_activate boolean := false; v_upd2 int; v_pass_expires timestamptz;
begin
  if p_mode not in ('guest','promote') then return jsonb_build_object('outcome','invalid_mode'); end if;
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('acct:' || v_account::text));
  v_now := clock_timestamp();
  select r.status, r.event_id, r.ready_at, r.room_id into v_status, v_event, v_ready, v_req_room
    from public.karaoke_requests r where r.id=p_request_id and r.room_id=p_room_id for update;
  if v_status is null then return jsonb_build_object('outcome','not_found'); end if;
  if v_status <> 'waiting' then return jsonb_build_object('outcome','not_waiting'); end if;
  select e.room_id, e.status into v_ev_room, v_ev_status from public.karaoke_events e where e.id=v_event;
  if v_event is null or v_ev_room is distinct from p_room_id or v_req_room is distinct from p_room_id
     or v_ev_status is distinct from 'active' then
    return jsonb_build_object('outcome','event_state_invalid'); end if;
  if exists (select 1 from public.karaoke_requests where room_id=p_room_id and status='playing') then
    return jsonb_build_object('outcome','already_playing'); end if;
  if p_mode='guest' then
    select id into v_first from public.karaoke_requests
      where room_id=p_room_id and event_id=v_event and status='waiting' order by position,created_at,id limit 1;
    if v_first is distinct from p_request_id then return jsonb_build_object('outcome','not_next'); end if;
  else
    if v_ready is null then return jsonb_build_object('outcome','not_ready'); end if;
    select id into v_first from public.karaoke_requests
      where room_id=p_room_id and event_id=v_event and status='waiting' and ready_at is not null
      order by position,created_at,id limit 1;
    if v_first is distinct from p_request_id then return jsonb_build_object('outcome','not_next'); end if;
  end if;
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=v_account and status='active';
  if v_plan_n=1 and v_plan in ('FREE','PRO') then null; else v_plan:='FREE'; end if;
  select coalesce((select enforcement_enabled from public.karaoke_usage_policy where policy_key='default'), false) into v_enf;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz from public.karaoke_accounts where id=v_account;

  -- ── BUILD 17: Timed Access Pass coverage / activation candidate ──
  -- PRO owners are already unlimited and NEVER consume a pass (§6): leave any SELECTED
  -- pass untouched and take no pass path.
  if v_plan <> 'PRO' then
    -- Lazy expiry (server-time truth, no cron): retire any ACTIVE pass past its window
    -- and append one EXPIRED audit each. Held account lock makes this race-safe.
    with exp as (
      update public.timed_access_pass_grants
         set status='EXPIRED', expired_at=v_now, updated_at=now()
       where account_id=v_account and status='ACTIVE' and expires_at <= v_now
      returning id)
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status)
    select id, v_account, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED' from exp;

    -- A still-valid ACTIVE pass covers this start (subsequent song within the window).
    select id into v_active_pass from public.timed_access_pass_grants
      where account_id=v_account and status='ACTIVE' and expires_at > v_now for update limit 1;
    if v_active_pass is not null then
      v_pass_covered := true; v_pass_grant := v_active_pass;
    else
      -- A SELECTED pass is the first-start activation candidate.
      select id, duration_seconds into v_sel_pass, v_sel_dur from public.timed_access_pass_grants
        where account_id=v_account and status='SELECTED' for update limit 1;
      if v_sel_pass is not null then
        v_pass_covered := true; v_activate := true; v_pass_grant := v_sel_pass;
      end if;
    end if;
  end if;

  -- FREE 0:00 enforcement — bypassed when a pass covers/activates this start (§1.6).
  if v_enf and v_plan='FREE' and not v_pass_covered then
    v_ent := public.karaoke_free_minutes_entitlement_at(v_account, v_now);
    if (v_ent->>'outcome') is not null then return jsonb_build_object('outcome','shadow_metering_error','detail',v_ent->>'outcome'); end if;
    if (v_ent->>'remainingSeconds')::int <= 0 then
      return jsonb_build_object('outcome','upgrade_required','entitlement',v_ent); end if;
  end if;

  update public.karaoke_requests set status='playing', started_at=v_now
    where id=p_request_id and room_id=p_room_id and status='waiting';
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;

  -- Atomic activation: the committed flip is what activates the SELECTED pass. Exactly one
  -- ACTIVATED audit (unique index backstops a duplicate). expires_at is fixed here forever.
  if v_activate then
    v_pass_expires := v_now + make_interval(secs => v_sel_dur);
    update public.timed_access_pass_grants
       set status='ACTIVE', activated_at=v_now, expires_at=v_pass_expires, updated_at=now()
     where id=v_sel_pass and status='SELECTED';
    get diagnostics v_upd2 = row_count;
    if v_upd2 <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status, metadata)
    values (v_sel_pass, v_account, 'SYSTEM', 'dj_start', 'ACTIVATED', 'SELECTED', 'ACTIVE',
            jsonb_build_object('requestId', p_request_id, 'roomId', p_room_id, 'eventId', v_event));
  elsif v_active_pass is not null then
    select expires_at into v_pass_expires from public.timed_access_pass_grants where id=v_active_pass;
  end if;

  -- Usage segment: pass-covered starts are NON-metered (FREE meter paused), tagged with the
  -- covering pass. The relaxed CHECK permits FREE + non-metered only when paused-by-pass.
  insert into public.karaoke_event_usage_segments
    (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot,
     pass_grant_id,metering_paused_by_pass)
  values (v_account, v_event, p_room_id, p_request_id, v_plan,
          (v_plan='FREE' and not v_pass_covered), v_now, v_tz,
          v_pass_grant, v_pass_covered);   -- conflict → rollback (fail closed)

  return jsonb_build_object('outcome','ok',
    'entitlement', public.karaoke_free_minutes_entitlement_at(v_account, v_now),
    'passActivated', v_activate,
    'passCovered', v_pass_covered,
    'passGrantId', v_pass_grant,
    'passExpiresAt', v_pass_expires);
end; $$;
revoke all on function public.karaoke_begin_song(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_begin_song(uuid, uuid, text) to service_role;
