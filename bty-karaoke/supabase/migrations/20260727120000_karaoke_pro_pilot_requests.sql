-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — PRO PILOT REQUEST + MANAGER APPROVAL V1. Adds the smallest workflow
-- that lets a FREE Host REQUEST the PRO pilot from the native app and lets a Manager
-- APPROVE or DECLINE it from the web console. Isolated bty-karaoke Supabase project
-- (ref zycwaqignioawtqynopj). Additive + idempotent; never rewrites or regresses a
-- prior migration.
--
-- Product decisions encoded here (see BUILD 16 spec):
--   * A request NEVER changes a plan by itself. PRO happens ONLY when a Manager
--     approves, and ONLY through the EXISTING canonical plan authority
--     (change_karaoke_host_plan). This migration does not introduce a second plan
--     authority and creates NO new plan-assignment table.
--   * PRO entitlement stays ACCOUNT-scoped. room_id here is request CONTEXT and
--     Manager display only — it grants nothing.
--   * At most ONE PENDING request per account (partial unique index) — enforced at
--     the DB, not by a UI check.
--   * Approve is the dangerous path and is done in ONE transaction (decide RPC):
--     verify PENDING (CAS) -> change plan idempotently via the existing RPC -> mark
--     APPROVED -> append exactly one decision-audit row. All-or-nothing, so the app
--     can never be left with "request APPROVED but plan FREE" or "plan PRO but
--     request PENDING". Durable idempotency (unique keys), never an in-memory flag.
--   * The decision audit is APPEND-ONLY (UPDATE/DELETE blocked by trigger) and never
--     stores a token, OAuth credential, provider subject, or email.
--
-- Billing is explicitly out of scope: no price, checkout, subscription, or paywall.
--
-- Rollback:
--   drop function if exists public.decide_karaoke_pro_pilot_request(uuid, text, text, text, text, uuid);
--   drop function if exists public.create_karaoke_pro_pilot_request(uuid, uuid, text);
--   drop trigger if exists karaoke_pro_pilot_audit_no_mutate on public.karaoke_pro_pilot_request_audit;
--   drop function if exists public.karaoke_pro_pilot_audit_immutable();
--   drop table if exists public.karaoke_pro_pilot_request_audit;
--   drop table if exists public.karaoke_pro_pilot_requests;

-- 1. REQUEST ENTITY -----------------------------------------------------------
create table if not exists public.karaoke_pro_pilot_requests (
  id                          uuid primary key default gen_random_uuid(),
  -- The canonical Host account that requested the pilot. CASCADE: the request goes
  -- with the account if it is ever deleted (a request for a nonexistent account is
  -- meaningless). No Room/Event/queue ever cascades from here.
  account_id                  uuid not null references public.karaoke_accounts(id) on delete cascade,
  -- Request-time context / Manager display only. SET NULL so removing a Room never
  -- rewrites request history and never affects the (account-scoped) entitlement.
  room_id                     uuid references public.karaoke_rooms(id) on delete set null,
  status                      text not null default 'PENDING'
                                check (status in ('PENDING', 'APPROVED', 'DECLINED')),
  requested_at                timestamptz not null default now(),
  decided_at                  timestamptz,
  -- Opaque operator reference (e.g. 'bty_mgr'); the Manager is a shared passcode
  -- operator, not a Host account, so this is text, never a personal identity.
  decided_by                  text,
  decision_reason             text,
  -- The active PRO assignment an approval produced, for a precise audit join. SET
  -- NULL if that assignment row is ever removed.
  approved_plan_assignment_id uuid references public.karaoke_host_plan_assignments(id) on delete set null,
  -- Replay guard for POST create: a retried create with the same key returns the
  -- same request rather than inserting a second row.
  request_idempotency_key     text not null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  -- A decided request must record when/how it was decided; a pending one must not.
  constraint karaoke_pro_pilot_decided_chk
    check ((status = 'PENDING' and decided_at is null)
        or (status in ('APPROVED', 'DECLINED') and decided_at is not null))
);

-- THE invariant: at most one PENDING request per account. Declarative DB rule, not
-- an app check — makes the create RPC's dedup safe under concurrency.
create unique index if not exists karaoke_pro_pilot_pending_unique_idx
  on public.karaoke_pro_pilot_requests (account_id)
  where status = 'PENDING';

-- Replay guard for create.
create unique index if not exists karaoke_pro_pilot_request_idem_idx
  on public.karaoke_pro_pilot_requests (request_idempotency_key);

