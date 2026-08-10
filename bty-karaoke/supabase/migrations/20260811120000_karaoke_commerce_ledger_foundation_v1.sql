-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — BUILD 26L: APP STORE COMMERCE LEDGER FOUNDATION V1 (Track B, Slice 2).
--
-- Creates the server-side representation paid Timed Pass commerce will need, while
-- changing ZERO live purchase behaviour. Isolated bty-karaoke Supabase project
-- (ref zycwaqignioawtqynopj). Additive + idempotent + forward-only; no prior migration
-- is rewritten, no existing pass row is deleted, recreated, or re-timestamped.
--
-- WHAT THIS MIGRATION DELIBERATELY IS NOT: there is still no purchase endpoint, no
-- StoreKit client, no App Store Server Notification receiver, no refund runtime, and no
-- App Store Connect product. Nobody can buy anything when this applies. It only makes
-- future purchases REPRESENTABLE, so that Slice 3 (server Apple transaction
-- verification) has an authoritative place to write and cannot invent one under time
-- pressure.
--
-- AUTHORITY CHAIN (measured, not assumed, before this file was written):
--   * BUILD 18C  — product/pricing contract: Consumable, three fixed durations, purchase
--                  never activates a pass, one verified transaction -> at most one paid
--                  grant, promotional passes carry NO Apple transaction identity.
--   * Track B0   — FD-1 (keep the com.btydaily.norebang.pass.* IDs despite the bundle
--                  prefix differing), FD-3 (uniqueness is per ENVIRONMENT), FD-4 (purchase
--                  FKs must never CASCADE from karaoke_accounts).
--   * BUILD 26E  — karaoke_accounts rows are NEVER hard-deleted; they become anonymized
--                  tombstones. purchase_owner_ref already exists as the NOT NULL, UNIQUE,
--                  deletion-stable opaque commerce handle. This migration CONSUMES that
--                  authority; it does not re-create or alter it.
--
-- WHAT BUILD 26E ALREADY SATISFIED, AND IS THEREFORE ABSENT HERE ON PURPOSE:
--   * purchase_owner_ref / authority_ref  — created in 20260809120000. Not touched.
--   * timed_pass_status_time_chk          — the BUILD 18C G5 relaxation that makes
--     refund-after-use representable was ALREADY applied in 20260809120000. Re-relaxing
--     it would churn a constraint for cosmetic resemblance to a superseded plan, so this
--     migration only PINS the current shape in tests. Not touched.
--   * account-deletion retention          — survives by tombstone, not by FK behaviour.
--
-- THE UNIQUENESS DECISION THAT MATTERS (FD-3). Uniqueness is (environment,
-- apple_transaction_id), NOT apple_transaction_id alone. Apple guarantees transaction-ID
-- uniqueness only WITHIN an environment; sandbox IDs are not drawn from a range promised
-- never to intersect production. Under a bare-ID constraint a sandbox collision would
-- cause a REAL production purchase to be silently rejected as a duplicate — the customer
-- is charged and receives nothing, and the failure is indistinguishable from correct
-- idempotency. The DB index is the authority here; an application-level check is not.
--
-- NO PRICE ANYWHERE. There is deliberately no price, currency, or amount column. Paid
-- duration is derived ONLY as: verified StoreKit productId -> karaoke_product_catalog ->
-- duration_seconds. A client-supplied duration, and a price, must never be able to become
-- entitlement authority. StoreKit Product.displayPrice remains the display authority.
--
-- ROLLBACK: additive. The two new tables are inert while unused and can be dropped; the
-- three grant columns can be dropped with their two constraints. To revert the audit
-- action domain, restore the six-value CHECK from 20260728120000. Nothing in this file
-- rewrites existing data beyond the one provenance backfill in section 4, which sets
-- previously-nonexistent columns only and touches no id, status, or timestamp.

