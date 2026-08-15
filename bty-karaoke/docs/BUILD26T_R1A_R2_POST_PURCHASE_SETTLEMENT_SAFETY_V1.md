# BUILD 26T-R1A-R2 — Post-Purchase Settlement Safety (Activation TOCTOU)

**Status: PASS / CLOSED — 2026-08-14. Deployed. No product activated, no Apple charge, zero writes.**

`karaoke_product_catalog.is_active` is now formally defined at the **money boundary**:

```
BEFORE a charge   is_active is the authority to START one.
AFTER  a charge   is_active is silent. Settlement converges on the Apple signature,
                  the bindings and the durable ledger — never on a switch.
```

Both halves were required, and both are proven. They are **not** proven the same way, and the
difference is stated everywhere it matters in this document.

```
HALF 1  NEW MONEY            fresh inactive server authority prevents Product.purchase
        physical             the inactive surface, reconfirmed on Release build 100 against
                             production: 200 / activeCount=0 / offered=3 / eligible=0 / calls=0
        tests + mutation     the stale-active → inactive REFUSAL itself (G1–G12, 2 mutants)

HALF 2  MONEY ALREADY TAKEN  a legitimate Apple transaction is not blocked from settling
        physical             a genuine recorded Sandbox transaction replayed TWICE against
                             production while PASS_1H is inactive → 200, same durable purchaseId
```

> **The stale-active → inactive refusal was NOT physically exercised.** Doing so requires an active
> product and a real Buy tap, neither of which was authorized. That refusal rests on tests and
> mutation. This document does not claim otherwise anywhere.

---

## 1. Verdict

```
BUILD 26T-R1A-R2                   PASS / CLOSED
post-charge is_active veto         REMOVED — /verify was the only one (§2)
pre-charge authority               FRESH, taken at the charge, fails closed (§4)
migration                          NONE
new Apple charges                  0
new durable purchases              0
new paid grants                    0
new paid ISSUED audits             0
production census                  byte-identical, before and after
product.purchase sites             1        transaction.finish() sites        1
PASS_1H                            INACTIVE throughout
R1A-R1 production read-back        OBTAINED HERE (§6)
```

## 2. Preflight — the race, traced

**One post-charge blocker, not several.** Every `is_active` consumer in the server was enumerated:

```
src/lib/commerce-catalog.server.ts:55      .eq('is_active', true)   pre-purchase read — CORRECT, new-charge authority
src/lib/apple-purchase-ledger.server.ts    resolveCatalogProduct RETURNS it; decides nothing
src/app/api/host/purchases/apple/verify/   route.ts:160  if (!product.isActive) → 409   ← THE ONLY POST-CHARGE VETO
src/app/api/host/purchases/apple/fulfil/   route.ts:14   "SETTLEMENT DOES NOT CHECK is_active"
src/lib/apple-fulfilment.server.ts:15      "SETTLEMENT DOES NOT CONSULT is_active"
supabase/…_apple_paid_fulfilment_v1.sql:27 "SETTLEMENT DOES NOT READ is_active" — named columns, never select *
```

`/fulfil`, the `fulfil_apple_purchase` RPC and the durable read-back **already** implemented this
principle — BUILD 26S-R0 §8 Contract B, Founder-ratified. So the repair needed one place, and **no
migration**: the durable model already supported it.

**Identity was never conflated with authority.** `resolveCatalogProduct` matches on
`storekit_product_id` and does **not** filter on `is_active`, so a known product that is switched
off was always still a known product. Step 3 (`unknown_product`) is identity; step 6 was authority.
Removing step 6 leaves identity untouched — an unknown product is still refused.

**The native race, as it stood:**

```
CommerceStore.load()       reads the catalog when the SHEET APPEARS      (TimedPassStoreView .task)
  @Published catalog       resident for the lifetime of the sheet — unbounded staleness
CommerceStore.buy()        authority(for:) read that RESIDENT value
CommerceEngine.purchase(_ authorized: AuthorizedPurchase)   ← accepted a decision made elsewhere
PassPurchaseService.buy    the one product.purchase site
```

`CommerceEngine.purchase` performed no fresh server read. A sheet opened while active, left open,
and tapped after deactivation would have charged the customer.

## 3. Server repair — the money boundary

Step 6 deleted. The header and the site both state the contract so it cannot be "tidied" back in.

