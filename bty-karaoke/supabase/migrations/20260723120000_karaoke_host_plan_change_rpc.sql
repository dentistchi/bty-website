-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — PRO PILOT ASSIGNMENT + PLAN LIFECYCLE V1. Adds a SAFE, operator-only
-- path to move a canonical Host account between FREE and PRO, with a permanent,
-- append-only history, on top of the Host Plan Foundation (20260722120000). Isolated
-- bty-karaoke Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent;
-- never rewrites or regresses any prior migration.
--
-- Product decisions encoded here (see slice spec):
--   * A plan change is ONE server-owned transaction, never several client writes:
--     end the current active row, insert the new active row, and append exactly one
--     immutable audit row — all-or-nothing. A failure leaves the account untouched.
--   * The partial unique index (one ACTIVE per account) is preserved; the mid-change
--     state is never 0 or 2 active rows because the end+insert share one transaction
--     and an advisory xact lock serializes concurrent operator requests per account.
--   * Same-plan requests are an idempotent NO-OP: no new assignment, no audit row.
--   * Replay-safe: a previously-processed idempotency key returns its recorded
--     outcome and writes nothing (no duplicate assignment, no duplicate audit row).
--   * The audit trail is APPEND-ONLY (UPDATE/DELETE blocked by a trigger) and never
--     stores a token, OAuth credential, provider subject, or email.
--   * This slice changes NOTHING automatically: no login/room/event ever calls this.
--     Only an authorized operator route (service_role) does, at a Commander gate.
--
-- Billing is explicitly out of scope: no price, checkout, subscription, or paywall.
--
-- Rollback:
--   drop function if exists public.change_karaoke_host_plan(uuid, text, text, text, text, uuid);
--   drop trigger if exists karaoke_host_plan_audit_no_mutate on public.karaoke_host_plan_assignment_audit;
--   drop function if exists public.karaoke_host_plan_audit_immutable();
--   drop table if exists public.karaoke_host_plan_assignment_audit;