-- ── 1. STOREKIT PRODUCT CATALOG ──────────────────────────────────────────────
--
-- The SERVER's duration authority. The native client will eventually send a signed
-- transaction naming a productId; the server resolves duration HERE and never from
-- anything the client said. product_code is the internal stable key (safe to reference);
-- storekit_product_id is Apple's immutable identifier (FD-1).
create table if not exists public.karaoke_product_catalog (
  id                  uuid primary key default gen_random_uuid(),
  product_code        text not null,
  -- NULL only for promotional entries, which are BTY server grants and are not StoreKit
  -- products at all (BUILD 18C section 1). Paid rows must carry one.
  storekit_product_id text,
  pass_type           text not null check (pass_type in ('ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS')),
  duration_seconds    int  not null check (duration_seconds > 0),
  product_kind        text not null check (product_kind in ('PAID_CONSUMABLE', 'PROMOTIONAL')),
  is_paid             boolean not null,
  -- RATIFIED MEANING (BUILD 26L, Founder decision): TRUE means the SERVER is
  -- OPERATIONALLY AUTHORIZED to accept NEW paid transactions for this product ID through
  -- the commerce runtime, and to turn a successfully verified transaction into entitlement
  -- processing. It does NOT mean any of: the row exists; the product contract is known;
  -- an App Store Connect product exists; StoreKit happens to return the product.
  -- A product may become true ONLY when ALL of these hold: (1) the product exists and
  -- configures correctly in App Store Connect, (2) the server verification runtime for
  -- that product is deployed, (3) commerce processing is intentionally enabled. None of
  -- the three holds in Slice 2, so all three seeded rows are false.
  -- false does NOT mean the contract product is invalid. It means new paid transaction
  -- processing is not yet operationally enabled.
  is_active           boolean not null default false,
  display_order       int  not null default 0,
  contract_version    text not null default 'BUILD_18C_V1',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Duration is pinned to the pass type, exactly as timed_pass_duration_matches_type
  -- pins it on the grant. The two tables therefore cannot drift into disagreeing about
  -- what "4 hours" means.
  constraint karaoke_product_catalog_duration_matches_type check (
    (pass_type = 'ONE_HOUR'         and duration_seconds = 3600)
    or (pass_type = 'FOUR_HOURS'       and duration_seconds = 14400)
    or (pass_type = 'TWENTY_FOUR_HOURS' and duration_seconds = 86400)
  ),
  -- Paid and promotional are structurally different rows, not a boolean flag on one
  -- shape: a paid row MUST name a StoreKit product, a promotional row MUST NOT.
  constraint karaoke_product_catalog_kind_chk check (
    (product_kind = 'PAID_CONSUMABLE' and is_paid = true  and storekit_product_id is not null)
    or (product_kind = 'PROMOTIONAL'     and is_paid = false and storekit_product_id is null)
  )
);

create unique index if not exists karaoke_product_catalog_code_idx
  on public.karaoke_product_catalog (product_code);
-- Apple Product IDs are immutable and globally meaningful; two catalog rows claiming the
-- same one would make duration resolution ambiguous at the exact moment money is real.
create unique index if not exists karaoke_product_catalog_storekit_idx
  on public.karaoke_product_catalog (storekit_product_id);

alter table public.karaoke_product_catalog enable row level security;
revoke all on table public.karaoke_product_catalog from public, anon, authenticated;
-- SELECT only, even for service_role: the catalog is a CONTRACT, not runtime state.
-- Changing a duration, adding a product, or flipping is_active is a contract change and
-- must arrive as a reviewed migration, never as a runtime write from a request handler.
grant select on table public.karaoke_product_catalog to service_role;

drop trigger if exists karaoke_product_catalog_touch_updated_at on public.karaoke_product_catalog;
create trigger karaoke_product_catalog_touch_updated_at
  before update on public.karaoke_product_catalog
  for each row execute function public.touch_updated_at();

-- ── 2. CATALOG SEED (BUILD 18C section 2 / Track B0 FD-1) ────────────────────
--
-- These three Product IDs are RATIFIED and immutable. is_active = false under the ratified
-- meaning above: paid transaction processing is not operationally enabled, no App Store
-- Connect product has been created, and no verification runtime is deployed. This seed
-- claims none of those things — it records the product CONTRACT, nothing more.
-- Promotional (Welcome / Referral) catalog rows are deliberately NOT seeded here: they
-- need the unactivated-expiry and eligibility modelling of BUILD 18C G6/G7, which is a
-- later slice. The table supports them structurally; nothing pretends they are ready.
insert into public.karaoke_product_catalog
  (product_code, storekit_product_id, pass_type, duration_seconds, product_kind, is_paid, is_active, display_order)
values
  ('PASS_1H',  'com.btydaily.norebang.pass.1hour',  'ONE_HOUR',          3600,  'PAID_CONSUMABLE', true, false, 10),
  ('PASS_4H',  'com.btydaily.norebang.pass.4hour',  'FOUR_HOURS',        14400, 'PAID_CONSUMABLE', true, false, 20),
  ('PASS_24H', 'com.btydaily.norebang.pass.24hour', 'TWENTY_FOUR_HOURS', 86400, 'PAID_CONSUMABLE', true, false, 30)
on conflict (product_code) do nothing;

