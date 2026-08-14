# BUILD 26T-R1A-R1 — Production Fulfil Addressability

**Status: PASS / CLOSED — 2026-08-14. Deployed. Zero writes, zero charges, zero grants.**

> **Physical production replay was NOT obtained, and the reason is measured, not assumed.** The
> only genuine recorded Apple transaction is for `PASS_1H`, which is `is_active=false`, so a
> production replay returns **409 `product_inactive`** — a branch that deliberately carries no
> `purchaseId`. The 200 branch is **unreachable in production** until a product is active, which
> this slice is not authorized to do. See §7, and the Founder decision it asks for.

A verified purchase that cannot be named cannot be settled. `/fulfil` and `/fulfilment` both take
the durable `karaoke_apple_purchases.id`, and `/verify` computed that id and threw it away. It now
returns it.

```
BEFORE  { ok, verified, recorded, entitlementIssued, replayed, productCode }
AFTER   { ok, verified, recorded, entitlementIssued, replayed, productCode, purchaseId }
        ^ additive. no field renamed, no type changed, no status code moved.
```

---

## 1. Verdict

```
BUILD 26T-R1A-R1                  PASS / CLOSED
/verify 200 returns purchaseId    YES   durable karaoke_apple_purchases.id
replay returns the same id        YES   proven at the ledger boundary (§5)
refusals disclose an id           NO    all 8 refusal paths asserted (§5)
extra DB query required           NONE  the id was already in memory (§3)
/verify semantics                 VERIFY + RECORD — unchanged
migration                         NONE
new Apple charges                 0
new durable purchases             0
new paid grants                   0
new paid ISSUED audits            0
production census                 byte-identical, before and after
activation TOCTOU                 NOT TOUCHED — still R1A-R2
PASS_1H                           INACTIVE
```

## 2. Preflight — measured before editing

```
HEAD == origin/main       4658aa5e  (0 ahead / 0 behind)
staged                    0          — Founder WIP (76 modified, 320 untracked) untouched
route                     src/app/api/host/purchases/apple/verify/route.ts
durable writer            recordVerifiedApplePurchase  (src/lib/apple-purchase-ledger.server.ts)
durable PK                karaoke_apple_purchases.id   uuid, gen_random_uuid()
```

**Response shapes as they stood:**

```
200  { ok:true,  verified:true,  recorded:true,  entitlementIssued:false, replayed, productCode }
409  product_inactive             verified:true  recorded:true   (+ base)
422  revoked_transaction          verified:true  recorded:true   (+ base)
422  invalid signature / claims   verified:false recorded:false
403  account_binding_mismatch     verified:true  recorded:false
422  unknown_product              verified:true  recorded:false
409  transaction_already_claimed  verified:true  recorded:false
500  ledger_invariant_conflict    verified:true  recorded:false
```

**Replay behaviour:** the insert races `karaoke_apple_purchases_env_txn_idx`
(UNIQUE `environment, apple_transaction_id`). On `23505` the module reads the durable winner,
refuses a cross-account claim, refuses a product contradiction, and otherwise returns the winner
with `replayed: true`. There is no read-then-insert window.

**Enforcement confirmed unchanged:** owner binding (`purchase_owner_ref` read from the SESSION
account), `appAccountToken` binding (`expectedAppAccountToken`), transaction / environment /
bundle / product validation, the inactive branch, and VERIFY + RECORD. No authentication,
authorization or validation code was touched.

## 3. The finding that made this a two-line change

`recordVerifiedApplePurchase` **already returns `purchaseId`** — on both paths:

```ts
insert  →  { ok: true, purchaseId: String(data.id),   productCode, replayed: false }
23505   →  { ok: true, purchaseId: String(winner.id), productCode, replayed: true  }
```

The route destructured `outcome.productCode` and `outcome.replayed` and dropped `outcome.purchaseId`
on the floor. **No extra query, no second select, no new code path.** The Founder's preference for
zero additional DB work was already satisfied by the existing implementation.

## 4. Files changed

```
MOD  src/app/api/host/purchases/apple/verify/route.ts       +26 / -2   (24 lines are the rationale)
MOD  src/app/api/host/purchases/apple/verify/route.test.ts  +6 tests
NEW  src/lib/apple-purchase-ledger.server.test.ts           +8 tests
```

Untouched: `/fulfil`, `/fulfilment`, their authorization, the settlement RPC, every schema, the
catalog, `apple-iap.server.ts`, `domain/apple-transaction.ts`, and all native code.

**The disclosure is at the 200 only.** `base` — the object the 409 and 422 branches spread — was
left without `purchaseId` and carries a comment saying why. That is what keeps a refusal from
handing back an address.

## 5. Test matrix

```
server suite   2886 passed / 0 failed    (was 2872, +14)
tsc --noEmit   clean
```

