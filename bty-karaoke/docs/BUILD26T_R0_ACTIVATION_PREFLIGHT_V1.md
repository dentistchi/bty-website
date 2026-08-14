# BUILD 26T-R0 — Commerce Activation Preflight (READ ONLY)

**Status: PASS / CLOSED — 2026-08-14. Zero writes. No code changed, no deploy, no migration.**

> **This is a PASS for the read-only activation preflight. It is NOT authorization to activate
> commerce.** R0 measured the real production activation surface and found the expected next
> blocker — `native Release commerce capability = 0`. That gap is the **input to R1A**, not an R0
> failure.

> **Headline finding.** Catalog activation is a safe, reversible, per-product single-column flip
> that changes exactly one HTTP branch. It is also **not sufficient**: the Release build has
> **zero commerce capability** — no StoreKit linkage, no product discovery, no purchase call, no
> recovery path, no completion authority. Flipping `is_active` today would produce exactly zero
> real purchases, because no shipping build can present one.

---

## 1. Financial invariants — MEASURED, unchanged

```
Apple purchases            1        28ab7288-…  VERIFIED / GRANTED / 3600 / Sandbox
  environment split        Sandbox 1 · Production 0
paid grants                1        006bc34f-…  PAID / is_paid / AVAILABLE / ONE_HOUR / 3600
paid ISSUED audits         1
grants total               56       MANUAL_PROMOTIONAL 55 · PAID 1
audit total                156
catalog                    3 rows · is_active TRUE on 0 of 3
accounts                   24 total · 12 live · purchase_owner_ref NULL on 0
```

**Writes performed during R0: 0.** The closing census `diff`s byte-identical against the BUILD
26S-R2B post-census. Every probe was a read: `select`-only REST queries, unauthenticated endpoint
probes that 401 before any handler logic, `wrangler`/`supabase` list commands, and a device
`Product.products(for:)` discovery probe.

## 2. Catalog — MEASURED

```
PASS_1H    com.btydaily.norebang.pass.1hour    ONE_HOUR           3600   is_active=false
PASS_4H    com.btydaily.norebang.pass.4hour    FOUR_HOURS        14400   is_active=false
PASS_24H   com.btydaily.norebang.pass.24hour   TWENTY_FOUR_HOURS 86400   is_active=false
```

## 3. App Store Connect — MEASURED via the live App Store

This environment still has **no ASC API access** (BUILD 26Q §5, re-checked: no `.p8`, no
`~/private_keys`, no ASC env vars, no key referenced by any script). So ASC was measured the only
machine-verifiable way available — by asking the **real App Store** from the device, read-only:

```
[26R-R1] requestedCount=3 returnedCount=3 found=3 missing=0 unexpected=0 duplicates=0
[26R-R1] com.btydaily.norebang.pass.1hour   Consumable  BTY Norebang 1-Hour Pass   $1.99
[26R-R1] com.btydaily.norebang.pass.4hour   Consumable  BTY Norebang 4-Hour Pass   $4.99
[26R-R1] com.btydaily.norebang.pass.24hour  Consumable  BTY Norebang 24-Hour Pass  $9.99
[26R-R1] isComplete=true
```

All three contracts are present, Consumable, and priced exactly as ratified in BUILD 26Q-R1. A
product that had been removed, rejected or made unavailable would not resolve.

**Not measurable here:** the ASC *review state* of each IAP (Ready to Submit / Waiting for Review /
Approved) and whether they are attached to an app version for review. StoreKit resolving a product
does not distinguish those. **That remains Founder-attested ASC UI evidence.**

The same probe run incidentally re-confirms BUILD 26S-R2B: `Transaction.updates` produced **no**
observation of `9a4eafea51f2…` on this later cold launch — the finished transaction is still gone.

## 4. Server — MEASURED

```
GET  /api/host/purchases/apple/fulfilment   401 Unauthorized     live
POST /api/host/purchases/apple/verify       401 Unauthorized     live
POST /api/host/purchases/apple/fulfil       401 Unauthorized     live
GET  /api/host/me                           401 Unauthorized     live
```

Probed on **both** origins — `norebang.btydaily.com` and `bty-karaoke.ywamer2022.workers.dev` (the
origin the native app actually ships against, §5). Identical on both.

```
Worker (100%)   46b3437d-880e-42d1-a417-10ed3415d53e   deployed 2026-08-14T06:10:42Z
migrations      local == remote through 20260816120000  (26S-R1 fulfilment)
```

