-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- MICROSOFT MANAGER AUTHORITY V1 -- HOST GRANT PROVENANCE.
-- ADDITIVE ONLY. No existing column, constraint, grant or row is dropped or
-- rewritten. `foundry_host_grants` stays the single canonical Host gate and
-- `status` keeps its exact existing meaning, so every reader continues to work
-- untouched: 31 API routes via requireManager, and the two SQL-layer checks in
-- 20260721000000 and 20260722000000 that read `status = 'active'` directly.
-- ===========================================================================
--
-- WHY PROVENANCE IS REQUIRED, MEASURED (2026-09-01).
-- The live table is:
--
--   user_id (PK) | status | granted_by_user_id | granted_at | revoked_at
--
-- and it holds exactly ONE row: the Founder, status='active',
-- granted_by_user_id = NULL. There is no source, origin or audit column, and
-- `granted_by_user_id` cannot be pressed into service as one -- it is a FK to
-- auth.users whose NULL already means "the granter is unknown or deleted", so
-- overloading NULL to also mean "granted by the sync" would make the Founder's
-- existing row indistinguishable from a synced one on the very first run.
--
-- Consequence, stated plainly: a manager sync that revoked every grant it did
-- not just create would revoke the FOUNDER, who has no Microsoft direct report.
-- That is the failure this migration exists to make structurally impossible.
--
-- WHY TWO FLAGS AND NOT A SINGLE `source` ENUM.
-- `user_id` is the PRIMARY KEY, so a person has AT MOST ONE ROW. The product
-- rule is that a person may hold manual authority AND Microsoft manager
-- entitlement at the same time, and that losing one must not remove the other.
-- A single `source` column cannot hold two values in one row: it would force
-- the sync to either overwrite 'manual' (silently destroying the Founder's
-- standing authority) or refuse to record the Microsoft entitlement at all.
-- Two independent booleans represent both, and OR-ing them is the whole rule.
--
-- `status` REMAINS THE DERIVED EFFECTIVE COLUMN. It is not replaced and not
-- deprecated. It equals 'active' exactly when at least one source grants, and
-- the CHECK below makes that an invariant the database enforces rather than a
-- convention application code is trusted to remember.
--
-- ROLLBACK:
--   alter table public.foundry_host_grants
--     drop constraint if exists foundry_host_grants_effective_check;
--   alter table public.foundry_host_grants
--     drop column if exists microsoft_manager_synced_at,
--     drop column if exists microsoft_manager_granted,
--     drop column if exists manual_granted;
--   drop function if exists public.bty_list_microsoft_linked_users();
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. PROVENANCE COLUMNS
-- ---------------------------------------------------------------------------

alter table public.foundry_host_grants
  add column if not exists manual_granted boolean not null default false,
  add column if not exists microsoft_manager_granted boolean not null default false,
  add column if not exists microsoft_manager_synced_at timestamptz;

comment on column public.foundry_host_grants.manual_granted is
  'Authority granted by a human out-of-band (scripts/manage-foundry-host.mjs or grantFoundryHost). The Microsoft manager sync NEVER sets or clears this.';
comment on column public.foundry_host_grants.microsoft_manager_granted is
  'Authority derived from Microsoft Entra: this user had >= 1 current directReport at the last COMPLETE sync. Set and cleared ONLY by the manager sync.';
comment on column public.foundry_host_grants.microsoft_manager_synced_at is
  'When Microsoft manager entitlement was last evaluated for this user. Used to avoid re-probing Graph on every app open; never an authority by itself.';

-- ---------------------------------------------------------------------------
-- 2. BACKFILL
--
-- Every grant that exists BEFORE this migration was necessarily created by a
-- human: the sync does not exist yet, and nothing else has ever written this
-- table. Marking the pre-existing active grants as manual is therefore a
-- statement of fact, not a guess -- and it is what preserves the Founder.
--
-- Guarded so a re-run cannot re-mark a row the sync has since changed.
-- ---------------------------------------------------------------------------

update public.foundry_host_grants
   set manual_granted = true
 where status = 'active'
   and manual_granted = false
   and microsoft_manager_granted = false;

-- ---------------------------------------------------------------------------
-- 3. THE INVARIANT
--
-- Effective Host == at least one source grants. Revoked rows hold no source.
-- Applied AFTER the backfill so the one live row satisfies it at creation.
-- ---------------------------------------------------------------------------

alter table public.foundry_host_grants
  drop constraint if exists foundry_host_grants_effective_check;

alter table public.foundry_host_grants
  add constraint foundry_host_grants_effective_check
  check ((status = 'active') = (manual_granted or microsoft_manager_granted));

-- ---------------------------------------------------------------------------
-- 4. WHICH BTY ACCOUNTS CARRY A MICROSOFT IDENTITY
--
-- The sync must ask Microsoft about people, and the only people it may ask
-- about are those who ALREADY have a BTY account -- a manager who has never
-- opened BTY has no user id to grant, and fabricating one is forbidden.
--
-- `auth.identities` is not reachable through PostgREST (measured: 404), and the
-- alternative in this codebase -- auth.admin.listUsers({perPage:1000}) -- would
-- pull every user's identity_data into application memory. This returns ONLY
-- the (user_id, tid, oid) tuple: no email, no sub, no provider_id, no claims.
--
-- The nested claim paths are the same ones pinned by
-- 20260829000000_bty_microsoft_identity_resolver_v1.sql. The top-level
-- identity_data->>'oid' path and provider_id/sub are measurably wrong here and
-- fail SILENTLY by returning zero rows.
-- ---------------------------------------------------------------------------

create or replace function public.bty_list_microsoft_linked_users()
returns table (user_id uuid, tenant_id text, aad_object_id text)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select
    i.user_id,
    lower(i.identity_data->'custom_claims'->>'tid') as tenant_id,
    lower(i.identity_data->'custom_claims'->>'oid') as aad_object_id
  from auth.identities i
  where i.provider = 'azure'
    and i.identity_data->'custom_claims'->>'tid' is not null
    and i.identity_data->'custom_claims'->>'oid' is not null;
$$;

revoke all on function public.bty_list_microsoft_linked_users() from public;
revoke all on function public.bty_list_microsoft_linked_users() from anon;
revoke all on function public.bty_list_microsoft_linked_users() from authenticated;
grant execute on function public.bty_list_microsoft_linked_users() to service_role;

comment on function public.bty_list_microsoft_linked_users() is
  'Every BTY account that carries a Microsoft identity, as (user_id, tenant_id, aad_object_id) ONLY. Never returns email, sub, provider_id or identity_data. Used by the Microsoft manager sync to bound its Graph probes to people who already have a BTY account -- an upstream manager who has never activated BTY is deliberately invisible here, because no user id exists to grant.';
