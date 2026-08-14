# BUILD 26R-R2 — Genuine Sandbox Purchase + Apple JWS Server Verification

**Status: PASS / CLOSED — 2026-08-14. Gates G1–G33 all measured.**

BUILD 26P shipped a verifier with nothing genuine to verify. BUILD 26Q created the products,
BUILD 26R-R0/R1 proved the app could see them. This slice closes the loop: a real Apple Sandbox
purchase, on a real iPhone, whose Apple-signed JWS travelled to the production Worker and became a
durable `VERIFIED / NOT_GRANTED` ledger row — **while all three catalog products remained
`is_active = false` and no entitlement was granted.**

```
Product.purchase(.appAccountToken)  →  verified Transaction  →  Apple JWS
        →  POST /api/host/purchases/apple/verify  →  409 product_inactive
        →  karaoke_apple_purchases: VERIFIED / NOT_GRANTED / pass_grant_id NULL
```

BUILD 26P's deferred "genuine Apple-signed transaction" proof is **no longer deferred**.

---

## 1. Verdict

```
BUILD 26R-R2 — PASS / CLOSED     G1 … G33 measured
paid entitlement fulfilment      NOT IMPLEMENTED
Transaction.finish authority     NOT IMPLEMENTED
```

## 2. What was ratified before this build ran

```
1  expose karaoke_accounts.purchase_owner_ref via GET /api/host/me as purchaseOwnerRef
2  R2 success is NOT HTTP 200 — it is 409 product_inactive with verified/recorded true
3  karaoke_product_catalog.is_active stays FALSE on all three
4  Transaction.finish() remains FORBIDDEN
```

All four held. Nothing was activated, weakened or bypassed to obtain the result.

## 3. Baseline

```
monorepo   54991660  feat(karaoke): BUILD 26R-R2 Phase A — expose purchaseOwnerRef   pushed
native     59512ab   feat(karaoke-ios): BUILD 26R-R2 — Sandbox purchase acquisition  pushed
Worker     135e0b90-c84c-408c-9b48-bf9a5610be91 @ 100%, deployed 2026-08-14T05:01:46Z
MIGRATION  NONE — parity stays 20260815120000
```

The physical gate ran against **exactly the committed build 97**; no code changed during or after
it. The only dirty file in the native tree is the pre-existing local `xcscheme` rig, untouched.

## 4. Phase A — the one prerequisite

`GET /api/host/me` now returns top-level `purchaseOwnerRef`, read from the account's existing
`karaoke_accounts.purchase_owner_ref` (BUILD 26E created it; BUILD 26L §11 designated it as the
`appAccountToken` carrier). Authenticated Host only, own account only, additive, **no migration and
no new endpoint**.

It was deliberately NOT added to `publicAccount()`. That helper is serialized by
`/host/auth/apple`, `/host/auth/google` and the web `HostEntryScreen`; widening it would have
pushed a payment-binding identifier into three surfaces with no use for it. Tests pin the
projection's exact key set (`displayName`, `email`, `id`) and read both sign-in routes as source to
prove neither grew the field.

Production authority, read-only: 24 accounts · 0 null refs · 24 distinct · 0 equal to `id` · 0
equal to `authority_ref` · 24/24 canonical UUID form.

## 5. Physical environment

```
device        Hanbit Chi's iPhone — iPhone 17 Pro Max (iPhone18,2)
              80C931D3-265B-5B37-B608-F3EB200C66AA, CoreDevice tunnel
app           BTY Norebang · com.bty.BTYNorebangAdmin · 1.0 (97) · Debug
signing       Apple Development: Hanbit Chi (Z4X34T4VRN)
              "iOS Team Provisioning Profile: com.bty.BTYNorebangAdmin" (1520451f-…)
install       xcrun devicectl device install app — DEVELOPMENT-SIGNED, not TestFlight
environment   Apple Sandbox (Sandbox Apple Account signed in by the Founder)
authority     [GATE-B23] api-base=production — the REAL Worker, not an override
launch        devicectl … --console --terminate-existing … -- -BTYPassPurchaseGate
purchase      2026-08-14T05:31:09Z          server verified_at 2026-08-14T05:31:32.941Z
```

No Sandbox credential appears in this document, in source, or in any commit.

## 6. Attempt 1 — the cancelled branch, kept in the record

