# BUILD 26T-R1A — Release Commerce Core (no activation, no purchase)

**Status: PASS / CLOSED — 2026-08-14. Read-only catalog endpoint DEPLOYED to production and
proven against a Release build on a physical device.**

BUILD 26T-R0 measured the blocker: `native Release commerce capability = 0`. The shipping app
could not discover, purchase, recover, settle or complete anything, so flipping `is_active` would
have produced exactly zero real purchases.

R1A closes that gap. The Release artifact now links StoreKit, ships a generic production commerce
engine, listens for `Transaction.updates`, recovers unfinished transactions at launch, and refuses
every purchase — truthfully — because the server is not selling.

```
Release build 100, physical iPhone, no flags, against PRODUCTION:
  [26T] updates-listener=STARTED                     ← production listener alive in RELEASE
  [26T] unfinished discovered=0                      ← launch-time recovery ran, queue empty
  [26T] commerce-catalog status=200                  ← production answered
  [26T] commerce-catalog activeCount=0 products=0    ← and it authorizes nothing
  [26T] storekit offered=3 ids=…1hour,…4hour,…24hour ← Apple still offers all three
  [26T] purchaseEligible=0 of=3                      ← so nothing is purchasable
  [26T] purchaseCalls=0                              ← and nothing was ever charged
  [26T] RESULT=INACTIVE_CATALOG_PURCHASE_BLOCKED
  (no [GATE-B23], no [26R-R1], no [26S-R2A], no [26S-R2B] — all #if DEBUG)
```

**No product was activated. No purchase was made. `Product.purchase` runtime invocations: 0.**

> **This PASS is not authorization to activate commerce.** It proves the opposite direction: that
> with production authorizing zero products, a fully commerce-capable Release build converges to
> zero purchasable products and initiates no charge. `PASS_1H` remains inactive.

---

## 1. Verdict

```
BUILD 26T-R1A                     PASS / CLOSED
Release commerce capability       0 → real, generic, shipping
26R fixture in production path    0 (source and binary)
catalog                           3 rows / 0 active     UNCHANGED
catalog endpoint                  DEPLOYED (read only)  404 → 401 unauth · 200 authed
production activeCount            0                     measured live, twice
StoreKit offered                  3                     measured live on device
purchaseEligible                  0
Product.purchase invocations      0                     RUNTIME tally, not a source count
new Sandbox purchases             0
new Production purchases          0
production financial census       byte-identical
R1A-R1 / R1A-R2                   RECORDED, NOT STARTED (§18)
R1B (ASC gate)                    NOT STARTED
```

## 2. Baseline

```
native     bty-norebang-admin-ios   build 100   (was 99 / e6baff3)
monorepo   bty-karaoke              1 read-only endpoint + observability + tests + docs
MIGRATION  NONE — parity stays 20260816120000
DEPLOY     PERFORMED — read-only endpoint only, no migration, no catalog mutation (§12)
           Worker version  bae0b14d-6092-457e-bf7e-169130a4f163  (100%)  2026-08-14T17:49:12Z
           previous        46b3437d-880e-42d1-a417-10ed3415d53e  (BUILD 26S-R1, rollback target)
```

## 3. Files changed

**Server** — one read-only endpoint, no write path touched.

```
NEW  src/lib/commerce-catalog.server.ts                  read-only active-catalog select
NEW  src/app/api/host/commerce/catalog/route.ts          GET, host auth, no-store
NEW  src/app/api/host/commerce/catalog/route.test.ts     6 tests
```

`/verify`, `/fulfil`, `/fulfilment`, the settlement RPC, the grant schema, the audit schema and the
catalog `is_active` values are **untouched**.

**Native** — the production engine, plus a generalization of the proven machinery.

