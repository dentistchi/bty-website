# BUILD 26L — App Store Commerce Ledger Foundation V1

**Status:** `PASS / CLOSED`
**Closed:** 2026-08-10, when the migration was applied to production, the 38 legacy grants were
proven byte-identical before and after, and every post-apply invariant was measured live.
**Scope:** Track B **Slice 2** — commerce database ledger. No StoreKit, no purchase endpoint, no
App Store Connect product, no refund runtime, no Worker deploy, no native change.
**Isolated project:** bty-karaoke Supabase (ref `zycwaqignioawtqynopj`).

> **This document does NOT assert that anything can be purchased.** It asserts that a purchase is
> now *representable*. Purchase runtime, StoreKit, ASC products and refunds all remain OPEN.

---

## 1. Final verdict

`PASS / CLOSED`

The commerce ledger foundation is live in production. Existing Timed Pass history is retained
unchanged, no purchase exists, and paid transaction processing is off because all three catalog
products are `is_active = false`.

## 2. Scope / explicit non-scope

**In scope.** StoreKit product catalog; Apple purchase ledger; environment-qualified transaction
uniqueness; paid/promotional distinction on the grant; purchase→grant linkage; legacy backfill;
audit-domain widening; RLS/ACL.

**Explicitly NOT in scope.** `POST /api/host/purchases/apple/verify`; `apple-iap.server.ts`;
`StoreKitClient.swift`; `PurchaseView.swift`; `import StoreKit`; `.storekit` configuration;
`Transaction.updates` / `.unfinished` / `finish()`; App Store Server Notifications V2; refund
handling; ASC IAP product creation; sandbox testers; purchase CTA; web checkout; TestFlight
purchase testing. None was written.

## 3. Baseline

```
monorepo   pre-build HEAD = origin/main = 832ee8883b47616b666491f20fe1eee564ff31f9  (0 0)
live Worker  ddc21282770d   (workers.dev and norebang.btydaily.com) — UNCHANGED by this build
native       a472f6d86effbe26cd8919fbd0718bbfc66cecd7 = origin/main (0 0)
             CFBundleVersion 90 · MARKETING_VERSION 1.0 · NO source change, NO build bump
             xcscheme sha256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
```

`832ee888` is docs-only, so the live Worker legitimately predates it. Not drift.

## 4. Track B0 → BUILD 26E reconciliation

The original Track B0 Slice-2 description was partly **stale** and was not implemented literally.

| Old B0 Slice-2 item | Verdict |
|---|---|
| `purchase_owner_ref` | **ALREADY SATISFIED BY 26E.** Measured live: 24/24 non-null, 24/24 distinct, 0 equal to `authority_ref`, **12/12 tombstones retain it**. Not re-created, not altered. |
| `timed_pass_status_time_chk` | **ALREADY SATISFIED BY 26E.** Refund-after-use is already representable. **Not re-relaxed** — pinned by a regression test and re-verified live post-apply. |
| account tombstone / deletion retention | **ALREADY SATISFIED BY 26E.** |
| commerce tables · paid/manual distinction · purchase linkage · catalog | **STILL REQUIRED** → delivered here. |

**Superseded B0 forensic claim, deliberately not propagated.** Track B0 §4 argued the timed-pass
audit trigger could not protect against cascade deletion. BUILD 26E's catalog forensics corrected
that: the final retention authority is that **`karaoke_accounts` is never hard-deleted**, so
financial and audit retention survives by retained tombstone, not by FK behaviour. BUILD 26L
conforms to the current 26E schema.

## 5. Ratified meaning of `karaoke_product_catalog.is_active`

**`TRUE` means the SERVER is operationally authorized to accept NEW paid transactions for this
product ID through the commerce runtime, and to turn a successfully verified transaction into
entitlement processing.**

It does **not** mean: the row exists; the product contract is known; an App Store Connect product
exists; or StoreKit happens to return the product. A product may become `true` only when **all**
hold: (1) the ASC product exists and configures correctly, (2) the server verification runtime for
it is deployed, (3) commerce processing is intentionally enabled.

None holds in Slice 2, so `PASS_1H`, `PASS_4H`, `PASS_24H` are all `false`.

> **`is_active = false` does NOT mean the contract product is invalid.** It means new paid
> transaction processing is not yet operationally enabled.

## 6. Production pass forensics (pre-apply, aggregate only)