```
GATE_START_UTC=2026-08-14T05:26:22Z
[26R-R2] gate=armed
[26R-R2] host session present
[26R-R2] purchaseOwnerRef present=true parses=true fp=8107d5628079…
[26R-R2] discovery found=1 missing=0
[26R-R2] preflight ready product=com.btydaily.norebang.pass.1hour tokenFp=8107d5628079…
[26R-R2] RESULT userCancelled — transactions created=0, server POST=0
```

`userCancelled` is the one branch §8 permits repeating, because no transaction exists to duplicate.
That was verified rather than assumed: the ledger was re-read immediately afterwards and still held
**0** Apple purchases. The app was then terminated and the SAME build relaunched — a fresh process,
so `attempts` starts at 0 again. This is the only reason a second tap was legitimate.

## 7. Attempt 2 — the genuine purchase

```
GATE2_START_UTC=2026-08-14T05:30:58Z
[GATE-B23] api-base=production
[26R-R2] gate=armed
[26R-R2] host session present
[26R-R2] purchaseOwnerRef present=true parses=true fp=8107d5628079…
[26R-R2] discovery found=1 missing=0
[26R-R2] preflight ready product=com.btydaily.norebang.pass.1hour tokenFp=8107d5628079…
[26R-R2] RESULT verified txnFp=9a4eafea51f2… product=com.btydaily.norebang.pass.1hour env=Sandbox
[26R-R2] appAccountToken read-back MATCH fp=8107d5628079…
[26R-R2] JWS present=true segments=3 bytes=5434 compact=true
[26R-R2] JWS sha256=edc5b8e7506009743b0db91f3671cc9d31c37ae360cd85eb19fd9710aa1130f8
[26R-R2] POST status=409 error=product_inactive verified=Optional(true) recorded=Optional(true)
         entitlementIssued=Optional(false) replayed=Optional(false) productCode=PASS_1H
[26R-R2] VERDICT recordedNotGranted replayed=false productCode=PASS_1H authorizesFinish=false
```

`.success(.verified(transaction))` — not `.pending`, not `.unverified`. The JWS is the genuine
`VerificationResult.jwsRepresentation`, never reconstructed, re-encoded or re-signed.

## 8. Server response

```
HTTP 409     Cache-Control: no-store, max-age=0
{ "ok": false, "error": "product_inactive",
  "verified": true, "recorded": true, "entitlementIssued": false,
  "replayed": false, "productCode": "PASS_1H" }
```

Exactly the sealed expected result. **The status code alone is not the pass** — a 409 carrying
`verified: false` or `recorded: false` would be a failure wearing the right code, which is why the
client verdict requires all four fields to agree and four unit tests say so.

## 9. Durable ledger — READ ONLY

| | before | after |
|---|--:|--:|
| **Apple purchases** | 0 | **1** |
| Paid grants | 0 | **0** |
| All grants | 55 | **55** |
| Catalog rows | 3 | **3** |
| Catalog `is_active=true` | 0 | **0** |
| Audit rows | 155 | **155** |

```
environment             Sandbox
storekit_product_id     com.btydaily.norebang.pass.1hour
product_code            PASS_1H
verification_status     VERIFIED
grant_status            NOT_GRANTED
pass_grant_id           NULL
granted_seconds         NULL
source                  STOREKIT_CLIENT
quantity                1
purchase_date           2026-08-14T05:31:09+00:00
verified_at             2026-08-14T05:31:32.941+00:00
verification_attempts   1
refunded_at / revoked_at  NULL / NULL
apple_original_transaction_id == apple_transaction_id   true  (a first purchase)
```

The grant/audit totals are unchanged too — a paid purchase produced **no** grant and **no** audit
row, which is what "recording is not granting" means in the data.

## 10. End-to-end correlation

**Product identity, five authorities:**

```
StoreKit Product.id            com.btydaily.norebang.pass.1hour
verified Transaction.productID com.btydaily.norebang.pass.1hour
Apple JWS productId            com.btydaily.norebang.pass.1hour   (server-verified, → PASS_1H)
server catalog                 PASS_1H
ledger product_code            PASS_1H
```

**Account binding, five authorities — one UUID, fingerprinted not printed:**