```
- if (!product.isActive) return 409 product_inactive
+ // THERE IS NO `is_active` CHECK HERE ANY MORE, AND ITS ABSENCE IS THE CONTRACT.
```

**Nothing else was weakened.** Signature, bundle identity, environment, product identity, owner
binding, `appAccountToken` binding, replay identity and the revocation branch all stand unchanged,
and each is asserted against an INACTIVE product in the new tests.

## 4. Native repair — just-in-time authority

**The TOCTOU was a function signature.** `CommerceEngine.purchase` no longer accepts an
`AuthorizedPurchase`. It takes the authority itself, at the instant of the charge:

```
CommerceStartAuthority.take(productID:source:session:)
  ├── freshCatalog()              authenticated, uncached, HTTP 200 REQUIRED explicitly
  ├── freshStoreKitProductIDs()   what Apple offers this device NOW
  └── CommercePurchaseAuthority.authorize(…)   the SAME pure dual gate the buttons use
        └── only on .success  →  PassPurchaseService.buy  →  product.purchase
```

It owns no new rules — a second rule set for "may we charge" would be a second place to get the
most expensive question in the system wrong. What it adds is freshness, plus one requirement the
render path does not need: **an explicit HTTP 200**, stated rather than inferred from `.loaded`, so
the two cannot silently diverge.

`CommercePurchaseStart` separates `refused` (no charge initiated, `purchaseCalls` unchanged) from
`attempted` (Apple was asked). A product that vanishes between the authority and the call is a
**refusal**, not a charge that failed.

The sheet's answer is now explicitly UI. `CommerceStore.buy` still consults it — only so a visibly
disabled button cannot be driven — and a refusal re-reads both authorities so the surface stops
offering what it has just discovered it cannot sell.

## 5. Half 1 — physical, on Release build 100 against production

`PASS_1H is_active=false`. The commerce surface was visually confirmed mounted — the 이용권 구매
section with 1h / 4h / 24h rows, all Buy buttons disabled — opened once and closed. **No Buy was
tapped.**

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

**What this proves:** on a build containing the just-in-time authority, the surface still reads
production correctly (200, zero authorized), Apple still offers all three, nothing is purchasable,
and no charge was initiated.

**What this does NOT prove:** the stale-active → inactive refusal. With nothing active, the Buy
path is never entered and `start-authority` never fires. That refusal is proven by §7, not here.

### The negative control that arrived by accident

An earlier attempt captured, on the same build and the same device:

```
[26T] commerce-catalog status=-
[26T] commerce-catalog activeCount=- products=0
[26T] storekit offered=0 ids=
[26T] purchaseEligible=0 of=3
[26T] purchaseCalls=0
[26T] RESULT=CATALOG_UNAVAILABLE_PURCHASE_BLOCKED
[26T] catalog=unavailable reason=network
```

The device had no network. `purchaseEligible=0` and `purchaseCalls=0` were true and **worthless** —
fully explained by a dead phone. The verdict reported `CATALOG_UNAVAILABLE_PURCHASE_BLOCKED`, not
`INACTIVE_CATALOG_PURCHASE_BLOCKED`, so the log could not be mistaken for a pass.

This is the single most valuable unplanned result in the slice: **the distinct-token design was
tested by reality, not by us.** Had those two states shared a token, that log would have read
exactly like the passing one above. It was recorded as a negative control and rejected.

## 6. Half 2 — physical, production settlement while inactive

`PASS_1H is_active=false`. The **already-recorded** BUILD 26R Sandbox transaction was replayed
twice against production through a real authenticated host session:

```
[26T-R2-REPLAY] armed=true signedTransaction=PROVIDED
[26T-R2-REPLAY] attempt=1 status=200 ok=true error=- replayed=true purchaseId=28ab7288-ed3b-43b6-acef-484d1f635032
[26T-R2-REPLAY] attempt=2 status=200 ok=true error=- replayed=true purchaseId=28ab7288-ed3b-43b6-acef-484d1f635032
[26T-R2-REPLAY] RESULT=SETTLEABLE_WHILE_INACTIVE purchaseId=28ab7288-ed3b-43b6-acef-484d1f635032
```

Server-side `wrangler tail`, independently:

```
POST …/api/host/purchases/apple/verify - Ok @ 1:39:29 PM
POST …/api/host/purchases/apple/verify - Ok @ 1:39:31 PM
```