```
total                        38          (Track B0's "5 rows" was STALE)
pass_type    ONE_HOUR 35 · FOUR_HOURS 2 · TWENTY_FOUR_HOURS 1
status       EXPIRED 19 · AVAILABLE 16 · REVOKED 2 · ACTIVE 1
provenance   issued_by_manager = 'bty_mgr' on 38 / 38
proven MANUAL_PROMOTIONAL 38 · ambiguous 0
audit        111 rows, six deployed actions only
commerce     karaoke_apple_purchases ABSENT · karaoke_product_catalog ABSENT
```

Classified on **actual issuance provenance**, not on age and not on "StoreKit does not exist yet".

**A tool that lied, and how it was caught.** The first inventory probe used PostgREST with
`head: true` and reported both commerce tables **PRESENT**. Re-probing with a
`definitely_not_a_real_table_xyz` negative control showed all three return the same `PGRST205` —
the `head:true` path had swallowed the error. Every subsequent existence claim was measured
against `pg_class` with a known-present table as a non-vacuity control.

The single `ACTIVE` grant was **9 days past its `expires_at`** (expiry is lazy — no background
job), so it was stable across the apply window rather than a concurrency hazard.

## 7. Migration design

```
supabase/migrations/20260811120000_karaoke_commerce_ledger_foundation_v1.sql
sha256  4dc147d249e9d38853dc960ff20e368671889acb3951564ee3de7f3992884328
```

Forward-only, additive, idempotent (proven by three consecutive applies). No prior migration is
rewritten; no pass row is deleted, recreated or re-timestamped.

The reviewed candidate was `71db8ded…`. The only change before apply was the §5 `is_active`
comment clarification: the pre-edit file was reconstructed and hashed back to `71db8ded…` exactly,
and the **executable SQL digest is identical** (`b6083fcc…`, 159 executable lines, 18 changed lines,
**0 non-comment**).

## 8. Product catalog

| product_code | storekit_product_id | pass_type | seconds | is_paid | is_active |
|---|---|---|--:|---|---|
| PASS_1H | `com.btydaily.norebang.pass.1hour` | ONE_HOUR | 3600 | true | **false** |
| PASS_4H | `com.btydaily.norebang.pass.4hour` | FOUR_HOURS | 14400 | true | **false** |
| PASS_24H | `com.btydaily.norebang.pass.24hour` | TWENTY_FOUR_HOURS | 86400 | true | **false** |

The IDs are Track B0 **FD-1** and immutable; the prefix mismatch against `com.bty.BTYNorebangAdmin`
is knowingly accepted. `duration_matches_type` mirrors the grant's own constraint so the two tables
cannot drift about what "4 hours" means. `product_kind` makes paid and promotional structurally
different rows rather than one shape with a flag.

**App Store Connect products created: NO.** A database seed can never establish otherwise.
Promotional (Welcome/Referral) catalog rows are deliberately **not** seeded — they need BUILD 18C
G6/G7 modelling, and half-modelling them would misrepresent readiness.

**No price authority.** There is no price, currency or amount column anywhere. Paid duration
resolves only as verified `productId` → catalog → `duration_seconds`.

## 9. Apple purchase ledger

`public.karaoke_apple_purchases` retains: account reference, `purchase_owner_ref`, environment,
transaction / original-transaction / app-transaction ids, StoreKit product id, resolved
`product_code`, purchase date, quantity, signed JWS payload + digest, verification status /
timestamp / failure reason / attempts, grant status, granted seconds, `pass_grant_id`,
`processed_at`, `refunded_at`, `revoked_at`, revocation reason, source, timestamps.

`grant_linkage_chk` forbids a `GRANTED` row that points at nothing, and an ungranted row that
claims a grant. Verification status and grant status are kept **separate** — collapsing them is how
double-grants happen.

## 10. Environment-qualified transaction uniqueness (FD-3)

```sql
CREATE UNIQUE INDEX karaoke_apple_purchases_env_txn_idx
  ON public.karaoke_apple_purchases (environment, apple_transaction_id)
```

Apple guarantees transaction-ID uniqueness only **within** an environment. Under a bare-ID unique
index, a sandbox ID colliding with a production ID would cause the **production purchase to be
silently rejected as a duplicate** — the customer is charged and receives nothing, and the failure
is indistinguishable from correct idempotency. Concurrency safety lives in the index, not in a
read-then-insert two retries can interleave through.

Proven locally in both directions: a same-environment duplicate is **rejected**; the same
transaction id in `Sandbox` is **accepted**.

## 11. `purchase_owner_ref` and the future `appAccountToken`

BUILD 26E created `purchase_owner_ref` as an independent random UUID — not derived from
`account_id`, not equal to `authority_ref` — precisely so Apple never sees the account primary key.
BUILD 26L **consumes** that authority: the ledger snapshots it per purchase, and it is the value a
future StoreKit `appAccountToken` should carry. It is not altered here, and the deletion RPC does
not rotate it, so it survives tombstoning (12/12 measured).