```
NEW  BTYNorebangAdmin/Commerce.swift             contract · dual gate · generic admission ·
                                                 verify verdict · finish authority · evidence
NEW  BTYNorebangAdmin/CommercePipeline.swift     verify → fulfil → separate durable read
NEW  BTYNorebangAdmin/CommerceEngine.swift       StoreKit: discover · buy · process · recover · listen
NEW  BTYNorebangAdmin/CommerceStore.swift        surface state; owns no rules
NEW  BTYNorebangAdmin/TimedPassStoreView.swift   the smallest truthful commerce surface
MOD  BTYNorebangAdmin/APIClient.swift            +hostCommerceCatalog, +verifyAppleCommercePurchase
MOD  BTYNorebangAdmin/PassTransactionCoordinator.swift  claim/release primitives + processCommerce
MOD  BTYNorebangAdmin/PassRecovery.swift         +LifecycleCompletionRequest bridge
MOD  BTYNorebangAdmin/PassRecoveryService.swift  completion boundary takes the generic request
MOD  BTYNorebangAdmin/PassFinishGateView.swift   passes the generic request
MOD  BTYNorebangAdmin/BTYNorebangAdminApp.swift  production listener + launch recovery (not DEBUG)
MOD  BTYNorebangAdmin/RootView.swift             store surface inside the entitlement sheet
MOD  BTYNorebangAdmin/Localizable.xcstrings      14 new keys, en + ko
MOD  BTYNorebangAdmin.xcodeproj/project.pbxproj  5 sources, version 99 → 100
MOD  Tests/run.sh, Tests/QueueContractTests.swift  +141 checks; 4 assertions narrowed (§10)
```

**Native — the production gate's observability, added for this closure.** Measurement only: no
commerce decision, no authority and no branch changed anywhere below.

```
MOD  BTYNorebangAdmin/Commerce.swift             +CommerceCatalogReading (status carried for
                                                  evidence, never branched on)
                                                 +CommerceSurfaceCensus / CommerceSurfaceVerdict
                                                  (purely derived; keeps each blocked cause distinct)
                                                 +CommerceLog.catalogHTTP / .census
MOD  BTYNorebangAdmin/CommerceEngine.swift       loadCatalog returns the reading; +describe(APIError)
MOD  BTYNorebangAdmin/CommerceStore.swift        records the status; prints the census
MOD  BTYNorebangAdmin/TimedPassStoreView.swift   census again on disappear — the closing measurement
MOD  BTYNorebangAdmin/APIClient.swift            hostCommerceCatalog returns (status, body)
MOD  BTYNorebangAdmin/PassTransactionCoordinator.swift  +purchase-invocation tally (gates nothing)
MOD  BTYNorebangAdmin/PassPurchaseService.swift  counts the ONE purchase site, before the call
MOD  Tests/QueueContractTests.swift              +13 checks (26T-T12a…T12m)
```

The app still has **exactly one** `product.purchase` site and **exactly one** `transaction.finish()`
site; both counts are asserted against the shipped sources.

## 4. Did an existing catalog-read endpoint exist?

**No.** `grep karaoke_product_catalog src/app/api/` returns nothing — no route read the catalog.
`/api/host/timed-passes` returns an account's *grants*, not what may be sold.

So the smallest possible read-only contract was added:

```
GET /api/host/commerce/catalog        host session (Bearer or cookie), no-store
→ { ok, products: [{ productId, productCode, passType, durationSeconds }], activeCount }
```

**It returns ONLY active products and never echoes `is_active`.** That is the fail-closed shape: a
client cannot mistake an inactive row for an active one, because an inactive row is not there, and
a future bug that dropped a boolean cannot accidentally enable a sale. With the current production
state it returns `{ products: [], activeCount: 0 }`.

No price (Apple owns price), no financial row, no account data, no service-role information, one
`select`, zero writes, and it is **not** the gate — `/verify` keeps its own independent `is_active`
check, unchanged.

## 5. Release StoreKit architecture

```
                        ┌─ server catalog ──┐
                        │  GET .../catalog  │──┐
                        └───────────────────┘  ├─▶ CommercePurchaseAuthority  (DUAL GATE)
                        ┌─ App Store ───────┐  │        │
                        │ Product.products()│──┘        ▼
                        └───────────────────┘   AuthorizedPurchase
                                                        │
   Transaction.unfinished ─┐                            ▼
   Transaction.updates ────┼─▶ CommerceTransactionPolicy.admit (generic)
   purchase result ────────┘                            │
                                                        ▼
                                    PassTransactionCoordinator.processCommerce   (one authority)
                                                        │
                                     CommercePipeline: /verify → /fulfil → GET /fulfilment
                                                        │
                                              CommerceFinishAuthorization
                                                        ▼
                                    PassLifecycleCompletion.complete(request:)   (one finish site)
```

