-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — CROSS-PLATFORM IDENTITY V1. Splits "who the person is" from "how
-- they proved it", so ONE karaoke account can hold MULTIPLE verified external
-- identities (Apple today, Google for Android, more later). Isolated bty-karaoke
-- Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent; the
-- already-applied 20260720120000 is NOT rewritten.
--
-- Why: 20260720120000 put (provider, provider_subject) directly on the account and
-- constrained provider to 'apple'. That makes a person who signs in with Google on
-- Android a DIFFERENT account from the same person on iOS — which would silently
-- fork workspaces and Room ownership. Adding another provider string would not fix
-- it; the relationship is genuinely one-account-to-many-identities.
--
-- Adds:
--   1. karaoke_account_identities  — the verified-identity rows
--   2. backfill of every existing Apple account identity (idempotent)
--   3. removal of the apple-only CHECK on the deprecated account columns
--   4. relaxation of the deprecated account columns to NULLable
--
-- The old karaoke_accounts.provider / provider_subject columns REMAIN as deprecated
-- compatibility columns and are deliberately NOT dropped: deployed code still reads
-- them until the provider-neutral path is fully rolled out. They must not be used
-- for new authorization decisions.
--
-- Rollback:
--   drop table if exists public.karaoke_account_identities;
--   (the CHECK/NOT NULL relaxations are intentionally not re-tightened)

-- 1. IDENTITIES ---------------------------------------------------------------
-- One row per verified external identity. `provider_subject` is the provider's
-- stable subject (Apple `sub`, Google `sub`) — NEVER an email. Email is stored
-- only as non-authoritative display/recovery metadata and must never be used to
-- match, merge, or authorize accounts (two providers can report the same address
-- without proving they are the same person).
create table if not exists public.karaoke_account_identities (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.karaoke_accounts(id) on delete cascade,
  provider          text not null check (provider in ('apple', 'google')),
  provider_subject  text not null,
  email             text,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz
);

-- THE identity invariant: a (provider, subject) pair belongs to exactly ONE
-- account, forever. This is what stops an identity being moved or re-pointed to a
-- different account, and what makes linking safe to attempt concurrently.
create unique index if not exists karaoke_account_identities_provider_subject_idx
  on public.karaoke_account_identities (provider, provider_subject);

-- Account lookup (list a Host's login methods) + one row per provider per account.
create index if not exists karaoke_account_identities_account_idx
  on public.karaoke_account_identities (account_id);
create unique index if not exists karaoke_account_identities_account_provider_idx
  on public.karaoke_account_identities (account_id, provider);

alter table public.karaoke_account_identities enable row level security;
revoke all on public.karaoke_account_identities from anon, authenticated;

-- 2. BACKFILL -----------------------------------------------------------------
-- Move every existing account's Apple identity into the new table. Idempotent via
-- the unique index: re-running inserts nothing and cannot duplicate an identity.
insert into public.karaoke_account_identities (account_id, provider, provider_subject, email, created_at)
select a.id, a.provider, a.provider_subject, a.email, a.created_at
  from public.karaoke_accounts a
 where a.provider is not null
   and a.provider_subject is not null
on conflict (provider, provider_subject) do nothing;

-- 3/4. DEPRECATE THE PROVIDER COLUMNS ON THE ACCOUNT --------------------------
-- Drop the apple-only CHECK so the canonical account row carries no
-- provider-specific authorization key, and relax NOT NULL so provider-neutral
-- accounts can be created without them. The columns stay for compatibility.
do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public'
     and rel.relname = 'karaoke_accounts'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%provider%apple%';
  if v_conname is not null then
    execute format('alter table public.karaoke_accounts drop constraint %I', v_conname);
  end if;
end $$;

alter table public.karaoke_accounts alter column provider drop not null;
alter table public.karaoke_accounts alter column provider_subject drop not null;

comment on column public.karaoke_accounts.provider is
  'DEPRECATED (Cross-Platform Identity V1) — use karaoke_account_identities.';
comment on column public.karaoke_accounts.provider_subject is
  'DEPRECATED (Cross-Platform Identity V1) — use karaoke_account_identities.';