## 12. Account-retention semantics

Every foreign key in the purchase ledger is `ON DELETE RESTRICT` — `account_id`, `pass_grant_id`
and `product_code`. Never `CASCADE` (Track B0 **FD-4.3**).

Because 26E makes the account a tombstone rather than a deleted row, RESTRICT never fires in normal
operation; it exists as the structural backstop for the one thing that must never happen quietly.

Proven locally **with a negative control**, so the proof is not the audit trigger's: an account
holding only a purchase **cannot** be hard-deleted (blocked by
`karaoke_apple_purchases_account_id_fkey`), while a purchase-free account deletes fine.

## 13. Legacy backfill

```
expected affected rows   38
actual affected rows     UPDATE 38
result                   source_type MANUAL_PROMOTIONAL 38 · is_paid false 38 · apple_purchase_id null 38
```

The `UPDATE` is scoped to rows with proven provenance (`issued_by_manager` set). A `DO` block then
**refuses to apply** if any row remains unclassified, rather than letting a later `NOT NULL` fail
with a message that explains nothing:

```
ERROR: BUILD 26L: 1 timed_access_pass_grants row(s) carry no issuance provenance
       and cannot be proven non-paid. Refusing to apply — classify them explicitly first.
```

Verified by injecting one provenance-less row: under single-transaction apply the whole file
aborted with **0 tables and 0 columns committed** and the ledger intact.

## 14. Historical preservation

Digest over `id, account_id, pass_type, duration_seconds, status, activated_at, expires_at,
revoked_at, created_at`, measured **on production** immediately before and after apply:

```
BEFORE  c90acf548a7739636b2ac558100607c6   38 rows
AFTER   c90acf548a7739636b2ac558100607c6   38 rows   IDENTICAL
status  EXPIRED 19 · AVAILABLE 16 · REVOKED 2 · ACTIVE 1   unchanged
```

The local fixture digest was **not** reused as production proof; production was measured twice.

## 15. Audit-domain widening

The action CHECK became a **strict superset** of the deployed six —
`PURCHASE_VERIFIED`, `REFUND_RECEIVED`, `REVOKED_AFTER_USE` added — so every existing audit row
stays valid and the append-only trigger is never involved (this is DDL, not a row mutation).

**BUILD 26L emits none of them.** Measured post-apply: **0** rows carry any new action; the audit
remains 111 rows across the original six. Making a value representable is not emitting it.

## 16. RLS / privileges

Both tables have RLS enabled and `public, anon, authenticated` revoked. Measured live via
`aclexplode`: **only `postgres` and `service_role` hold any privilege; `anon`, `authenticated` and
`PUBLIC` hold nothing on either commerce table.** That is the boundary that matters — the native
client will submit a signed JWS to a server endpoint and can never write a purchase or an
entitlement itself.

> **Measured limitation, recorded rather than implied.** Supabase's `pg_default_acl` grants
> `arwdDxtm` to `service_role` on every new table in `public`. The migration grants the catalog only
> `SELECT`, but `service_role` retains write access in effect — exactly as it does on every
> pre-existing table in this database (`karaoke_accounts`, `timed_access_pass_grants`,
> `timed_access_pass_audit` all measure identically). Making the catalog genuinely read-only needs
> an explicit `REVOKE` and is a database-wide policy question, not a BUILD 26L one. The schema test
> is named for what it actually pins — that the migration grants no write privilege — not for an
> enforcement it does not deliver.

## 17. Local integration

Isolated local Supabase (ports 54421/54422), all real migrations, against a fixture shaped exactly
like the measured production population (38 rows; 35/2/1 by type; 19/16/2/1 by status; 100 %
manager provenance) plus a tombstoned account holding a pass and a **revoked-after-use** row that
is only insertable because of the 26E relaxation.

| Case | Result |
|---|---|
| baseline → apply → rows preserved | identity digest identical |
| catalog rows match contract | 3/3 |
| duplicate same-environment transaction | rejected |
| same txn id Sandbox vs Production | accepted (FD-3) |
| retention across tombstone; hard delete | blocked by the ledger FK, with negative control |
| `anon` / `authenticated` insert | permission denied, both |
| migration grants nothing | 0 purchases, 0 paid grants, 38 total |
| idempotency | 3 consecutive applies → 3 catalog rows, 38 grants, exactly 1 audit constraint |
| existing RPCs post-migration | `issue_timed_access_pass` → AVAILABLE, auto-classified `MANUAL_PROMOTIONAL`/`is_paid=false`/no Apple id via defaults; `select_timed_access_pass` → SELECTED; replay → `reused:true`, no duplicate |