**It drives the proven machinery rather than duplicating it.** Discovery is `PassStoreDiscovery`,
the purchase call is `PassPurchaseService` (still the app's only `product.purchase` site), the
unfinished queue is `PassStoreRecovery`, dedupe is `PassTransactionCoordinator`, and completion is
`PassLifecycleCompletion` — still the app's **only** `transaction.finish()` call site, now reached
through a generic `LifecycleCompletionRequest` that both the sealed forensic authorization and the
production one produce. A second implementation of "buy" or "finish" would be a second place to get
the most destructive operations in the system wrong.

## 6. Generic account / token binding

Production never uses the BUILD 26R owner token. Every path resolves the account from the Keychain
session plus the server's own `purchaseOwnerRef` (`GET /api/host/me`), and refuses fail-closed when
any of it is missing:

```
notAuthenticated · missingPurchaseOwnerRef · malformedPurchaseOwnerRef
```

`CommerceTransactionPolicy.admit` compares Apple's echoed `appAccountToken` to that ref by **UUID
value** (never text). A transaction bound to a different account is refused **and left in the
queue** — on a shared phone that is not litter to sweep up, it is the other account's evidence.

## 7. The pre-purchase dual gate

A product is purchasable only when **both** independent authorities agree:

```
1. the BTY server currently accepts new paid transactions for this exact product
2. the App Store currently offers this exact product to this device
```

Neither substitutes for the other. StoreKit knowing a product says nothing about whether we can
settle it; server activation says nothing about whether Apple will sell it here. Everything else
refuses with its own name: `serverCatalogUnavailable` (unknown is not permission — a failed catalog
read is a *different state* from an empty one), `productNotOperationallyActive`,
`productNotOfferedByAppStore`, `notAContractProduct`, `purchaseInProgress`.

With `activeCount = 0`, all three rows render disabled and the surface says so once, plainly.

## 8. Where each authority lives

```
Product.purchase authority   BTYNorebangAdmin/PassPurchaseService.swift  (single site, unchanged)
                             reached only via CommerceEngine.purchase(_:) after the dual gate
unfinished recovery          CommerceEngine.recoverUnfinished(...)
                             + launch-time call in BTYNorebangAdminApp.init(), NOT behind #if DEBUG
Transaction.updates listener CommerceUpdatesListener.start(...)
                             started in BTYNorebangAdminApp.init(), NOT behind #if DEBUG
lifecycle completion         PassLifecycleCompletion.complete(request:)   (single site, unchanged)
```

The listener is not a shortcut: it runs the same admission, the same `/verify`, the same `/fulfil`,
the same separate durable read and the same completion gate as every other source, through the same
coordinator. Tests slice its body and assert it cannot reach any stage directly.

## 9. Dedupe / coordinator

`PassTransactionCoordinator` was refactored into `claim` / `release` primitives so the forensic
`process` and the production `processCommerce` are **two entry points into one authority** — one
`inFlight`, one `converged`, one `observed`, one lifecycle-completion counter. Both take the claim
with no suspension between check and insert.

Proven for arbitrary ids: purchase/unfinished(A) + updates(A) → exactly one execution; A and B
independent; a non-durable failure released and retryable; only durable convergence suppressing
permanently; and a *production* convergence deduping the *forensic* path, which is the direct proof
that there is one authority rather than two.

## 10. Assertions narrowed (never deleted)

R1A legitimately changes four measured facts. Each was narrowed to say something stronger, and no
historical closure evidence was edited:

```
26S-R2A-A9f   StoreKit queues read in 1 file  → exactly ["CommerceEngine.swift",
                                                         "PassRecoveryService.swift"]
26S-R2B-B7d   boundary identity match         → `request.mismatch(` (the generic request)
26S-R2B-B8c   completion authority users      → + CommerceEngine.swift (still no UI, no listener)
26R/26S-N     build number pins               → 100
```

`transaction.finish()` call sites remain **exactly 1**. `product.purchase(options:` sites remain
**exactly 1**.

## 11. Verification

```
native contract suite   2707 passed / 0 failed      (+141 26T checks, +13 for the census)
server suite            2872 passed / 0 failed      (+6 catalog tests)
tsc --noEmit            clean
Debug build             BUILD SUCCEEDED
Release build           BUILD SUCCEEDED             build 100, dev-signed, installed via devicectl
```

The 13 census checks are the ones that make the gate falsifiable: that a failed read
(`CATALOG_UNAVAILABLE_PURCHASE_BLOCKED`), a signed-out device
(`NOT_AUTHENTICATED_PURCHASE_BLOCKED`) and an App Store offering nothing
(`STORE_OFFERS_NONE_PURCHASE_BLOCKED`) each report as themselves and can never be mistaken for the
production state the gate claims, that both authorities agreeing is the only route to
`PURCHASE_ELIGIBLE`, and that the purchase tally is taken at the app's one purchase site and
**before** the call.

All 24 required behaviours are covered. The activation-aware model the Founder ratified was already
satisfied server-side: `verify/route.test.ts` proves the inactive branch (409 `product_inactive`,
recorded) and the active branch (200, recorded, `entitlementIssued:false`) **independently through
fixtures**, and no test flips the production catalog.

### Release artifact — measured, not assumed

```
otool -L                      StoreKit.framework          ← was NONE in R0
CommerceEngine                36 symbols       CommerceStore             205
CommerceUpdatesListener       35 symbols       TimedPassStoreView        109
CommercePipeline              12 symbols       PassLifecycleCompletion    30
PassStoreRecovery             16 symbols       PassPurchaseService        12

PassPurchaseGateView           0               PassRecoveryFixture        0
PassRecoveryGateView           0               PassStoreUpdatesListener   0
PassFinishGateView             0

-BTYPassPurchaseGate  0   -BTYPassRecoveryGate  0   -BTYPassFinishGate  0
-BTYPassStoreDiscoveryProbe  0   -BTYAPIBaseURL  0
9a4eafea51f2  0   8107d5628079  0   28ab7288  0   006bc34f  0
```

The production engine ships; every DEBUG gate, the fixture type and all four fixture identity
strings are absent from the binary.

## 12. Server change boundary — deployed, and exactly what was deployed

The catalog endpoint is **deployed to production**, under the Founder's narrow R1A authorization:
the read-only endpoint and nothing else.

```
DEPLOYED     GET /api/host/commerce/catalog          one select · zero writes · no-store
             (+ the observability status pass-through it needs)
NOT IN IT    migration                     NONE
             karaoke_product_catalog write NONE  — is_active still false on all 3
             /verify /fulfil /fulfilment   UNCHANGED
             settlement RPC · schemas      UNCHANGED
             purchaseId disclosure         NOT ADDED (§13, R1A-R1)
```

**The deployment is observable from outside, in both directions.** Before it, production had no
such route; after it, the route exists and refuses an unauthenticated caller:

```
BEFORE   404   GET https://bty-karaoke.ywamer2022.workers.dev/api/host/commerce/catalog
         404   GET https://norebang.btydaily.com/api/host/commerce/catalog
AFTER    401   both origins, unauthenticated        ← the route exists and requires a host session
         200   from the device, authenticated        ← §14, and confirmed server-side by wrangler tail
```

Rollback is a single `wrangler rollback` to `46b3437d`, and it is safe at any moment because the
endpoint has no writer and no consumer that grants anything.

## 13. Blocker found — reported, not routed around

**`POST /verify` does not disclose the durable purchase id, so the production pipeline cannot
address `/fulfil`.**

`recordVerifiedApplePurchase` returns `purchaseId` and the route drops it: the 200 body is
`{ ok, verified, recorded, entitlementIssued, replayed, productCode }`. BUILD 26S-R2A worked around
this with the pinned fixture id; production has no fixture.

Per the brief this was **not** widened unilaterally. Instead it is encoded honestly and fails
closed: `CommerceVerifyVerdict.acceptedWithoutPurchaseIdentity` →
`CommerceSettlementFailure.purchaseIdentityUnavailable`, with `/fulfil` never called. The client
already decodes `purchaseId`, so the fix is one additive line in the verify route and **no client
change**.

**This does not block R1A** — R1A never executes a purchase. It blocks **R3** (the first
post-activation acceptance transaction), and it needs a Founder decision before then:

```
add `purchaseId: outcome.purchaseId` to the /verify 200 body
  additive · same status codes · same branches · same writes
  discloses a row id the caller already owns
```

## 14. Physical device — iPhone 17 Pro Max `80C931D3`, **RELEASE** build 100

R0's blocker was specifically Release capability, so the acceptance artifact is the **Release**
build, dev-signed and installed with `devicectl`. No DEBUG gate was used as evidence.

```
[26T] updates-listener=STARTED
[26T] unfinished discovered=0
```

Two facts, both of which were impossible before this build:

* the **production** `Transaction.updates` listener is alive in a shipping artifact;
* **launch-time unfinished recovery** ran, enumerated StoreKit's queue generically, and correctly
  found it empty — BUILD 26S-R2B finished the only transaction that was ever in it.

And the **absence** is evidence too: no `[GATE-B23]`, no `[26R-R1] probe=`, no `[26S-R2A]`, no
`[26S-R2B]` line appeared, because every one of those call sites is `#if DEBUG`. That is runtime
proof of zero DEBUG-gate leakage, measured rather than inferred from the binary.

### Store surface — the dual gate, measured against production

The commerce surface was opened **exactly once** and closed. Nothing else on it was touched, and
no Buy control was tapped. Verbatim, in order, from the Release build's console:

```
[26T] catalog=loaded activeCount=0 ids=
[26T] storekit=loaded count=3 ids=com.btydaily.norebang.pass.1hour,com.btydaily.norebang.pass.4hour,com.btydaily.norebang.pass.24hour
[26T] commerce-catalog status=200
[26T] commerce-catalog activeCount=0 products=0
[26T] storekit offered=3 ids=com.btydaily.norebang.pass.1hour,com.btydaily.norebang.pass.4hour,com.btydaily.norebang.pass.24hour
[26T] purchaseEligible=0 of=3
[26T] purchaseCalls=0
[26T] RESULT=INACTIVE_CATALOG_PURCHASE_BLOCKED
```

and again on the way out, when the surface disappeared:

```
[26T] commerce-catalog status=200
[26T] commerce-catalog activeCount=0 products=0
[26T] storekit offered=3 ids=…1hour,…4hour,…24hour
[26T] purchaseEligible=0 of=3
[26T] purchaseCalls=0
[26T] RESULT=INACTIVE_CATALOG_PURCHASE_BLOCKED
```

**Both halves of the gate are positive facts, and they disagree with each other.** That is the
whole point of measuring them separately:

```
APPLE    StoreKit resolved and offered all THREE products to this device        offered=3
SERVER   production, HTTP 200, authorizes ZERO of them                          activeCount=0
RESULT   the app converges to zero purchasable products                         purchaseEligible=0
CHARGE   Product.purchase was never invoked                                     purchaseCalls=0
```

A gate that had only measured "nothing is purchasable" could have been passed by a phone in
aeroplane mode. This one cannot: `storekit offered=3` proves StoreKit was reachable and healthy,
`status=200` proves the server answered, and the verdict enum keeps a failed read
(`CATALOG_UNAVAILABLE_PURCHASE_BLOCKED`) and a signed-out device
(`NOT_AUTHENTICATED_PURCHASE_BLOCKED`) as **different tokens** from the one that was printed. Only
a server that answered and authorized nothing can produce `INACTIVE_CATALOG_PURCHASE_BLOCKED`.

**`purchaseCalls` is a runtime tally, not a source count.** It is incremented inside
`PassPurchaseService.buy`, immediately before the app's single `product.purchase` call and gating
nothing, so it can only over-report. A source-code count proves how many places *could* charge
someone; only this proves how many times one *did*. It read 0 when the surface appeared and 0 again
when it disappeared, and no `[26T] purchase-authority` line — which `CommerceStore.buy` prints
before it decides anything — appears anywhere in the session.

**Independent server-side corroboration.** A live `wrangler tail` on the production Worker
observed the same request from the outside, so the 200 is not only the app's own account of itself:

```
GET https://bty-karaoke.ywamer2022.workers.dev/api/host/commerce/catalog - Ok @ 8/14/2026, 11:03:29 AM
```

That line is also the **api-base** proof this build needed: the Release binary contains the string
`-BTYAPIBaseURL` zero times, so `DebugAPIBaseOverride` is a compile-time `nil` and the base cannot
be overridden — and the production Worker independently observed the traffic arriving. (The
`[GATE-B23] api-base=` line itself is a `#if DEBUG` play-handoff diagnostic and correctly never
printed.)

## 15. Census — pre and post

`diff` of the full production census before and after R1A — including the deployment and the
physical device observation — is **empty**. Byte-identical, same tool, same queries.

```
                          BEFORE   AFTER
Apple purchases                1       1     Sandbox 1 · Production 0
paid grants                    1       1     006bc34f-…  PAID / AVAILABLE / ONE_HOUR / 3600
paid ISSUED audits             1       1     actor SYSTEM · ref 28ab7288-…
grants total                  56      56
audit total                  156     156
catalog                        3       3
catalog is_active=true         0       0     PASS_1H · PASS_4H · PASS_24H all false
new Sandbox purchases                  0
new Production purchases               0
Product.purchase calls                 0
```

Every probe in this slice was a read: `select`-only PostgREST queries, unauthenticated endpoint
probes that 401 before any handler logic, one authenticated **GET** from the device, and
`wrangler` list/tail commands. **Writes performed during R1A: 0.**

## 16. What R1A did NOT do

```
activate any product                      NO   (still 3 / 0 active — PASS_1H INACTIVE)
make a purchase                           NO   (Product.purchase invocations 0)
write to karaoke_product_catalog          NO
add a migration                           NO
change /verify, /fulfil, /fulfilment      NO
add purchaseId to /verify                 NO   (recorded as R1A-R1, §18)
repair the activation TOCTOU              NO   (recorded as R1A-R2, §18)
change the settlement RPC or schemas      NO
call transaction.finish()                 NO   (finish invocations this session: 0)
edit 26R / 26S historical evidence        NO   (four assertions narrowed, none deleted)
claim ASC approval                        NO   (Founder gate, R1B)
start R1A-R1 / R1A-R2 / R1B / R2 / R3     NO
```

**What deployed, deployed.** The one thing R1A did to production that R1A-as-implemented had not
is the read-only endpoint (§12).

## 17. The four things this PASS distinguishes

They are separate facts and R1A is the slice that stopped letting them stand in for one another.

```
1  STOREKIT PRODUCT EXISTENCE / OFFERING
   Apple resolved all three products and offered them to this device.        offered=3
   This is NOT purchase authority. It says Apple would take the money; it
   says nothing about whether BTY can settle it.

2  SERVER OPERATIONAL AUTHORIZATION
   Production, HTTP 200, authorizes zero products.                           activeCount=0
   This is AUTHORITATIVE. `is_active` is the server's operational decision
   about whether it will accept a new paid transaction, and the answer is no.

3  PURCHASE ELIGIBILITY
   The conjunction of (1) and (2), plus an authenticated owner-bound
   account. With (2) empty it is necessarily empty.                          purchaseEligible=0
   The app converged to it correctly, and renders every pass unbuyable
   with a stated reason rather than a button that fails when tapped.

4  ACTUAL Product.purchase INVOCATION
   The runtime tally of charges this process initiated.                      purchaseCalls=0
   No Apple charge was initiated. No money moved.
```

**StoreKit knowing a product is not permission to sell it.** That sentence is the reason the
dual gate exists, and this gate is the first time both sides of it were measured live against
production at once.

**This PASS does not authorize commerce activation.** It authorizes nothing. It is evidence that
the refusal path is real, which is the precondition for later trusting the acceptance path.

## 18. Next blockers — RECORDED, NOT FIXED

Both are Founder-approved directions for **separate** slices. Neither was designed, implemented or
partially prepared inside R1A. They are written down here so the next slice starts from a measured
statement of the problem rather than from a rediscovery of it.

### BUILD 26T-R1A-R1 — Production fulfil addressability

**The problem, as measured (§13).** `POST /verify` returns
`{ ok, verified, recorded, entitlementIssued, replayed, productCode }` and drops the durable
purchase id that `recordVerifiedApplePurchase` already computed. BUILD 26S-R2A addressed `/fulfil`
using the pinned 26R fixture id; production has no fixture, so the production pipeline currently
fails closed at `purchaseIdentityUnavailable` and never calls `/fulfil`.

**Founder-approved direction.** A successful `/verify` response may **additively** return the
opaque UUID of the **existing** durable purchase row:

```json
{ "ok": true, "status": "...", "replayed": true, "purchaseId": "<existing durable purchase uuid>" }
```

**Required semantics for that slice:**

```
no new purchase row is created merely to produce a purchaseId
purchaseId identifies the EXISTING owner-bound verified row
a replay returns the EXACT SAME purchaseId
no bypass for refused / inactive / invalid transactions
VERIFY + RECORD semantics remain intact — /verify still grants nothing
/fulfil and /fulfilment authorization remain unchanged
```

**The historical record stands.** BUILD 26P's decision not to disclose an identifier was valid at
that time: there was no production settlement pipeline to address. This is a **new addressability
requirement introduced by the production settlement pipeline**, not a correction of 26P.

**Not implemented in R1A.** The client already decodes `purchaseId`, so the change is one additive
line in the verify route and no client change — which is exactly why it was tempting, and exactly
why it was left alone.

### BUILD 26T-R1A-R2 — Post-purchase settlement safety (the more fundamental blocker)

**This is the one that must be resolved before any real production charge.**

The race, stated precisely:

```
T0   client GET /api/host/commerce/catalog        product is_active = true
T1   Product.purchase()                           APPLE SUCCESSFULLY CHARGES THE CUSTOMER
T2   operator sets the product is_active = false
T3   client POST /verify
T4   the historical contract can reject it as `product_inactive`
```

That is a **post-charge settlement gap**: the customer's money has moved and the ledger can refuse
to converge. The pre-purchase read R1A shipped narrows the window — it did not close it, and it was
never claimed to.

**Required contract principle for that slice:**

```
BEFORE Product.purchase()
    current server-active authorization is REQUIRED.

AFTER a genuine verified StoreKit transaction already exists
    an operator rollback must NOT prevent financial settlement convergence.
```

So the intended operational meaning of `is_active=false` becomes:

```
active=false          →  prevents a NEW Product.purchase from being initiated
already-paid genuine  →  verify / record / fulfil / durable state recovery /
  transaction            transaction.finish() must be able to converge safely
```

**Historical semantics must NOT be rewritten.** BUILD 26L / 26P / 26R / 26S evidence that an
inactive product caused rejection remains **historically correct** — including 26R-R2's
`409 product_inactive`, which is sealed evidence of the contract as it stood. R1A-R2 is a **new
contract evolution**, discovered while preparing the first shipping production charge path, and it
must be recorded as an evolution rather than applied backwards over closed builds.

**Deliberately not designed here.** No repair was authored, sketched or partially staged in R1A.

## 19. Hard-won notes

**"We could not ask" must not look like "we are selling nothing."** `CommerceCatalogState` keeps
`.notLoaded`, `.unavailable` and `.loaded([])` distinct precisely so a failed network read can never
be rendered as a deliberate decision — in either direction.

**Return only what may be sold.** Echoing `is_active` would have created a client that must
remember to check a boolean. Returning only active rows makes the dangerous mistake unrepresentable.

**One purchase site and one finish site were worth a refactor.** Generalizing the completion
boundary to a plain `LifecycleCompletionRequest` kept the app at exactly one `transaction.finish()`
even while adding a whole production lifecycle. Two would have been easier and much worse.

**`"not.a.jws"` is a valid three-segment JWS shape.** A negative test built from it silently
asserted nothing; the real negative cases are `"not-a-jws"` and `"a.b.c.d"`.

**Production pins no duration — the server is the duration authority.** A test asserting that a
14400-second read-back must be refused was wrong: what must never pass is the ledger contradicting
*itself* (`grantedSeconds` ≠ `grant.durationSeconds`), which is what the corrected case proves.

**A negative gate needs a positive control, or it proves nothing.** "No product is purchasable" is
satisfied by a broken network, a signed-out device, a dead App Store connection and a deliberate
server decision — and only the last one is the fact this slice claims. The evidence had to state
`storekit offered=3` and `status=200` *alongside* `purchaseEligible=0`, and the verdict enum had to
keep the failure modes as distinct tokens, before the zero meant anything.

**"It is provably absent" is weaker than "it was measured as zero."** `purchaseCalls` began as an
argument from a missing log line. A runtime tally at the single purchase site, incremented before
the call so it can only over-report, turns the same claim into a number a reader does not have to
reconstruct. That is worth a counter that gates nothing.

**The status code belongs in the evidence even when nothing branches on it.** `expectOK` had
already collapsed every non-2xx into `.unavailable`, so carrying the status changed no behaviour at
all — but `activeCount=0` under a 200 and `activeCount=0` under a fallback are entirely different
claims, and a log that cannot tell them apart makes the reader guess.

---

**BUILD 26T-R1A — PASS / CLOSED.** Release can sell; production is not selling; the app said so and
charged no one. Nothing was activated, purchased or written, and `PASS_1H` remains inactive.
**R1A-R1** (fulfil addressability) and **R1A-R2** (post-purchase settlement safety) are recorded in
§18 as the next two independent slices; **R1B** (ASC / app version submission readiness) remains a
Founder gate. None of them is started.