-- Hot reads: "this account's requests, newest first" and "all PENDING".
create index if not exists karaoke_pro_pilot_account_idx
  on public.karaoke_pro_pilot_requests (account_id, requested_at desc);
create index if not exists karaoke_pro_pilot_status_idx
  on public.karaoke_pro_pilot_requests (status, requested_at desc);

alter table public.karaoke_pro_pilot_requests enable row level security;
revoke all on public.karaoke_pro_pilot_requests from anon, authenticated;

-- 2. APPEND-ONLY DECISION AUDIT ----------------------------------------------
-- Distinct from the plan-assignment audit: this records the REQUEST lifecycle
-- decision (who decided, PENDING -> APPROVED/DECLINED), never a plan row. A decline
-- has a decision-audit row but NO plan-assignment audit.
create table if not exists public.karaoke_pro_pilot_request_audit (
  id                       uuid primary key default gen_random_uuid(),
  request_id               uuid not null references public.karaoke_pro_pilot_requests(id) on delete cascade,
  account_id               uuid not null references public.karaoke_accounts(id) on delete cascade,
  previous_status          text not null check (previous_status in ('PENDING', 'APPROVED', 'DECLINED')),
  next_status              text not null check (next_status in ('APPROVED', 'DECLINED')),
  -- Opaque operator reference; never a personal identity.
  manager_actor            text,
  decision_reason          text,
  -- Durable operation id — a retried approve/decline with the same key writes
  -- nothing new (the RPC catches it; this unique index is the backstop).
  decision_idempotency_key text not null,
  created_at               timestamptz not null default now()
);

create unique index if not exists karaoke_pro_pilot_audit_idem_idx
  on public.karaoke_pro_pilot_request_audit (decision_idempotency_key);
create index if not exists karaoke_pro_pilot_audit_request_idx
  on public.karaoke_pro_pilot_request_audit (request_id, created_at desc);

alter table public.karaoke_pro_pilot_request_audit enable row level security;
revoke all on public.karaoke_pro_pilot_request_audit from anon, authenticated;

create or replace function public.karaoke_pro_pilot_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'karaoke_pro_pilot_request_audit is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists karaoke_pro_pilot_audit_no_mutate on public.karaoke_pro_pilot_request_audit;
create trigger karaoke_pro_pilot_audit_no_mutate
  before update or delete on public.karaoke_pro_pilot_request_audit
  for each row execute function public.karaoke_pro_pilot_audit_immutable();

-- 3. CREATE RPC ---------------------------------------------------------------
-- Race-safe request creation. service_role only. In one transaction: reject when
-- the account is already PRO; return the existing PENDING request (or the same
-- request for a replayed idempotency key) instead of inserting a duplicate.
create or replace function public.create_karaoke_pro_pilot_request(
  p_account_id uuid,
  p_room_id    uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_key      text := btrim(coalesce(p_idempotency_key, ''));
  v_existing public.karaoke_pro_pilot_requests%rowtype;
  v_plan     text;
  v_new_id   uuid;
begin
  if v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'idempotency_key_required');
  end if;

  perform pg_advisory_xact_lock(hashtext('karaoke_pro_pilot:' || p_account_id::text));

  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  -- Replay: the same create key returns its request unchanged.
  select * into v_existing
    from public.karaoke_pro_pilot_requests
   where request_idempotency_key = v_key
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'requestId', v_existing.id,
      'status', v_existing.status, 'reused', true);
  end if;

  -- A PRO account cannot request the pilot again.
  select plan_code into v_plan
    from public.karaoke_host_plan_assignments
   where account_id = p_account_id and status = 'active'
   limit 1;
  if v_plan = 'PRO' then
    return jsonb_build_object('ok', false, 'error', 'already_pro');
  end if;

  -- An existing PENDING request is returned as-is (no second row).
  select * into v_existing
    from public.karaoke_pro_pilot_requests
   where account_id = p_account_id and status = 'PENDING'
   for update;
  if found then
    return jsonb_build_object('ok', true, 'requestId', v_existing.id,
      'status', v_existing.status, 'reused', true);
  end if;

  insert into public.karaoke_pro_pilot_requests (account_id, room_id, request_idempotency_key)
  values (p_account_id, p_room_id, v_key)
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'requestId', v_new_id, 'status', 'PENDING', 'reused', false);
end;
$$;

revoke all on function public.create_karaoke_pro_pilot_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_karaoke_pro_pilot_request(uuid, uuid, text)
  to service_role;