-- ── 3. APPLE PURCHASE LEDGER ─────────────────────────────────────────────────
--
-- The financial record. It must outlive the account, the room, the event, and the pass.
create table if not exists public.karaoke_apple_purchases (
  id                            uuid primary key default gen_random_uuid(),
  -- RESTRICT, NEVER CASCADE (Track B0 FD-4.3). BUILD 26E makes karaoke_accounts a
  -- tombstone rather than a deleted row, so this target always exists and RESTRICT never
  -- fires in normal operation. It is here as the structural backstop for the one thing
  -- that must never happen quietly: a hard delete taking the financial ledger with it.
  account_id                    uuid not null references public.karaoke_accounts(id) on delete restrict,
  -- The BUILD 26E opaque commerce handle, snapshotted at purchase time. This — not the
  -- raw account UUID — is what StoreKit appAccountToken will carry, which is the entire
  -- reason 26E created a separate random UUID instead of reusing the primary key.
  purchase_owner_ref            uuid not null,
  -- FD-3: sandbox and production are SEPARATE ID SPACES. See the header.
  environment                   text not null check (environment in ('Sandbox', 'Production')),
  apple_transaction_id          text not null,
  apple_original_transaction_id text,
  apple_app_transaction_id      text,
  storekit_product_id           text not null,
  -- Resolved catalog row. RESTRICT: a catalog row that a real purchase points at can
  -- never be deleted out from under the financial record.
  product_code                  text references public.karaoke_product_catalog (product_code) on delete restrict,
  purchase_date                 timestamptz,
  quantity                      int not null default 1 check (quantity >= 1),
  -- Retained signed-transaction evidence (JWS) plus a digest for cheap comparison. The
  -- payload is what makes a verification result auditable after the fact rather than a
  -- boolean somebody has to trust.
  signed_transaction_payload    text,
  signed_transaction_sha256     text,
  verification_status           text not null default 'PENDING'
                                  check (verification_status in ('PENDING', 'VERIFIED', 'FAILED', 'REVOKED')),
  verified_at                   timestamptz,
  verification_failure_reason   text,
  verification_attempts         int not null default 0 check (verification_attempts >= 0),
  -- Entitlement outcome, kept separate from verification: a transaction can verify and
  -- still not have produced a grant yet. Collapsing the two is how double-grants happen.
  grant_status                  text not null default 'NOT_GRANTED'
                                  check (grant_status in ('NOT_GRANTED', 'GRANTED', 'GRANT_REVOKED')),
  granted_seconds               int check (granted_seconds is null or granted_seconds > 0),
  pass_grant_id                 uuid references public.timed_access_pass_grants (id) on delete restrict,
  processed_at                  timestamptz,
  refunded_at                   timestamptz,
  revoked_at                    timestamptz,
  revocation_reason             text,
  source                        text not null default 'STOREKIT_CLIENT'
                                  check (source in ('STOREKIT_CLIENT', 'APP_STORE_SERVER_NOTIFICATION', 'MANUAL_RECONCILIATION')),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  -- A granted purchase must say what it granted and which pass it produced; an
  -- ungranted one must claim neither. Prevents "GRANTED" rows that point at nothing.
  constraint karaoke_apple_purchases_grant_linkage_chk check (
    (grant_status = 'NOT_GRANTED' and pass_grant_id is null and granted_seconds is null)
    or (grant_status in ('GRANTED', 'GRANT_REVOKED') and pass_grant_id is not null and granted_seconds is not null)
  )
);

-- FD-3, and the single most important object in this migration. Concurrency safety for
-- "one Apple transaction -> at most one purchase row" lives HERE, in the database, not in
-- a read-then-insert in a request handler that two retries can interleave through.
create unique index if not exists karaoke_apple_purchases_env_txn_idx
  on public.karaoke_apple_purchases (environment, apple_transaction_id);

-- BUILD 18C invariant 1: one verified Apple transaction -> AT MOST ONE paid pass grant.
-- This half stops two purchases from claiming the same grant; the timed_pass side
-- (section 4) stops two grants from claiming the same purchase. Both halves are needed
-- for the relation to actually be 1:1.
create unique index if not exists karaoke_apple_purchases_pass_grant_idx
  on public.karaoke_apple_purchases (pass_grant_id) where pass_grant_id is not null;

create index if not exists karaoke_apple_purchases_account_idx
  on public.karaoke_apple_purchases (account_id, created_at desc);
create index if not exists karaoke_apple_purchases_owner_ref_idx
  on public.karaoke_apple_purchases (purchase_owner_ref);
-- Refund/renewal notifications arrive keyed by the ORIGINAL transaction id, so the
-- reconciliation path needs this to find the row it is about.
create index if not exists karaoke_apple_purchases_original_txn_idx
  on public.karaoke_apple_purchases (environment, apple_original_transaction_id)
  where apple_original_transaction_id is not null;
create index if not exists karaoke_apple_purchases_unsettled_idx
  on public.karaoke_apple_purchases (created_at) where verification_status = 'PENDING';

alter table public.karaoke_apple_purchases enable row level security;
revoke all on table public.karaoke_apple_purchases from public, anon, authenticated;
-- service_role ONLY. The native client will submit a signed JWS to a server endpoint and
-- must NEVER be able to write a purchase or an entitlement itself — a client that can
-- insert its own purchase row has not been sold anything, it has been asked politely.
grant select, insert, update on table public.karaoke_apple_purchases to service_role;