Two `/verify` POSTs. **Zero `/fulfil`.** Every §H criterion met:

```
PASS_1H currently inactive                                   YES  is_active=false
genuine existing Apple transaction verifies/replays          YES  200, replayed=true, both attempts
CURRENT inactive status does not veto                        YES  no product_inactive anywhere
successful response exposes purchaseId                       YES
purchaseId == existing durable row UUID                      YES  28ab7288-… (the 26P/26S row)
repeat replay returns the identical purchaseId               YES  byte-for-byte
durable purchase count unchanged                             YES  1 → 1
no duplicate grant                                           YES  1 → 1
no duplicate paid ISSUED audit                               YES  1 → 1
no new Apple charge                                          YES  0
```

**This also delivers BUILD 26T-R1A-R1's missing production read-back.** R1A-R1 closed with the
`purchaseId` contract proven only by tests and artifact parity, because the 200 branch was
unreachable in production — the one real transaction was refused at step 6. Removing that veto made
the branch reachable, and the id was observed on production for the first time here.

### The harness, and why it was necessary

There was no way to make an authenticated `/verify` call: host tokens are stored as `token_hash`
only, both production paths to `/verify` need an unfinished transaction and BUILD 26S-R2B finished
the only one, and the 26R fixture pins fingerprints rather than a JWS.

`VerifyReplayGate` closes that gap honestly. It is DEBUG-only with the whole file inside one guard,
it imports no StoreKit, and it has no purchase, fulfil or finish capability by construction. The
JWS is supplied at launch, never embedded. The Release binary contains **0** occurrences of the
flag and of every gate symbol. Its verdict names each failure shape separately
(`STILL_VETOED_BY_INACTIVE`, `PURCHASE_ID_UNSTABLE`, `NOT_ACCEPTED`) so it cannot launder a failure
into a pass.

## 7. Tests and mutation

```
server   2893 passed / 0 failed    (was 2886, +7)     tsc --noEmit clean
native   2751 passed / 0 failed    (was 2707, +44)
Release  BUILD SUCCEEDED, build 100      Debug BUILD SUCCEEDED
```

The required matrix, and where each item is proven:

| # | Required | Proven by |
|---|---|---|
| 1 | fresh active + offered → purchase reachable | 26T-R2-G1 (+G1b: both authorities re-asked) |
| 2 | sheet active, fresh inactive → 0 calls | **26T-R2-G2 — the TOCTOU refusal** |
| 3 | fresh network failure → 0 calls | 26T-R2-G3 |
| 4 | fresh auth failure → 0 calls | 26T-R2-G4 / G4b / G4c |
| 5 | StoreKit product absent → 0 calls | 26T-R2-G5 |
| 6 | exact TOCTOU order settles | server: "the TOCTOU order settles" |
| 7 | inactive → no veto, purchaseId returned | server: inactive → 200 + id; §6 physically |
| 8 | replay → same purchaseId | server + ledger; §6 physically |
| 9–14 | unknown product, owner, token, JWS, environment, revoked still refused | "every non-activation refusal still fires while the product is inactive" |
| 15 | fulfil idempotency unchanged | untouched — no `/fulfil` code, tests or RPC modified |
| 16 | one `product.purchase` site | 26T-R2-G9 (whole-directory count) |
| 17 | one `transaction.finish()` site | 26T-R2-G9b (whole-directory count) |
| 18 | no duplicate grant from replay | §8 census: grants 1 → 1 after two replays |

**Mutation — three critical-boundary mutants, three kills:**

```
bypass the fresh catalog read (trust the stale sheet)   → 2 native tests fail
drop the explicit HTTP 200 requirement                  → 1 native test fails
reintroduce the post-charge is_active veto              → 6 server tests fail
```

Every mutated file was restored from backup and the diff re-verified before committing.

**Three tests were EVOLVED, none deleted.** `INACTIVE → 409`, `inactive replay → 409` and R1A-R1's
"stays unaddressable" asserted the old contract. Each now asserts the new one and carries an inline
note saying what it used to assert and why that was correct at the time.

## 8. Census — before and after

```
                          BEFORE   AFTER
Apple purchases                1       1     Sandbox 1 · Production 0
paid grants                    1       1     006bc34f-…
paid ISSUED audits             1       1
grants total                  56      56
audit total                  156     156
catalog                        3       3
catalog is_active=true         0       0     PASS_1H · PASS_4H · PASS_24H all false
```