-- 4. DECIDE RPC (approve / decline) -------------------------------------------
-- The single safe decision path. service_role only. ONE transaction:
--   * decision-idempotency replay -> return recorded outcome, write nothing;
--   * lock + CAS the request to PENDING (else already-decided rejection);
--   * APPROVE: change the plan via the EXISTING change_karaoke_host_plan RPC
--     (idempotent, derived plan key), capture the new active assignment, mark
--     APPROVED, append one decision-audit row;
--   * DECLINE: mark DECLINED, append one decision-audit row, NO plan change.
-- Any failure rolls the whole transaction back — no partial state.
create or replace function public.decide_karaoke_pro_pilot_request(
  p_request_id  uuid,
  p_decision    text,
  p_reason      text,
  p_decision_idempotency_key text,
  p_manager_actor text default 'bty_mgr',
  p_actor_account uuid default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_key        text := btrim(coalesce(p_decision_idempotency_key, ''));
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_req        public.karaoke_pro_pilot_requests%rowtype;
  v_audit      public.karaoke_pro_pilot_request_audit%rowtype;
  v_next       text;
  v_plan_key   text;
  v_change     jsonb;
  v_assign_id  uuid;
begin
  if p_decision not in ('approve', 'decline') then
    return jsonb_build_object('ok', false, 'error', 'invalid_decision');
  end if;
  if v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'idempotency_key_required');
  end if;
  v_next := case when p_decision = 'approve' then 'APPROVED' else 'DECLINED' end;

  -- Load the request first to derive the per-account advisory lock key.
  select * into v_req from public.karaoke_pro_pilot_requests where id = p_request_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'request_not_found');
  end if;

  perform pg_advisory_xact_lock(hashtext('karaoke_pro_pilot:' || v_req.account_id::text));

  -- Durable replay: the same decision key returns its recorded outcome, writes nothing.
  select * into v_audit
    from public.karaoke_pro_pilot_request_audit
   where decision_idempotency_key = v_key
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true,
      'requestId', v_audit.request_id, 'status', v_audit.next_status);
  end if;

  -- Re-read under lock for the CAS.
  select * into v_req from public.karaoke_pro_pilot_requests where id = p_request_id for update;

  if v_req.status <> 'PENDING' then
    -- Already decided: cannot approve a DECLINED or decline an APPROVED request.
    return jsonb_build_object('ok', false, 'error', 'already_decided',
      'status', v_req.status);
  end if;

  if p_decision = 'approve' then
    -- Reuse the EXISTING canonical plan authority. A deterministic plan key derived
    -- from the decision key makes a retried approval a plan-change no-op replay
    -- (never a second assignment), even independent of the decision-audit backstop.
    v_plan_key := 'propilot:' || v_key;
    v_change := public.change_karaoke_host_plan(
      v_req.account_id, 'PRO',
      coalesce(v_reason, 'PRO pilot approved'),
      v_plan_key, 'MANUAL', p_actor_account
    );
    if coalesce((v_change ->> 'ok')::boolean, false) is not true then
      -- Surface the plan authority's rejection; the whole txn rolls back.
      return jsonb_build_object('ok', false, 'error',
        coalesce(v_change ->> 'error', 'plan_change_failed'));
    end if;

    select id into v_assign_id
      from public.karaoke_host_plan_assignments
     where account_id = v_req.account_id and status = 'active'
     limit 1;

    update public.karaoke_pro_pilot_requests
       set status = 'APPROVED', decided_at = now(), decided_by = p_manager_actor,
           decision_reason = v_reason, approved_plan_assignment_id = v_assign_id,
           updated_at = now()
     where id = p_request_id;
  else
    -- Decline never touches the plan.
    update public.karaoke_pro_pilot_requests
       set status = 'DECLINED', decided_at = now(), decided_by = p_manager_actor,
           decision_reason = v_reason, updated_at = now()
     where id = p_request_id;
  end if;

  insert into public.karaoke_pro_pilot_request_audit
    (request_id, account_id, previous_status, next_status, manager_actor,
     decision_reason, decision_idempotency_key)
  values (p_request_id, v_req.account_id, 'PENDING', v_next, p_manager_actor,
          v_reason, v_key);

  return jsonb_build_object('ok', true, 'replayed', false,
    'requestId', p_request_id, 'status', v_next);
end;
$$;

revoke all on function public.decide_karaoke_pro_pilot_request(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.decide_karaoke_pro_pilot_request(uuid, text, text, text, text, uuid)
  to service_role;