**Service-role boundaries — unchanged, by source.** `fulfil_apple_purchase(uuid, uuid)` is
`SECURITY INVOKER` with a pinned `search_path`, `REVOKE ALL … FROM public, anon, authenticated` and
`GRANT EXECUTE … TO service_role`. Evidence basis: the applied migration text plus the confirmed
migration parity above. It was not re-queried from `pg_proc` — PostgREST does not expose the
catalog, and no read-only path to it exists from here.

**Replay / idempotency — intact, and proven empirically twice on production.** R2A and R2B each
replayed `/verify` and `/fulfil` against the live records and each returned `replayed=true` with a
byte-identical census afterwards (`updated_at`, `processed_at`, `verification_attempts` all
unmoved). That is stronger evidence than reading an index name. The three independent enforcers
remain: `timed_pass_apple_purchase_idx`, `karaoke_apple_purchases_pass_grant_idx`,
`timed_pass_issue_idem_idx`.

## 5. Native — MEASURED on the Release binary (build 99)

```
otool -L                     NO StoreKit linkage
PassStoreDiscovery           0 symbols        PassPurchaseService        0 symbols
PassStoreProductID           0 symbols        PassPurchaseGateView       0 symbols
PassStoreRecovery            0 symbols        PassRecoveryGateView       0 symbols
PassStoreUpdatesListener     0 symbols        PassFinishGateView         0 symbols
PassLifecycleCompletion      0 symbols
```

**No DEBUG gate leakage.** None of the five launch flags exists even as a string in the Release
binary:

```
-BTYPassStoreDiscoveryProbe 0   -BTYPassPurchaseGate 0   -BTYPassRecoveryGate 0
-BTYPassFinishGate 0            -BTYAPIBaseURL 0
```

**Production API base.** `APIClient.productionBaseURL = https://bty-karaoke.ywamer2022.workers.dev`,
and `DebugAPIBaseOverride.resolved` is a compile-time `nil` in Release — confirmed by the absent
`-BTYAPIBaseURL` string. A shipped build is always production.

**Sandbox-only assumptions.**

| Layer | Finding |
|---|---|
| Server | **None.** `AppleEnvironment = 'Sandbox' \| 'Production'`; both accepted; the environment is read by the verifier itself, never from a caller; the issue idempotency key is environment-scoped (`apple:<env>:<txnId>`) so a Sandbox id can never collide with a Production one. |
| Native | Exactly **one** `"Sandbox"` literal in all 44 sources — `PassRecoveryFixture.build26R`. DEBUG-gate-only, dead-stripped in Release. |
| Ledger | 1 Sandbox purchase, 0 Production purchases. |