`diff` empty against the R1A-R2 pre-deploy census **and** against the BUILD 26T-R1A closure
baseline. Two production `/verify` replays moved nothing: the conflict path is a `SELECT`, so a
replay reads the durable winner rather than writing.

## 9. Deployment and commits

```
Worker      1aa361c8-3cff-4efe-8c13-4292db9daf82  (100%)  2026-08-14T19:05:18Z
previous    e957b4dd-d88a-4d07-a8c5-e58885955fa8  (BUILD 26T-R1A-R1, rollback target)
migration   NONE — parity stays 20260816120000

server      9d6d1f37   implementation only
native      184fd08    implementation only, Release build 100
```

**Source/deployment parity, measured not assumed.** The committed tree rebuilds the `/verify`
handler **byte-identically** to the deployed artifact:

```
sha256  3a9ac69d1b3027d9d01373a7174ec8ddc44f99bd25b2ad87aa7186d0af67d9a6
deployed bundle: product_inactive ×0 · unknown_product ×1
```

The implementations were committed **before** this closure was written, so production was never
left running uncommitted source while the last device capture was outstanding.

## 10. Historical semantics — preserved as historical truth

**BUILD 26L §5, 26P, 26R-R2 and 26S recorded `inactive → /verify product_inactive`, and that was
correct under the contract of those milestones.** There was no shipping purchase path, so the only
thing the gate could refuse was a transaction the app had no way to have originated. 26R-R2's
`409 product_inactive` remains sealed evidence of the contract it was written against.

```
THIS IS      contract evolution, discovered while productionizing commerce
THIS IS NOT  a correction of a defect in 26L / 26P / 26R / 26S
```

No historical closure document was edited.

## 11. What this slice did NOT do

```
activate any product                            NO   catalog still 3 / 0 active
tap Buy or invoke Product.purchase              NO   purchaseCalls=0, measured at runtime
create an Apple charge, purchase, grant, audit  NO   census byte-identical
call /fulfil or transaction.finish()            NO   0 fulfil requests observed server-side
add a migration                                 NO   the durable model already supported it
change /fulfil or /fulfilment authorization     NO
weaken any non-activation check                 NO   each re-asserted against an inactive product
edit historical closure documents               NO
sweep TRACK_B0 or unrelated Founder WIP         NO
ASC submission readiness · R1B · R2 · R3        NOT STARTED
```

## 12. Hard-won notes

**The TOCTOU was a type signature, not a missing check.** `purchase(_ authorized: AuthorizedPurchase)`
is what let a stale decision travel to the moment money moves. Adding a re-check while keeping the
parameter would have left the unsafe path callable; removing the parameter made the safe path the
only one. When a race is expressible in a signature, fix the signature.

**Require the status explicitly even when it is currently implied.** `.loaded` already meant HTTP
200. Asserting `httpStatus == 200` changed no behaviour today and is what stops a future transport
from quietly turning some other 2xx into permission to charge. The mutant that removed it was
killed by exactly one test — which is the point of having written it.

**A refusal is not a failed attempt.** A product that disappears between the authority and the call
returns `.refused`, not `.attempted(.failed)`. Conflating them would have made "we asked Apple to
charge someone" indistinguishable from "we decided not to", in the one place that distinction is
the whole question.

**Reality tested the negative control.** A phone with no network produced `purchaseEligible=0` and
`purchaseCalls=0` — the passing numbers — and the verdict correctly said
`CATALOG_UNAVAILABLE_PURCHASE_BLOCKED`. Distinct tokens for distinct failures are not pedantry;
they are the difference between evidence and a coincidence.

**Every failed attempt at the device capture was device state, never the capture.** Locked screen,
an invalidated wireless CoreDevice tunnel, no network. Worth diagnosing the harness before
re-running it, and worth saying plainly instead of retrying in silence.

---

**BUILD 26T-R1A-R2 — PASS / CLOSED.** `is_active=false` stops the initiation of new
`Product.purchase` calls; an already-created legitimate Apple transaction settles regardless. Both
halves proven — Half 1's surface physically, its refusal by test and mutation; Half 2 physically on
production. No product was activated, no Apple charge occurred, and the production census is
unchanged. **PASS_1H remains inactive.** ASC readiness, controlled activation and the first genuine
post-activation production purchase all remain unstarted and require Founder authorization.