```
production karaoke_accounts.purchase_owner_ref   8107d5628079…   (1 matching row, live)
GET /api/host/me purchaseOwnerRef                8107d5628079…
Product.purchase option .appAccountToken         8107d5628079…
verified Transaction.appAccountToken             8107d5628079…
ledger purchase_owner_ref                        8107d5628079…
server validator                                 accepted (no account_binding_mismatch)
```

No fingerprint collisions exist across all 24 accounts, so a single match identifies one row.

**The exact payload, proven identical on both sides:**

```
device JWS sha256                          edc5b8e7506009743b0db91f3671cc9d31c37ae360cd85eb19fd9710aa1130f8
ledger signed_transaction_sha256           edc5b8e7506009743b0db91f3671cc9d31c37ae360cd85eb19fd9710aa1130f8
sha256 RECOMPUTED from the stored payload  identical
stored payload                             5434 bytes, 3 segments  (matches the device's measurement)
transaction id fingerprint                 device 9a4eafea51f2…  ==  ledger 9a4eafea51f2…
```

The digest was recomputed from the stored payload rather than trusting the stored digest column —
otherwise the comparison would only prove the server can copy a hash.

## 11. Safety proof

```
purchases performed                 1  (PASS_1H, Sandbox, deliberate, Founder-tapped)
PASS_4H purchases                   0
PASS_24H purchases                  0
Production-environment purchases    0
paid grants created                 0
pass_grant_id                       NULL
entitlementIssued                   false
catalog activations                 0     (is_active still false on all three)
Transaction.finish() calls          0
migrations                          0
purchase retries                    0
POST retries                        0
```

`Transaction.finish()` measured across **all 39 shipped Swift sources**: two textual hits exist,
both in prose documenting the prohibition; with full-line comments stripped the executable count is
**0**. Exactly **one** `.purchase(options:` call site exists in the whole app.

The Sandbox transaction is **intentionally left unfinished**. That is expected debt for the
fulfilment build, not a leak to tidy up: BUILD 26P answers `VERIFIED / NOT_GRANTED`, so no
entitlement exists to finish against, and finishing would destroy the customer's only
re-presentable evidence of a purchase they paid for.

## 12. Release cannot purchase — proven in the binary

The gate is a DEBUG-only screen behind `-BTYPassPurchaseGate` that REPLACES the app root, so no
shipping screen can route to a purchase trigger. Verified at symbol level, not by source scan:

| symbol | Debug dylib | Release executable |
|---|--:|--:|
| `PassPurchaseGateView` | 290 | **0** |
| `PassPurchaseService` | 24 | **0** |
| `PassStoreDiscovery` | 98 | **0** |
| `PassStoreProductID` | 60 | **0** |
| links `StoreKit` | yes | **no** |

The Release binary does not link StoreKit at all — every reference sits inside `#if DEBUG`, so the
whole purchase surface is dead-stripped.

## 13. Files changed

| File | Why |
|---|---|
| `src/lib/host-auth.server.ts` | `purchase_owner_ref` in `ACCOUNT_COLS` + `HostAccount`; `publicAccount()` explicitly unchanged |
| `src/app/api/host/me/route.ts` | +1 field, `purchaseOwnerRef` |
| `src/app/api/host/me/route.test.ts` | **new** — 8 tests, mostly negative |
| `PassPurchase.swift` | **new** — pure: preflight, binding read-back, JWS shape, server verdict, SHA-256 fingerprints |
| `PassPurchaseService.swift` | **new** — the app's only `product.purchase` call site |
| `PassPurchaseGateView.swift` | **new** — DEBUG-only one-shot gate |
| `PassStoreDiscovery.swift` | `+product(for:)` — re-ask the store immediately before buying |
| `HostModels.swift` | `+purchaseOwnerRef: String?` (optional = forward-compatible, fails closed) |
| `APIClient.swift` | `+verifyApplePurchase` — one-field body, returns status so 409 is readable |
| `BTYNorebangAdminApp.swift` | DEBUG gate branch; production root extracted verbatim |
| `project.pbxproj` · `Tests/*` | registration, build 96 → 97, 91 new checks |

**BUILD 26R-R0/R1 files are byte-identical.** The R2 model was first written into
`PassStoreProducts.swift` and reverted: that file is banned from containing `appAccountToken`, and
the honest fix was a new file, not a relaxed ban.

## 14. Tests / build / deploy