*Unmeasured, low risk:* the Apple root-chain verifier has only ever been exercised against a
Sandbox JWS. Production JWS uses the same Apple root chain and `environment` is a claim rather than
a different chain (26P's `apple-real-chain` fixture covers the chain itself), so this is expected
to work — but it has never been observed with a genuine Production transaction.

**`purchaseOwnerRef` / account binding — production-ready.** `purchase_owner_ref` is NULL on **0 of
24** accounts, so every existing account can already bind a payment. It is server-derived at every
decision point (`readPurchaseOwnerRef(acct.id)`), never accepted from a request body, exposed only
on `GET /api/host/me` (deliberately not in `publicAccount()`), and compared by UUID value. The
`/verify` route refuses a mismatch with **403 `account_binding_mismatch`** and writes nothing.

### 5.1 The blocking gap

The pure types **do** survive into Release (`PassTransactionCoordinator` 186 symbols,
`FinishAuthorization` 57, `PassRecoveryRunner` 2) — but they are inert: without StoreKit there is
no way to obtain a transaction to feed them, and they have no call site. Worse for 26T's purpose,
their admission logic is pinned to `PassRecoveryFixture.build26R` — **one hardcoded Sandbox
transaction**. A production flow cannot use a fixture.

So the entire commerce chain — discovery, purchase, recovery, fulfilment, completion — exists
**only** as `#if DEBUG` forensic gates driven by a single known transaction.

## 6. Operational activation semantics

### 6.1 Exact code paths gated by `is_active`

`is_active` is read in **exactly one function** and consumed at **exactly one decision** in the
entire server:

```
READ     src/lib/apple-purchase-ledger.server.ts:162  resolveCatalogProduct()
           .select('product_code, is_active')  ← the only select that names the column
DECIDE   src/app/api/host/purchases/apple/verify/route.ts:157
           if (!product.isActive) → 409 { error: 'product_inactive', verified, recorded,
                                          entitlementIssued: false, replayed, productCode }
```

Provably **not** consulted by: `fulfil_apple_purchase` (its catalog read names three fields —
`pass_type`, `duration_seconds`, `storekit_product_id` — and never `select *`), the `/fulfil`
route, the `/fulfilment` route, or `apple-fulfilment.server.ts`. This is BUILD 26S-R0 Contract B,
still holding.

### 6.2 What changes when `false → true`

By the time line 157 is reached, `/verify` has **already**:

1. verified the JWS against Apple's root (422, no write, on failure);
2. validated bundle id, environment, claims and the `appAccountToken` binding (403/422, no write);
3. resolved the catalog product (422 `unknown_product`, no write);
4. **durably inserted the purchase row** as `VERIFIED / NOT_GRANTED` — record-before-decision;
5. checked Apple revocation (422, recorded).

So the entire effect of activation is the **final branch**:

```
is_active=false   409 { error: 'product_inactive', verified: true, recorded: true,
                        entitlementIssued: false, replayed, productCode }
is_active=true    200 { ok: true,  verified: true, recorded: true,
                        entitlementIssued: false, replayed, productCode }
```

**Activation still grants nothing.** `entitlementIssued` is `false as const` on both branches;
BUILD 26P is verify-and-record by contract. Entitlement requires the separate `/fulfil` call, which
never consulted `is_active` in the first place. Activation changes an **acceptance** signal, not a
settlement one.

### 6.3 Per-product or all-at-once

**Strictly per product.** `is_active` is a per-row column and `resolveCatalogProduct` looks the row
up by `storekit_product_id`. There is no global switch, no cache, and no cross-product coupling —
three independent flips, and PASS_1H can be activated alone.

### 6.4 Rollback path

A single `UPDATE karaoke_product_catalog SET is_active = false WHERE product_code = …`. Instant,
non-destructive, and it re-arms the acceptance gate immediately.

**But rollback is not a kill switch for money already taken.** Because settlement ignores
`is_active`, a purchase recorded while the product was active can still be fulfilled into a paid
grant *after* rollback. That is Contract B behaving exactly as ratified — Apple already charged the
customer, and refusing to settle would convert a completed payment into a permanent loss — but it
means rollback stops **new acceptance** and does **not** claw back in-flight purchases. Anything
already granted stays granted; revocation is a separate, deliberate operational act.

### 6.5 Interaction with the finished Sandbox fixture

**No financial interaction. One harness consequence.**

- The fixture is `Sandbox`, already `VERIFIED / GRANTED`, already settled, and now finished on the
  device (absent from `Transaction.unfinished`, re-confirmed in §3).
- Its issue idempotency key `apple:Sandbox:2000001221267169` is **environment-scoped**, so no
  Production transaction can ever collide with it.
- The unique `(environment, apple_transaction_id)` index means a re-presented Sandbox JWS still
  converges onto the same row — no second purchase, no second grant, at any `is_active` value.

**The consequence to know about:** activating PASS_1H changes what a *replay* of that fixture
returns from `409 product_inactive` to `200 ok`. The native `ApplePurchaseVerification.verdict`
treats anything that is not the sealed 409 as `.other(...)`, so the 26R-R2 / 26S-R2A / 26S-R2B gate
harnesses would **refuse** after activation. Those gates are closed and this is not an operational
problem — but a future re-run would report failure, and that failure would be the activation, not a
regression. Worth writing down before someone spends a day on it.

### 6.6 Expected behaviour for the first genuine post-activation purchase

**With activation alone: nothing happens.** There is no shipping code path that can start a
purchase (§5). The realistic sequence, stated plainly:

```
today          Release build cannot discover, purchase, recover, fulfil or finish anything
activation     changes one HTTP branch for a request no shipping build can currently send
therefore      26T must build the PRODUCTION commerce surface, not just flip a column
```

What a first genuine Production purchase would need, none of which exists outside `#if DEBUG`:

1. product discovery in Release, and a purchase UI a customer can reach;
2. `Product.purchase(.appAccountToken(purchase_owner_ref))` on a production code path;
3. `Transaction.unfinished` recovery at launch, generalized **off the fixture** to "any transaction
   owned by this account for a known catalog product";
4. a production `Transaction.updates` listener (today DEBUG-only, observation-only);
5. `/verify` → `/fulfil` → durable `GET /fulfilment` → `finish()`, driven by a real transaction
   rather than a pinned one — the R2A/R2B chain is correct in shape but fixture-bound in identity;
6. the server side needs **no change**: it already accepts Production, binds by owner ref, settles
   atomically and replays idempotently.

Once that exists, the expected first-purchase behaviour is: 200 from `/verify` (recorded,
`entitlementIssued:false`), then `/fulfil` creating exactly one PAID / AVAILABLE grant of the
catalog duration with a `apple:Production:<txnId>` idempotency key, then a durable
`linkageVerified:true` read, then one `finish()`. The pass is born **AVAILABLE**, never ACTIVE —
BUILD 18C invariant #3, unchanged: a purchase must never start a clock.

## 7. Deviations, stated

**Bare `supabase migration list --linked` returned 403** "your account does not have the necessary
privileges". Per the standing note, this is diagnosed as an **invocation** fault, not an
access-control fact: the `supabase-karaoke` wrapper (Keychain PAT `bty-norebang-supabase-pat`)
returned the full migration list immediately. The earlier browser login has evidently lapsed again;
the wrapper is the working credential. **Nothing about project access changed.**

**ASC review state is not machine-measurable here** and is recorded as such rather than asserted
(§3).

## 8. Founder decisions — RATIFIED

### Decision 1 — BUILD 26T means a purchasable app

BUILD 26T is **not** defined as "flip `karaoke_product_catalog.is_active`". It is defined as:

```
ship a production-capable Release app whose real user can safely:
  discover an operationally enabled timed pass
  → purchase it through StoreKit
  → bind the purchase to the authenticated BTY account
  → verify it server-side
  → settle exactly one paid entitlement
  → prove durable fulfilment
  → finish the StoreKit transaction
  → recover safely across interruption / relaunch
```

**A catalog flip by itself is not completion.**

### Decision 2 — PASS_1H is the first production canary

The three products are **not** activated together. First production activation target:

```
com.btydaily.norebang.pass.1hour
```

PASS_4H and PASS_24H remain inactive until PASS_1H completes its production acceptance chain.
Rationale: activation is per-product (§6.3), rollback is per-product (§6.4), PASS_1H is the
smallest financial exposure, and one real acceptance transaction gives the cleanest delta. This
does **not** invalidate PASS_4H / PASS_24H — they remain valid contract products awaiting later
activation.

### Decision 3 — historical gates are immutable

BUILD 26R-R2, 26S-R2A and 26S-R2B are **not** re-sealed against HTTP 200. Their evidence was
measured while `catalog active = 0`, and the expected 409 is historically correct.

```
26R / 26S closure documents are immutable historical evidence.

After PASS_1H activation, a literal rerun of an old gate whose expected result was
product_inactive may fail because ACTIVATION SUCCEEDED, not because commerce regressed.
```

Future regression tests must be **activation-aware** (both branches proven independently through
fixtures, never by flipping the production catalog). Prior closure evidence is never altered to
pretend the catalog was active when it was not.

### Decision 4 — ASC is a hard Founder gate before activation

Device StoreKit discovery is **not** sufficient evidence that production sale is ready. Before
PASS_1H activation the Founder must inspect App Store Connect and record the measured state:

```
PASS_1H Product ID exact
type = Consumable
price / availability expected
IAP review status measured
whether it is included in the applicable app submission / version
whether the app version itself is submittable / submitted / approved
```

ASC review state is never inferred from StoreKit discovery. **R1A is not blocked on this check** —
it can be built while ASC review proceeds — but there is **no production catalog activation and no
public purchase launch** until this gate is explicitly satisfied. If this is the application's
first Consumable IAP, Apple's requirement that the first Consumable be submitted with a new app
version is preserved as an explicit release-readiness gate.

## 9. Sequence after R0

```
26T-R1A   Release commerce core        no activation, no purchase
26T-R1B   ASC / app version submission readiness    Founder gate
26T-R2    PASS_1H controlled activation
26T-R3    first post-activation acceptance transaction
```

These steps are not collapsed.

---

**BUILD 26T-R0 — PASS / CLOSED. Zero writes. No column flipped, no code changed, no product
activated.**