| # | Required | Proven by |
|---|---|---|
| 1 | first success → valid UUID, matches the durable row | route: id returned & UUID-shaped · ledger: it is `data.id` from the insert |
| 2 | replay → same `purchaseId` byte-for-byte | ledger: first vs 23505-replay ids compared directly |
| 3 | replay-safe convergence, one row | ledger: 5 replays all name one id; exactly 1 insert attempted, 1 select |
| 4 | owner mismatch → refusal preserved, no leak | route: `transaction_already_claimed` · ledger: cross-account conflict returns no id |
| 5 | malformed JWS → refusal preserved | route: `invalid_apple_signature`, 422, no id |
| 6 | wrong `appAccountToken` → refusal preserved | route: mismatched and missing token, no id |
| 7 | wrong product / environment → preserved | route: `unknown_product`, environment mismatch, no id |
| 8 | inactive → **historical behaviour preserved** | route: 409 `product_inactive`, `recorded:true`, and **no** `purchaseId` |
| 9 | no grant/entitlement change | `entitlementIssued:false` on every path; ledger writes `NOT_GRANTED` / null / null |
| 10 | no `/fulfil`, `/fulfilment`, `finish()` | structural: the route imports and matches none of them |

Two more, beyond the required matrix:

* **the id is not derived from Apple** — asserted `!==` transaction id, `appAccountToken` and
  product id, and the 200 body's key set is pinned to exactly seven names, so a future field cannot
  be added to this endpoint without a test noticing;
* **a non-`23505` database error is thrown, never converted into an outcome** — a ledger that
  turns an unknown error into a verdict is a ledger that has stopped being evidence.

### The tests are not vacuous — three mutants, three kills

```
route returns { ok:true, ...base } again      →  3 route tests fail
replay returns String(t.transactionId)        →  3 ledger tests fail
purchaseId moved into `base` (leaks to 409)   →  2 route tests fail
```

Both files were restored from backup and the diff re-verified before committing.

## 6. Deployment

```
Worker       e957b4dd-d88a-4d07-a8c5-e58885955fa8  (100%)  2026-08-14T18:18:01Z
previous     bae0b14d-6092-457e-bf7e-169130a4f163  (BUILD 26T-R1A, rollback target)
migration    NONE — parity stays 20260816120000
```

**Artifact parity, measured in the deployed bundle** rather than inferred from the source:

```
…isActive?NextResponse.json({ok:!0,...l,purchaseId:k.purchaseId},{headers:…
                            ^ the 200 branch, and the ONLY site that adds it
{ok:!0,purchaseId:String(e.id),…replayed:!1}      ← ledger insert path
{ok:!0,purchaseId:String(g.id),…replayed:!0}      ← ledger replay path
```

`base` (`l`) does not contain the field — which is precisely why the spread has to add it. Both
origins still answer `401` to an unauthenticated `POST`.

## 7. Production proof — NOT OBTAINED, and exactly why

The Founder's §F asked for a replay of the existing recorded transaction if it could be done
without a charge, a new row, fulfilment, entitlement or `finish()`. It cannot — for a reason worth
stating precisely, because it is **not** the reason that was anticipated.

**The JWS is available.** It is not the blocker:

```
karaoke_apple_purchases  28ab7288-ed3b-43b6-acef-484d1f635032
  environment                 Sandbox
  storekit_product_id         com.btydaily.norebang.pass.1hour   → product_code PASS_1H
  verification_status         VERIFIED    grant_status GRANTED
  signed_transaction_payload  PRESENT — 5434 chars, 3 segments
  signed_transaction_sha256   PRESENT
```

**The blocker is the branch order.** `PASS_1H` is `is_active=false`, and the route decides
operational authorization at step 6, *before* the 200:

```
step 4  record / replay the durable row     → outcome.purchaseId is in hand
step 5  revoked?                            → no
step 6  product.isActive === false          → 409 product_inactive, spreading `base`
        (…the 200 with purchaseId is never reached)
```

So a production replay of the only genuine transaction we have returns **409 without a
`purchaseId`** — which is the contract behaving *correctly*, and therefore proves nothing about the
field this slice added. Reaching the 200 branch in production would require activating a catalog
product, which R1A-R1 is explicitly **not authorized** to do.

**A second, independent obstacle.** Even the 409 replay could not be executed from here: host
session tokens are stored as `token_hash` only (3 active sessions, no raw value recoverable), and
no token was invented or derived from a hash. The device's Keychain holds one, but the native app
reaches `/verify` only through a purchase or an unfinished-transaction recovery, and
`Transaction.unfinished` is empty — BUILD 26S-R2B finished the only transaction that was ever in it.

**Per §F, therefore:** the contract is proven by tests plus source/deployment parity (§5, §6), and
physical production replay is reported as **unavailable for the measured reason above**.

> **HALT — Founder decision requested.** Reaching the deployed 200 in production requires one of:
> (a) accept tests + artifact parity as sufficient for R1A-R1 and let the first real acceptance
> transaction in R3 be the production proof; (b) authorize a temporary `PASS_1H` activation purely
> to replay the existing Sandbox transaction and read the 200 — which is a catalog write, and is
> also the exact TOCTOU window R1A-R2 exists to close; or (c) defer the production proof until
> R1A-R2 has defined post-charge settlement safety. **This document assumes none of them.**