drop trigger if exists karaoke_apple_purchases_touch_updated_at on public.karaoke_apple_purchases;
create trigger karaoke_apple_purchases_touch_updated_at
  before update on public.karaoke_apple_purchases
  for each row execute function public.touch_updated_at();

-- ── 4. PAID / PROMOTIONAL DISTINCTION ON THE GRANT (BUILD 18C G1) ────────────
--
-- Added nullable first, backfilled from ACTUAL issuance provenance, and only then made
-- NOT NULL — so the migration cannot silently invent a classification for a row it
-- cannot prove.
alter table public.timed_access_pass_grants
  add column if not exists source_type       text,
  add column if not exists is_paid           boolean,
  add column if not exists apple_purchase_id uuid references public.karaoke_apple_purchases (id) on delete restrict;

-- BACKFILL. Scoped to rows with PROVEN non-paid provenance: every pre-commerce grant was
-- issued by a Manager operator (issued_by_manager, e.g. 'bty_mgr') through
-- issue_timed_access_pass, which is the ONLY issuance path that exists. Age is not
-- evidence and "StoreKit does not exist yet" is not evidence; the operator ref is.
update public.timed_access_pass_grants
   set source_type = 'MANUAL_PROMOTIONAL',
       is_paid     = false
 where source_type is null
   and issued_by_manager is not null
   and issued_by_manager <> '';

-- FAIL CLOSED. If any grant carries no issuance provenance, it cannot be proven non-paid,
-- and guessing is precisely the failure this section exists to prevent. Refuse to apply
-- and say exactly how many rows are involved, rather than let the NOT NULL below fail
-- with a message that explains nothing.
do $$
declare v_unclassified bigint;
begin
  select count(*) into v_unclassified
    from public.timed_access_pass_grants where source_type is null;
  if v_unclassified > 0 then
    raise exception
      'BUILD 26L: % timed_access_pass_grants row(s) carry no issuance provenance and cannot be proven non-paid. Refusing to apply — classify them explicitly first.',
      v_unclassified using errcode = 'restrict_violation';
  end if;
end $$;

alter table public.timed_access_pass_grants
  alter column source_type set default 'MANUAL_PROMOTIONAL',
  alter column source_type set not null,
  alter column is_paid     set default false,
  alter column is_paid     set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'timed_pass_source_type_chk') then
    alter table public.timed_access_pass_grants
      add constraint timed_pass_source_type_chk
      check (source_type in ('PAID', 'WELCOME', 'REFERRAL', 'MANUAL_PROMOTIONAL'));
  end if;
  -- BUILD 18C invariant 13: a promotional pass contains NO Apple transaction identity.
  -- Stated structurally, so it holds even if a future code path forgets it.
  if not exists (select 1 from pg_constraint where conname = 'timed_pass_paid_linkage_chk') then
    alter table public.timed_access_pass_grants
      add constraint timed_pass_paid_linkage_chk
      check (
        (source_type = 'PAID'  and is_paid = true  and apple_purchase_id is not null)
        or (source_type <> 'PAID' and is_paid = false and apple_purchase_id is null)
      );
  end if;
end $$;

-- The other half of the 1:1 relation (see section 3): two grants can never claim the
-- same Apple purchase.
create unique index if not exists timed_pass_apple_purchase_idx
  on public.timed_access_pass_grants (apple_purchase_id) where apple_purchase_id is not null;
create index if not exists timed_pass_source_type_idx
  on public.timed_access_pass_grants (source_type, created_at desc);

-- ── 5. AUDIT ACTION DOMAIN (BUILD 18C section 8 economic events) ─────────────
--
-- STRICT SUPERSET of the deployed six values, so every existing audit row remains valid
-- and the append-only trigger is never involved (this is DDL, not a row mutation).
-- BUILD 26L EMITS NONE OF THE NEW VALUES — no purchase endpoint exists. It only makes
-- them representable, so Slice 3 does not have to widen a constraint while shipping a
-- money path.
do $$
declare v_name text;
begin
  for v_name in
    select conname
      from pg_constraint
     where conrelid = 'public.timed_access_pass_audit'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%ISSUED%'
  loop
    execute format('alter table public.timed_access_pass_audit drop constraint %I', v_name);
  end loop;
  alter table public.timed_access_pass_audit
    add constraint timed_access_pass_audit_action_chk
    check (action in ('ISSUED', 'SELECTED', 'DESELECTED', 'ACTIVATED', 'EXPIRED', 'REVOKED',
                      'PURCHASE_VERIFIED', 'REFUND_RECEIVED', 'REVOKED_AFTER_USE'));
end $$;
