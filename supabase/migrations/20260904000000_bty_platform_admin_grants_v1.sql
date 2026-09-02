-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BTY PLATFORM ADMIN AUTHORITY V1.
-- ADDITIVE ONLY. Creates ONE table. No existing table, column, constraint,
-- grant, policy or row is altered.
--
-- ORDERING: this is deliberately 20260904, AFTER 20260903 (Foundry host grant
-- provenance), which is written and approved but NOT YET APPLIED. Numbering
-- ahead of it would let this land first and silently reorder an approved
-- migration. The two are independent: nothing here reads or writes
-- foundry_host_grants, and Platform Admin works whether or not 20260903 ever
-- runs.
-- ===========================================================================
--
-- WHY THIS TABLE HAS TO EXIST, MEASURED (2026-09-02).
-- BTY had NO server-owned notion of a platform administrator. All 183 tables
-- were enumerated: the only authority-shaped ones are foundry_host_grants
-- (Foundry Host), bty_org_action_review_authority (an actor->learner review
-- edge), certified_leader_grants (a certification window) and
-- role_mirror_history (Arena). None of them is a platform admin.
--
-- The only "admin" in the product was `BTY_ADMIN_EMAILS`, an environment
-- variable compared against `user.email` at REQUEST TIME, guarding ~30 API
-- routes plus the admin layout. Three things are wrong with that, and they are
-- why this table exists rather than another entry in that string:
--
--   1. Email is not identity. A Microsoft-first product resolves a person by
--      (tenant_id, aad_object_id) -> canonical user id. An email can be
--      reassigned, aliased, or simply differ between the directory and the
--      auth row, and it is not what any other authority in this schema keys on.
--   2. It cannot be audited. There is no granted_at, no granter, no revocation
--      -- only a deploy-time string, so "who made this person an admin, and
--      when" has no answer anywhere in the system.
--   3. It failed OPEN. `requireAdminEmail` allowed ANY authenticated user when
--      the variable was unset, which is the worst possible default for the
--      thing guarding the admin surface.
--
-- SHAPE IS COPIED FROM foundry_host_grants ON PURPOSE. Same user_id primary
-- key, same status/granted_by/granted_at/revoked_at columns, same revocation
-- CHECK, same default-deny posture. A second authority table that behaves like
-- the first is one fewer thing for the next reader to learn, and the ops script
-- and audit habits already exist for that shape.
--
-- ADMIN IMPLIES HOST; IT IS NOT HOST. Kept as its own table rather than a third
-- provenance flag on foundry_host_grants, because inheritance and identity are
-- different claims: an Admin who is not a Foundry Host must still be able to do
-- Host things, while remaining distinguishable from someone actually granted
-- Host. Folding them together would make "revoke this person's Host" and
-- "revoke this person's Admin" the same operation, which they are not.
--
-- NO SEED DATA HERE, BY CONSTRUCTION. This file contains no user id and no
-- email. Who is an admin is production data with an audit trail, applied as a
-- separate, verified, idempotent bootstrap -- not a constant compiled into
-- schema history that every future environment would silently inherit.
--
-- ROLLBACK:
--   drop table if exists public.bty_platform_admin_grants;
-- ===========================================================================

create table if not exists public.bty_platform_admin_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active',
  granted_by_user_id uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint bty_platform_admin_grants_status_check
    check (status in ('active', 'revoked')),
  -- A revoked row must say when. An active row must not claim it was revoked.
  constraint bty_platform_admin_grants_revocation_check
    check (
      (status = 'active' and revoked_at is null)
      or
      (status = 'revoked' and revoked_at is not null)
    )
);

-- Hot path: "is this user an active platform admin?" — and the only listing the
-- roster ever needs.
create index if not exists bty_platform_admin_grants_active_idx
  on public.bty_platform_admin_grants (status)
  where status = 'active';

comment on table public.bty_platform_admin_grants is
  'Canonical BTY platform-admin authority, keyed by canonical auth.users id. Never by email. An ACTIVE row inherits product-role capabilities (Foundry Host, participant) without a foundry_host_grants row. Service-role only: no client of any kind may read this roster.';
comment on column public.bty_platform_admin_grants.granted_by_user_id is
  'The canonical user who granted this, when known. NULL means a bootstrap or an out-of-band grant whose granter is not recorded -- never "granted by the system".';

-- ---------------------------------------------------------------------------
-- DEFAULT-DENY FOR EVERY CLIENT ROLE.
--
-- Verified against production before writing this: an anon request to the
-- comparable table returns `42501 permission denied`, and RLS with no policy
-- denies every row to any client role even if a privilege were later granted by
-- mistake. Both halves are applied here, so neither alone is load-bearing.
--
-- `service_role` is granted EXPLICITLY rather than left to the environment
-- default. The default is what the older tables rely on; stating it means a
-- future default change cannot silently break authorization, and it documents
-- exactly which verbs the server path uses.
--
-- No policy is created, deliberately. A policy would be the mechanism by which
-- a client role could ever read this roster, and no client role ever should.
-- ---------------------------------------------------------------------------

revoke all on public.bty_platform_admin_grants from public, anon, authenticated;
alter table public.bty_platform_admin_grants enable row level security;
grant select, insert, update, delete on public.bty_platform_admin_grants to service_role;