```
npx vitest run                       234 files · 2779 passed · 0 failed   (8 new)
npm run lint (tsc --noEmit)          clean
cf:build → versions upload → versions deploy 135e0b90 @100%   SUCCESS

bash Tests/run.sh                    2303 passed · 0 failed   (91 new)
xcodebuild Debug   id=80C931D3-…     ** BUILD SUCCEEDED **
xcodebuild Release generic/iOS       ** BUILD SUCCEEDED **
devicectl install → 1.0 (97) on device
```

No test was weakened. Three build-number pins advanced 96 → 97, including the count-based one
(`== 2` occurrences, `== 0` of the old value) that BUILD 26J's rule exists to preserve.

## 15. Gate ledger

```
G1  ✅ /api/host/me exposes own purchaseOwnerRef      G18 ✅ replayed=false on the clean first POST
G2  ✅ matches production DB authority (1 row)        G19 ✅ productCode=PASS_1H
G3  ✅ parsed to UUID, no fallback generation         G20 ✅ durable ledger row exists
G4  ✅ real Sandbox Apple Account                     G21 ✅ verification_status=VERIFIED
G5  ✅ real physical iPhone 17 Pro Max                G22 ✅ grant_status=NOT_GRANTED
G6  ✅ real ASC PASS_1H product                       G23 ✅ pass_grant_id NULL
G7  ✅ exactly one successful transaction             G24 ✅ granted_seconds NULL
G8  ✅ .appAccountToken(purchaseOwnerRef)             G25 ✅ environment=Sandbox
G9  ✅ StoreKit .verified(transaction)                G26 ✅ product identity matches end-to-end
G10 ✅ appAccountToken == purchaseOwnerRef            G27 ✅ account-token identity matches end-to-end
G11 ✅ genuine JWS from VerificationResult            G28 ✅ paid grants remain 0
G12 ✅ exactly one initial POST                       G29 ✅ catalog active rows remain 0
G13 ✅ body contains only signedTransaction           G30 ✅ Transaction.finish() calls = 0
G14 ✅ HTTP 409 product_inactive                      G31 ✅ PASS_4H purchases = 0
G15 ✅ verified=true                                  G32 ✅ PASS_24H purchases = 0
G16 ✅ recorded=true                                  G33 ✅ production-money purchases = 0
G17 ✅ entitlementIssued=false
```

## 16. Deferred

- **paid transaction → paid Pass issuance**, and its atomic server fulfilment contract + migration
- `Transaction.finish()` fulfilment authority, and what to do with **this** unfinished Sandbox
  transaction (it is deliberately still pending)
- server catalog activation (`is_active = true`) — per BUILD 26L §5, only when a fulfilment path exists
- `Transaction.updates` listener, refunds, App Store Server Notifications V2, reconciliation
- first-IAP App Review submission bundled with a new app version (26Q-R1 §12)
- a purchase surface for real customers — this build shipped a forensic gate, not commerce UI
- BUILD 26O REVOKED audit actor provenance · BUILD 18C G4/G6/G7 · legacy RPC wrapper removal

## 17. What this build should be remembered for

- **The expected result was a 409, and that is why the payload had to be checked.** A build whose
  success criterion is an error status is one refactor away from treating any 409 as a pass. The
  verdict requires `error`, `verified`, `recorded` and `entitlementIssued` to agree, and the tests
  that matter are the four asserting that a 409 with `verified:false` is NOT a pass.
- **`userCancelled` was worth verifying, not just believing.** The cancel branch is the one repeat
  §8 allows, so the ledger was re-read to prove 0 rows before a second tap was permitted. A relaunch
  — not a re-arm — is what made the second attempt legitimate, because the one-shot guard lives in
  process state.
- **Recompute the digest; do not compare the stored one.** Checking the ledger's
  `signed_transaction_sha256` against the device's would only prove the server can copy a hash.
  Hashing the stored payload again is what proves the bytes Apple signed are the bytes we kept.
- **A payment binding is proven by fingerprints, not by printing UUIDs.** One value appears in five
  places — DB, `/host/me`, purchase option, transaction, ledger — and a 12-hex prefix with no
  collisions across 24 accounts identifies it exactly, without putting it in a document.
- **Recording is not granting, and the data says so.** 1 Apple purchase, 0 paid grants, 0 new audit
  rows, `is_active` still false. The most likely future mistake is reading "the purchase worked" as
  "we can sell"; §11 and §16 exist to stop that.