**This is R1A-R2 arriving early, as an evidence problem.** The reason the id cannot be observed in
production is the same reason a legitimately paid customer could not be settled today: an inactive
product refuses the transaction *after* Apple has taken the money. R1A-R1 supplies the address;
R1A-R2 must decide when an already-paid transaction is allowed to use it.

## 8. Census — before and after

```
                          BEFORE   AFTER
Apple purchases                1       1     Sandbox 1 · Production 0
paid grants                    1       1
paid ISSUED audits             1       1
grants total                  56      56
audit total                  156     156
catalog                        3       3
catalog is_active=true         0       0
```

`diff` is empty against the pre-deploy census **and** against the BUILD 26T-R1A closure baseline.
R1A-R1 created: 0 Apple charges, 0 durable purchases, 0 paid grants, 0 paid ISSUED audits.
Every probe was a read.

## 9. Historical contract — preserved, not rewritten

**BUILD 26P defined `/verify` as VERIFY + RECORD and did not disclose the durable row id. That was
correct in its context.** There was no caller that needed to address the row: the endpoint granted
nothing, `/fulfil` did not exist yet, and an identifier with no consumer is surface area with no
purpose. Withholding it was the conservative choice, and it was the right one.

BUILD 26T built the production settlement pipeline, and with it a requirement that did not exist
before: **a successfully verified purchase must be addressable by `/fulfil`.**

```
THIS IS      contract evolution — a new addressability requirement
THIS IS NOT  a correction of a mistake in BUILD 26P
```

No historical closure document was edited. BUILD 26P's, 26R's and 26S's evidence stands exactly as
written, including 26R-R2's `409 product_inactive` and 26S-R2A's use of the pinned fixture id — that
workaround was necessary *because* the id was withheld, and recording why it was needed is not the
same as calling the original decision wrong.

## 10. What this slice did NOT do

```
change /verify semantics beyond one additive field   NO   still VERIFY + RECORD
fulfil anything                                      NO
create an entitlement or grant                       NO
call transaction.finish()                            NO
initiate an Apple charge                             NO
activate PASS_1H or write to the catalog             NO
add a migration                                      NO
change /fulfil or /fulfilment authorization          NO
repair the activation TOCTOU                         NO   — R1A-R2, §11
touch native code                                    NO   — the client already decodes purchaseId
sweep unrelated Founder WIP or the TRACK_B0 gap      NO
```

The native production pipeline needed no change: `CommercePipeline` already decodes `purchaseId`
and already fails closed at `purchaseIdentityUnavailable` when it is absent. That failure mode is
now unreachable for an accepted transaction.

## 11. Next blocker — PRESERVED, NOT FIXED

**BUILD 26T-R1A-R2 — post-purchase settlement safety / activation TOCTOU.** Mandatory before
commerce activation.

```
T0   client reads the catalog                    product is_active = true
T1   Product.purchase()                          APPLE CHARGES THE CUSTOMER
T2   operator sets is_active = false
T3   client POST /verify
T4   the current contract refuses: 409 product_inactive
```

The invariant to preserve for that slice:

```
is_active controls the authority to START a new Apple charge.

It must NOT ultimately act as a kill switch for the settlement of a legitimate Apple
transaction after Apple has already successfully charged the customer.
```

R1A-R1 deliberately left the inactive branch exactly as it found it — same status, same error
string, same `recorded: true`, and no `purchaseId`. Making an inactive refusal addressable is a
settlement-safety decision, and it belongs to R1A-R2.

## 12. Hard-won notes

**The change was already written; only the disclosure was missing.** The instinct on reading
"add `purchaseId`" is to reach for the row. The measurement said otherwise: the value had been
computed, returned and discarded three lines above the response. Preflight §9–10 exists to catch
exactly this, and it turned a schema conversation into a two-line one.

**An additive field still needs a boundary.** `...base` is spread into two refusal branches, so
adding the field one level too high would have silently made every recorded-but-refused transaction
addressable — including the inactive one this slice was told not to touch. The safe place was the
narrowest one, and the comment on `base` is there so the next person does not undo it by tidying.

**The proof that could not be obtained is itself the finding.** The production replay failed not
because the JWS was missing or the token was unreachable — those were the anticipated risks — but
because the only real transaction we own is refused before the branch under test. An honest
"unavailable, and here is the measured reason" is worth more than a green tick manufactured by
activating a product.

---

**BUILD 26T-R1A-R1 — PASS / CLOSED.** A successfully verified purchase is now addressable by the
durable row id; a replay returns the identical id; `/verify` remains VERIFY + RECORD; no
fulfilment, no entitlement, no Apple charge, no write. BUILD 26P's contract remains valid in its
original context. **PASS_1H remains inactive, and R1A-R2 is not started.**
