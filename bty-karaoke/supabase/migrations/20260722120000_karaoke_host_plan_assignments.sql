-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — HOST PLAN + ENTITLEMENT FOUNDATION V1. Gives the product a durable
-- place to record WHICH plan a Host account is on, BEFORE any billing exists.
-- Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj). Additive +
-- idempotent; never regresses a prior migration.
--
-- Product decisions encoded here (see slice spec):
--   * A plan belongs to the CANONICAL HOST ACCOUNT (karaoke_accounts), never to a
--     Room — one Host may own several Rooms later, and they share one plan.
--   * Exactly two plan codes exist: FREE and PRO. Only FREE is ever ASSIGNED in
--     this slice; PRO is defined for the future and granted to nobody.
--   * History is additive: an upgrade/downgrade ENDS the current row (status
--     'ended', ended_at set) and inserts a new active row. Nothing is overwritten,
--     so the plan timeline is always reconstructable.
--   * DB invariant: at most ONE active assignment per account (a partial unique
--     index), so "the current plan" is never ambiguous.
--
-- This migration does NOT implement pricing, checkout, feature gating, or any PRO
-- capability. Every current Host feature stays available to FREE; entitlement is
-- resolved in the app by a single resolver, not by this table's shape.
--
-- Rollback:
--   drop table if exists public.karaoke_host_plan_assignments;

-- 1. PLAN ASSIGNMENTS ---------------------------------------------------------
create table if not exists public.karaoke_host_plan_assignments (
  id                   uuid primary key default gen_random_uuid(),
  -- The canonical Host account this plan belongs to. CASCADE: if an account is
  -- ever deleted, its plan history goes with it (a plan row for a nonexistent
  -- account is meaningless) — but no Event/Room/queue ever cascades from here.
  account_id           uuid not null references public.karaoke_accounts(id) on delete cascade,
  plan_code            text not null check (plan_code in ('FREE', 'PRO')),
  -- How the assignment came to be. Only SYSTEM_DEFAULT is used this slice.
  source               text not null default 'SYSTEM_DEFAULT'
                         check (source in ('SYSTEM_DEFAULT', 'MANUAL', 'BILLING')),
  status               text not null default 'active' check (status in ('active', 'ended')),
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  -- Who effected the change (a Host account, for future MANUAL/admin actions).
  -- SET NULL so removing an actor account never rewrites plan history. NULL for
  -- SYSTEM_DEFAULT (the system, not a person).
  assigned_by_account  uuid references public.karaoke_accounts(id) on delete set null,
  created_at           timestamptz not null default now(),
  -- An active row has no end; an ended row must record when it ended. Keeps the
  -- timeline honest and makes "active" a trustworthy filter.
  constraint karaoke_host_plan_status_chk
    check ((status = 'active' and ended_at is null)
        or (status = 'ended'  and ended_at is not null))
);

-- THE invariant: at most one ACTIVE assignment per account. A partial unique index
-- makes "one current plan" a declarative DB rule, not an app check — and makes the
-- idempotent backfill / new-account provisioning safe under concurrency.
create unique index if not exists karaoke_host_plan_active_unique_idx
  on public.karaoke_host_plan_assignments (account_id)
  where status = 'active';

-- The hot resolver lookup: "this account's current plan".
create index if not exists karaoke_host_plan_account_idx
  on public.karaoke_host_plan_assignments (account_id, status);

-- RLS: default-deny, same posture as every other table. service_role bypasses;
-- the browser and anon/authenticated roles get nothing.
alter table public.karaoke_host_plan_assignments enable row level security;
revoke all on public.karaoke_host_plan_assignments from anon, authenticated;

-- 2. BACKFILL EXISTING ACCOUNTS ----------------------------------------------
-- Give every existing canonical Host account exactly one active FREE assignment.
-- Idempotent: only accounts WITHOUT an active assignment receive one, and the
-- partial unique index + ON CONFLICT DO NOTHING make a re-run (or a concurrent
-- login provisioning the same account) insert nothing rather than duplicate.
insert into public.karaoke_host_plan_assignments (account_id, plan_code, source, status)
select a.id, 'FREE', 'SYSTEM_DEFAULT', 'active'
  from public.karaoke_accounts a
 where not exists (
   select 1 from public.karaoke_host_plan_assignments p
    where p.account_id = a.id
      and p.status = 'active'
 )
on conflict do nothing;