## 18. Mutation proofs

```
M1 drop environment from transaction uniqueness   KILLED
M2 purchase account FK -> ON DELETE CASCADE       KILLED
M3 classify legacy grants as PAID                 KILLED
M4 allow a client role INSERT into the ledger     KILLED
M5 wrong catalog duration (4h -> 3600)            KILLED
M6 purchase->grant fan-out (unique -> plain)      KILLED
```

6/6 killed, no survivors, file restored byte-identically with the SHA re-verified after each run.
A dedicated test proves the comment-stripper works, so no assertion can be satisfied by prose —
a migration that said `on delete restrict` in a comment while declaring `cascade` in DDL would
otherwise pass.

## 19. Production migration apply

```
dry-run   Would push these migrations:
          • 20260811120000_karaoke_commerce_ledger_foundation_v1.sql   (exactly one)
apply     Applying migration 20260811120000_karaoke_commerce_ledger_foundation_v1.sql... Finished
parity    before 39 paired + 1 pending  →  after 40 paired, 0 pending, no drift
```

## 20. Post-apply production verification

```
objects        karaoke_apple_purchases · karaoke_product_catalog        both present, RLS enabled
grant columns  source_type NOT NULL default MANUAL_PROMOTIONAL · is_paid NOT NULL default false
               apple_purchase_id uuid NULL
uniqueness     (environment, apple_transaction_id) · pass_grant_id partial · product_code · storekit_product_id
FK delete      all three ledger FKs = RESTRICT (confdeltype 'r')
backfill       38 MANUAL_PROMOTIONAL / is_paid false / 0 with apple_purchase_id
ledger         0 purchase rows · 0 paid grants · 3 catalog rows · 0 commerce audit events
26E            purchase_owner_ref 24/24 non-null + distinct · 12/12 tombstones retain it
               timed_pass_status_time_chk still the 26E shape, refund-after-use representable
               karaoke_delete_account_v1 present and untouched
health         /api/karaoke-build = ddc21282770d (both hosts) · / 200 · /support 200
```

No pass was issued as a smoke test against production.

## 21. No purchase runtime yet

There is no purchase endpoint, no verification service, no notification receiver and no refund
path. `karaoke_apple_purchases` is empty and will stay empty until Slice 3 ships.

## 22. No StoreKit yet

No `import StoreKit`, no `.storekit` configuration, no purchase UI, no `Transaction` handling.
Native source was not touched in this build.

## 23. No App Store Connect products yet

The three Product IDs exist **only** as catalog contract rows. No ASC in-app purchase product has
been created. Product ID and purchase type are immutable after creation, so creation remains a
deliberate, separately authorized console action.

## 24. Deferred BUILD 18C work

**BUILD 18C is NOT complete.** Still open, and explicitly not blockers for Slice 2:

- **G4** — grant `room_id` / `event_id` + automatic reversion on event close
- **G6** — unactivated expiry for promotional passes (Welcome 30d / Referral 90d)
- **G7** — promotional taxonomy / eligibility versioning

## 25. Next slice

**TRACK B SLICE 3 — server Apple transaction verification endpoint.** Not started.

## 26. Worktree safety

Only two files were staged, by explicit path:

```
bty-karaoke/supabase/migrations/20260811120000_karaoke_commerce_ledger_foundation_v1.sql
bty-karaoke/src/lib/commerce-ledger-migration.schema.test.ts
```

Preserved untouched throughout: `M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md`,
`?? bty-karaoke/brand/`, `?? bty-karaoke/docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md`,
`D "bty-app/tailwind.config 2.ts"`, and all unrelated Arena/Foundry work. Native
`M …/BTYNorebangAdmin.xcscheme` was neither staged nor modified.

## 27. Final statement

**BUILD 26L is `PASS / CLOSED`.**

The commerce ledger foundation is live in production. The 38 existing Timed Pass grants are
retained as non-paid `MANUAL_PROMOTIONAL` history with identity, status and timestamps preserved —
proven by an identical production digest before and after. No purchase exists, no StoreKit client
exists, no App Store product has been created, and paid transaction processing remains disabled
because all catalog products are `is_active = false`.

Deliberately **not** claimed: that anything is purchasable; that BUILD 18C is complete (G4/G6/G7
remain open); or that the catalog is read-only in effect (§16 records the platform default
honestly). The next authorized architecture slice is server-side Apple transaction verification.