-- 1. APPEND-ONLY AUDIT TABLE --------------------------------------------------
-- One immutable row per REAL plan change (never for a no-op). It records the full
-- before/after so the plan timeline is always reconstructable independently of the
-- assignment rows themselves.
create table if not exists public.karaoke_host_plan_assignment_audit (
  id                     uuid primary key default gen_random_uuid(),
  -- The canonical Host account whose plan changed. CASCADE: an account's audit trail
  -- goes with the account if it is ever deleted (an audit row for a nonexistent
  -- account is meaningless) — but no Room/Event/queue ever cascades from here.
  account_id             uuid not null references public.karaoke_accounts(id) on delete cascade,
  -- Before/after plan codes. previous_plan is NULL only in the defensive case where
  -- the account had no active assignment at all (the resolver's FREE fallback state).
  previous_plan          text check (previous_plan is null or previous_plan in ('FREE', 'PRO')),
  new_plan               text not null check (new_plan in ('FREE', 'PRO')),
  -- The assignment rows this change ended / created, for a precise audit join.
  previous_assignment_id uuid references public.karaoke_host_plan_assignments(id) on delete set null,
  new_assignment_id      uuid not null references public.karaoke_host_plan_assignments(id) on delete cascade,
  -- How the change was effected. Only MANUAL is used in this slice; the allowlist
  -- matches the assignment table so future BILLING changes audit the same way.
  source                 text not null default 'MANUAL'
                           check (source in ('SYSTEM_DEFAULT', 'MANUAL', 'BILLING')),
  -- Who effected it (a Host/operator account, for future MANUAL/admin actions). SET
  -- NULL so removing an actor account never rewrites history. NULL for system/service.
  changed_by             uuid references public.karaoke_accounts(id) on delete set null,
  -- A human reason is MANDATORY and must be non-empty — the audit trail is never
  -- silent about why a plan moved.
  reason                 text not null check (length(btrim(reason)) > 0),
  -- Operation identifier for replay-safety. Globally unique: a retried request with
  -- the same key can never create a second change.
  idempotency_key        text not null,
  created_at             timestamptz not null default now()
);

-- Replay guard: one audit row per operation id. A retry with the same key is caught
-- before any write (in the RPC) and, as a backstop, by this unique index.
create unique index if not exists karaoke_host_plan_audit_idempotency_idx
  on public.karaoke_host_plan_assignment_audit (idempotency_key);

-- History read: "this account's plan changes, newest first".
create index if not exists karaoke_host_plan_audit_account_idx
  on public.karaoke_host_plan_assignment_audit (account_id, created_at desc);

-- RLS: default-deny, same posture as every other table. service_role bypasses; the
-- browser and anon/authenticated roles get nothing.
alter table public.karaoke_host_plan_assignment_audit enable row level security;
revoke all on public.karaoke_host_plan_assignment_audit from anon, authenticated;

-- APPEND-ONLY enforcement at the DB, not just by convention: UPDATE and DELETE are
-- rejected for everyone (including service_role). Only INSERT is ever allowed, so the
-- audit trail can never be silently rewritten or erased.
create or replace function public.karaoke_host_plan_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'karaoke_host_plan_assignment_audit is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists karaoke_host_plan_audit_no_mutate on public.karaoke_host_plan_assignment_audit;
create trigger karaoke_host_plan_audit_no_mutate
  before update or delete on public.karaoke_host_plan_assignment_audit
  for each row execute function public.karaoke_host_plan_audit_immutable();

-- 2. ATOMIC PLAN-CHANGE RPC ---------------------------------------------------
-- The ONLY sanctioned way to move a plan. Server/service_role only; the browser can
-- never call it. Performs the whole change in one transaction (see header).
create or replace function public.change_karaoke_host_plan(
  p_account_id      uuid,
  p_plan_code       text,
  p_reason          text,
  p_idempotency_key text,
  p_source          text default 'MANUAL',
  p_actor_account   uuid default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_reason      text := btrim(coalesce(p_reason, ''));
  v_key         text := btrim(coalesce(p_idempotency_key, ''));
  v_active      public.karaoke_host_plan_assignments%rowtype;
  v_prior       public.karaoke_host_plan_assignment_audit%rowtype;
  v_new_id      uuid;
  v_prev_plan   text;
begin
  -- Validate the vocabulary (defense in depth; the operator route validates too).
  if p_plan_code is null or p_plan_code not in ('FREE', 'PRO') then
    return jsonb_build_object('ok', false, 'error', 'invalid_plan_code');
  end if;
  if p_source is null or p_source not in ('SYSTEM_DEFAULT', 'MANUAL', 'BILLING') then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;
  if v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'idempotency_key_required');
  end if;

  -- Serialize concurrent plan changes for THIS account (released at txn end). Makes
  -- the read-modify-write of the single active assignment atomic across two near-
  -- simultaneous operator requests, so the active count is never 0 or 2.
  perform pg_advisory_xact_lock(hashtext('karaoke_host_plan:' || p_account_id::text));

  -- Account must exist. Existence only — no email/subject is read or returned.
  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  -- Replay safety: a key we already processed returns its recorded outcome and
  -- writes NOTHING (no second assignment, no second audit row).
  select * into v_prior
    from public.karaoke_host_plan_assignment_audit
   where idempotency_key = v_key
   limit 1;
  if found then
    return jsonb_build_object(
      'ok', true, 'changed', true, 'replayed', true,
      'previousPlan', v_prior.previous_plan,
      'currentPlan', v_prior.new_plan
    );
  end if;

  -- Lock the current active assignment so a concurrent change cannot slip between
  -- our read and our end+insert (belt-and-braces with the advisory lock).
  select * into v_active
    from public.karaoke_host_plan_assignments
   where account_id = p_account_id and status = 'active'
   for update;
  v_prev_plan := v_active.plan_code; -- NULL when no active row exists

  -- Same-plan request is an idempotent NO-OP: no new assignment, no audit row.
  if v_active.id is not null and v_active.plan_code = p_plan_code then
    return jsonb_build_object('ok', true, 'changed', false, 'currentPlan', p_plan_code);
  end if;

  -- Real change, all-or-nothing in this one transaction:
  --   1. end the current active row (if any),
  --   2. insert the new active row (partial unique index guarantees exactly one),
  --   3. append exactly one immutable audit row.
  -- Any failure raises and rolls the whole transaction back — never 0 or 2 active.
  if v_active.id is not null then
    update public.karaoke_host_plan_assignments
       set status = 'ended', ended_at = now()
     where id = v_active.id;
  end if;

  insert into public.karaoke_host_plan_assignments
    (account_id, plan_code, source, status, assigned_by_account)
  values (p_account_id, p_plan_code, p_source, 'active', p_actor_account)
  returning id into v_new_id;

  insert into public.karaoke_host_plan_assignment_audit
    (account_id, previous_plan, new_plan, previous_assignment_id, new_assignment_id,
     source, changed_by, reason, idempotency_key)
  values (p_account_id, v_prev_plan, p_plan_code, v_active.id, v_new_id,
          p_source, p_actor_account, v_reason, v_key);

  return jsonb_build_object(
    'ok', true, 'changed', true,
    'previousPlan', v_prev_plan,
    'currentPlan', p_plan_code
  );
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.change_karaoke_host_plan(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.change_karaoke_host_plan(uuid, text, text, text, text, uuid)
  to service_role;
