# BUILD 26S-R2A — StoreKit Unfinished Recovery (recovery only, no finish)

**Status: PASS / CLOSED — 2026-08-14. Gates G1–G24 measured on a physical iPhone.**

BUILD 26R-R2 acquired one genuine Apple Sandbox transaction and deliberately left it unfinished.
BUILD 26S-R1 settled it into the first real paid grant. What had never been observed — because no
code existed that could look — is whether that same transaction was **still in the device's
StoreKit queue**.

It is.

```
cold launch (build 98)
  → Transaction.unfinished          discovered = 1
  → SAME transaction                9a4eafea51f2…   verified   Sandbox   PASS_1H   8107d5628079…
  → POST /verify                    replayed = true        → purchase 28ab7288-…  VERIFIED
  → POST /fulfil                    replayed = true        → grant    006bc34f-…  PAID / 3600
  → GET  /fulfilment                linkageVerified = true → authorizesFinish = true
  → STOP.                           finishCalls = 0        → RESULT=RECOVERED_NOT_FINISHED
```

The transaction is **still unfinished, on purpose.** Completing it is BUILD 26S-R2B and is not
started.

---

## 1. Verdict

```
BUILD 26S-R2A                    PASS / CLOSED       G1 … G24 measured
Transaction.unfinished recovery  PROVEN on device
Transaction.updates listener     INSTALLED (architecture gate)
Transaction.finish()             0 call sites, 0 calls          UNCHANGED
new Sandbox purchases            0                              UNCHANGED
production ledger                byte-identical PRE → POST      UNCHANGED
R2B                              NOT STARTED
```

BUILD 26S-R1 is **not** reopened, reinterpreted or weakened by this build. Its durable financial
state is the fixture this build replayed, and the replay changed nothing.

## 2. Baseline

```
native     bty-norebang-admin-ios   build 98   (was 97 / 59512ab)
monorepo   bty-karaoke              docs only
MIGRATION  NONE — parity stays 20260816120000
DEPLOY     NONE — no Worker version, no server change, no catalog change
```

Every server endpoint this build calls (`/verify`, `/fulfil`, `/fulfilment`, `/host/me`) already
existed and is untouched. **R2A is a native-only patch.**

## 3. Contract, as ratified before the build ran

```
1  Transaction.unfinished is the REQUIRED recovery authority; Transaction.updates is an
   architecture listener and is NOT required to redeliver the historical fixture
2  the only acceptable fixture is the existing BUILD 26R transaction — no replacement purchase
3  R2A ends with the transaction STILL UNFINISHED; zero new finish() call sites
4  a missing fixture is reported as STOP / UNPROVEN, never repaired
5  POST /fulfil is not finish authority; only the separate durable GET can be
```

All five held.

## 4. What was built

### 4.1 Files changed

```
NEW  BTYNorebangAdmin/PassRecovery.swift               fixture · admission · step verdicts · evidence
NEW  BTYNorebangAdmin/PassRecoveryRunner.swift         the 3-request replay chain + transport seam
NEW  BTYNorebangAdmin/PassTransactionCoordinator.swift the one dedupe authority (actor)
NEW  BTYNorebangAdmin/PassRecoveryService.swift        the ONLY StoreKit-queue reader
NEW  BTYNorebangAdmin/PassRecoveryGateView.swift       DEBUG recovery gate (separate from purchase)
MOD  BTYNorebangAdmin/APIClient.swift                  +fulfilApplePurchase, +applePurchaseFulfilment
MOD  BTYNorebangAdmin/BTYNorebangAdminApp.swift        gate arming + precedence + listener install
MOD  BTYNorebangAdmin.xcodeproj/project.pbxproj        5 sources, CURRENT_PROJECT_VERSION 97 → 98
MOD  Tests/run.sh                                      3 new pure sources in the bare-swiftc suite
MOD  Tests/QueueContractTests.swift                    +171 checks, build-number pins 97 → 98
```

No server file, no migration, no catalog row, no existing grant, no existing purchase.

### 4.2 Architecture of unfinished recovery

```
Transaction.unfinished  ──▶ PassStoreRecovery.plainValues   (the ONLY StoreKit boundary)
                                    │  RecoverableTransaction (plain values, no StoreKit type)
                                    ▼
                            PassRecoveryPolicy.admit        (pure; 11 named refusals, fail-closed)
                                    ▼
                       PassTransactionCoordinator.process   (actor; claim BEFORE first await)
                                    ▼
                            PassRecoveryRunner.run          (verify → fulfil → SEPARATE durable GET)
                                    ▼
                            PassRecoveryOutcome + evidence lines
```

Nothing downstream of the boundary knows StoreKit exists, which is why every refusal and every
reading of the server's answer is asserted in-process by the bare-`swiftc` suite.

**Admission order is deliberate.** StoreKit's own verification is checked before any claim the
transaction makes is read — an unverified transaction's product, environment and account binding
are exactly the fields that would be forged. Identity comes next, so a transaction that simply is
not the fixture reports as itself rather than as a product or binding problem.

**Both account bindings are required and they are different questions.** `purchaseOwnerRef` is who
is signed in *now*; the fixture fingerprint is who *paid*. Either alone admits a case the other
refuses.

### 4.3 Where the `Transaction.updates` listener starts

`BTYNorebangAdminApp.init()`, inside the existing `#if DEBUG` block, **before any scene exists** —
a listener installed after a scene has already missed what it was created to catch. A structural
test pins that it appears between `init() {` and `var body: some Scene`.

In R2A the listener is architecture readiness only: it consumes `VerificationResult<Transaction>`,
**fails closed on `.unverified`** (refused before it is given any identity in the shared authority),
registers what it saw with the same coordinator, and **sends nothing**. Observing an update cannot
by itself cause a server write.

It is DEBUG-only, deliberately. Release links no StoreKit at all (§6.3) and has no purchase path,
so a Release listener would observe a queue nothing in that binary can produce. Shipping an
unexercised StoreKit path into a build with no commerce surface is scope this build does not have.

### 4.4 Concurrency / dedupe mechanism

`actor PassTransactionCoordinator`, keyed by canonical StoreKit transaction identity.

```
process(transactionID:source:work:)   the single EXECUTION authority (both sources may call it)
observe(transactionID:source:)        non-suspending; records a delivery, never claims one
```

The two mutations that make `process` safe both happen **before `work` is awaited**, so actor
reentrancy during the await is harmless: a concurrent caller for the same id observes the claim
already recorded and returns without running anything.

Only `provedServerConvergence` — the separate durable read agreeing — permanently suppresses an id.
A refusal, a transport failure or a step mismatch releases the claim and stays retryable, because
otherwise one transient failure would permanently strand a transaction the customer paid for. **That
property was exercised for real during the gate** (§7.1).

`observe` is deliberately non-suspending so an observation can never hold a claim across an await
and therefore can never delay the mandatory `Transaction.unfinished` recovery. An observer that
could block the recovery would be a harness that breaks its own gate.

## 5. Proof there is no finish authority, and no purchase dependency

Asserted structurally against the shipped sources, because the guarantee is that **no call site
exists** — not that a flag happens to be false.

```
new Transaction.finish() call sites                 0
R2A recovery finish() calls                         0
Product.purchase() in the recovery path             0
files containing .finish( / Transaction.finish      0   (all 44 shipped sources)
files reading Transaction.unfinished / .updates     1   (PassRecoveryService.swift, one reader each)
```

Every one of the five recovery files is scanned for `.finish(`, `Transaction.finish`,
`finishTransaction`, `currentEntitlements`, `restorePurchases`, `AppStore.sync` **and** for
`.purchase(`, `Product.purchase`, `PassPurchase`, `appAccountToken(`, `Product.products(`,
`PassStoreDiscovery`, `promotionalOffer` — with a code anchor pinned in each file so comment
stripping cannot hollow the scan out.

**The DEBUG recovery path is structurally separate from the purchase path**, not guarded by a
runtime boolean inside one screen:

```
-BTYPassRecoveryGate  →  PassRecoveryGateView   (own file; no reference to the purchase surface)
-BTYPassPurchaseGate  →  PassPurchaseGateView   (unchanged)
```

The entry point selects **recovery first**, so a launch carrying both flags renders recovery only.
A test pins that ordering by source position.

## 6. Automated verification

### 6.1 Suite

```
native contract suite   2473 passed / 0 failed      (+171 new 26S-R2A checks)
Debug build             BUILD SUCCEEDED
Release build           BUILD SUCCEEDED
```

### 6.2 The 15 required behaviours

```
 1  unfinished + verified + matching fixture    → pipeline allowed, 1 verify + 1 fulfil + 1 GET
 2  unverified                                  → refused(storeKitUnverified), 0 requests
 3  wrong product                               → refused(productMismatch), 0 requests
 4  wrong appAccountToken                       → refused(accountTokenMismatch), 0 requests
                                                  + refused(fixtureAccountTokenMismatch)
 5  wrong environment                           → refused(environmentMismatch), 0 requests
 6  /verify does not converge                   → verifyNotReplayed / verifyUnexpected, no /fulfil
 7  /fulfil returns another grant               → fulfilGrantMismatch, durable read never reached
 8  GET linkageVerified = false                 → readbackLinkageUnverified
 9  GET authorizesFinish = false                → readbackLinkageUnverified
10  unfinished(A) + unfinished(A)               → exactly ONE execution
11  unfinished(A) + updates(A)                  → exactly ONE execution
12  A and B                                     → independent, both execute
13  a failed attempt                            → released, retryable, then converges
14  recovery path has no Product.purchase()     → structural, 5 files
15  R2A has no finish authority                 → structural, all shipped sources
```

Response bodies in these tests are **decoded from JSON in the exact shape the live routes emit**, so
the decoders are proven against the server contract rather than against a Swift initializer.

The harness uses a **synthetic** transaction identity. Reproducing Apple's real transaction id in
the test suite to make a fingerprint match would put a live financial identifier in the repository
to prove something only the device can prove anyway. The production fixture's fingerprints are
pinned separately as literal constants.

Existing 26R-R0/R1, 26R-R2, 26S and all earlier regression coverage is unchanged and green.

### 6.3 Release cannot activate any of it

```
otool -L  Release executable      →  NO StoreKit linkage
nm        PassRecoveryGateView    →  0 symbols
nm        PassStoreRecovery       →  0 symbols
nm        PassStoreUpdatesListener→  0 symbols
```

The pure types (`PassTransactionCoordinator`, `PassRecoveryRunner`) are compiled into Release but
have no call site there — the gate view, the StoreKit readers and the listener are all
dead-stripped, exactly as BUILD 26R-R2 measured for the acquisition surface.

## 7. Physical gate — iPhone 17 Pro Max `80C931D3`, DEV-signed Debug build 98

Driven end to end by `devicectl`; no human interaction with the app.

### 7.1 Run 1 — the fail-closed path, unplanned and unfaked

```
[26S-R2A] GET /api/host/me FAILED
[26S-R2A] unfinished discovered=1
[26S-R2A] queued transactionFp=9a4eafea51f2… product=com.btydaily.norebang.pass.1hour env=Sandbox verified=true
[26S-R2A] fixture-found=true
[26S-R2A] REFUSED reason=missingPurchaseOwnerRef — no request sent
[26S-R2A] finishCalls=0
[26S-R2A] RESULT=UNPROVEN reason=refused:missingPurchaseOwnerRef
```

The first cold launch happened seconds after the device was unlocked and `/api/host/me` did not
answer. Without an owner reference the gate could not prove the transaction was bound to the
account signed in, so it **refused before sending a single request** and reported UNPROVEN.

This is required-behaviour 13 happening for real: the attempt was released rather than remembered
as done, which is the only reason run 2 was permitted to execute at all. Nothing was repaired,
retried inside the chain, or worked around.

### 7.2 Run 2 — the decisive evidence

```
[GATE-B23] api-base=production
[26S-R2A] recovery-gate=armed
[26S-R2A] updates-listener=STARTED
[26S-R2A] observed source=updates transactionFp=9a4eafea51f2…
[26S-R2A] source=unfinished
[26S-R2A] updates-listener=STARTED
[26S-R2A] ownerRefFp=8107d5628079…
[26S-R2A] unfinished discovered=1
[26S-R2A] queued transactionFp=9a4eafea51f2… product=com.btydaily.norebang.pass.1hour env=Sandbox verified=true
[26S-R2A] fixture-found=true
[26S-R2A] transactionFp=9a4eafea51f2…
[26S-R2A] verified=true
[26S-R2A] product=com.btydaily.norebang.pass.1hour
[26S-R2A] tokenFp=8107d5628079…
[26S-R2A] environment=Sandbox
[26S-R2A] verify replay status=recordedNotGranted replayed=true
[26S-R2A] purchase=28ab7288-ed3b-43b6-acef-484d1f635032
[26S-R2A] verificationStatus=VERIFIED
[26S-R2A] fulfil replayed=true
[26S-R2A] grant=006bc34f-13a6-4b2b-8eee-aee4df20ba0a
[26S-R2A] fulfilment linkageVerified=true
[26S-R2A] sourceType=PAID
[26S-R2A] isPaid=true
[26S-R2A] grantedSeconds=3600
[26S-R2A] authorizesFinish=true
[26S-R2A] finishCalls=0
[26S-R2A] RESULT=RECOVERED_NOT_FINISHED
```

### 7.3 Gate table

```
G1   cold launch, api-base = production                                   PASS
G2   recovery gate armed by its own flag; purchase gate off               PASS
G3   Transaction.unfinished enumerated                                    PASS   discovered=1
G4   the SAME BUILD 26R transaction is present                            PASS   9a4eafea51f2…
G5   StoreKit verification == .verified                                   PASS
G6   productID == com.btydaily.norebang.pass.1hour                        PASS
G7   appAccountToken fingerprint == 8107d5628079…                         PASS
G8   environment == Sandbox                                               PASS
G9   the existing signed JWS is reused (3-segment compact)                PASS
G10  POST /verify converges — replayed = true                             PASS
G11  no second purchase ledger row                                        PASS   count 1 → 1
G12  purchase id == 28ab7288-…                                            PASS
G13  verificationStatus == VERIFIED                                       PASS
G14  POST /fulfil converges — replayed = true                             PASS
G15  pass grant id == 006bc34f-…                                          PASS
G16  no second paid grant                                                 PASS   count 1 → 1
G17  SEPARATE durable GET performed                                       PASS
G18  linkageVerified / sourceType PAID / isPaid / 3600 / authorizesFinish PASS
G19  Transaction.finish() calls                                           PASS   0
G20  RESULT = RECOVERED_NOT_FINISHED, transaction still unfinished        PASS
G21  Transaction.updates listener installed and alive                     PASS
G22  a refusal fails closed with ZERO requests (run 1)                    PASS
G23  a failed attempt remains retryable (run 1 → run 2)                   PASS
G24  production ledger unchanged PRE → POST                               PASS
```

`Transaction.updates` also delivered the historical fixture in this process (`observed
source=updates`). That is a **bonus observation, not a gate**: the ratified contract does not
require the old fixture to appear there, and no PASS above depends on it.

## 8. Production census — PRE and POST

```
apple purchases            1                        1
purchase                   28ab7288-…               28ab7288-…
  verification_status      VERIFIED                 VERIFIED
  grant_status             GRANTED                  GRANTED
  granted_seconds          3600                     3600
  verification_attempts    1                        1
  verified_at              2026-08-14T05:31:32.941Z 2026-08-14T05:31:32.941Z
  processed_at             2026-08-14T14:56:43.125566Z   ← unchanged
  updated_at               2026-08-14T14:56:43.125566Z   ← unchanged
paid grants (is_paid)      1                        1
paid grants (source PAID)  1                        1
apple-linked grants        1                        1
grants total               56                       56
grant                      006bc34f-…  PAID / AVAILABLE / ONE_HOUR / 3600 / carryover 0
  updated_at               2026-08-14T14:56:43.125566Z   ← unchanged
paid ISSUED audit          1                        1
audit total                156                      156
catalog                    3 rows, is_active 0      3 rows, is_active 0
new Sandbox purchases      0                        0
Transaction.finish()       0                        0
```

`diff PRE POST` differs in **one line: the label.** The replay did not move `updated_at`,
`processed_at`, `verification_attempts`, or any count — exactly as the R1 idempotency design
requires, and confirmed by reading the columns previously used as replay invariants.

## 9. Deviations, stated

**1. `/verify` does not disclose a purchase id, so identity convergence is proven differently.**
BUILD 26P's response carries `verified / recorded / entitlementIssued / replayed / productCode` and
no row id — by design, and R2A did not widen it. Convergence onto the existing purchase is
therefore proven by two facts instead of one returned id: `replayed = true` (the unique
`(environment, transactionId)` index found the row that already exists and nothing was inserted),
and the durable GET echoing back **the device's own transaction fingerprint** for the purchase row
it read. The device never learns Apple's identifier from the server and the server never learns it
from the device; the fingerprints match because the underlying values do.

**2. The `Transaction.updates` listener is DEBUG-only.** Rationale in §4.3. It starts during
application initialization as required; what it does not do is exist in a Release binary that links
no StoreKit and has no purchase path.

**3. The fixture's purchase id and grant id are pinned as raw UUIDs in a shipped source file.**
They are our own durable row identifiers and are request parameters the recovery must send. Apple's
transaction id and the account's owner reference are pinned as fingerprints only.

## 10. What R2A did NOT do

```
finish a transaction                    NO   (0 call sites)
make a new StoreKit purchase            NO   (0 new Sandbox purchases)
press or automate PassPurchaseGate      NO   (structurally unreachable from the recovery gate)
manufacture a replacement fixture       NO
activate a catalog product              NO   (is_active still 0 of 3)
modify or re-issue the paid grant       NO
add a fallback entitlement              NO
weaken owner-token or environment binding NO (both strengthened: live owner AND fixture payer)
trust POST /fulfil as finish authority  NO   (finish predicate reads only the GET)
deploy, migrate, or touch the server    NO
start R2B                               NO
```

## 11. Hard-won notes

**A fail-closed refusal is only useful if the attempt stays retryable.** Run 1 refused correctly and
run 2 succeeded *because* the coordinator had not recorded the failure as done. Had dedupe been
"remember every id we processed", the gate would have permanently locked itself out of its own
fixture on a transient network blip — and the failure would have looked like the fixture being gone.

**An observation must never be able to claim.** `observe` is non-suspending precisely so a
`Transaction.updates` delivery arriving microseconds before the recovery cannot hold the claim
across an await and starve the mandatory proof. The listener delivering the same fixture in run 2
would have done exactly that under a naive shared-claim design.

**The convergence proof lives in `replayed`, not in an id.** It is tempting to widen `/verify` to
return a purchase id "so the client can fulfil". That would have been a production API change,
deployed, to obtain information the durable read already proves — and it would have made the client
the authority on which row its payment belongs to.

**Comment stripping erases `// MARK:` anchors.** A structural scan that slices a file between two
anchors must use *code* anchors; the first version of the APIClient seam scan used
`// MARK: My Songs` and silently matched nothing.

**Scope a forbidden-symbol scan to the seam it governs.** A whole-file scan of `APIClient.swift`
for `"passGrantId": ` fired on BUILD 17's pass-selection endpoints, which legitimately send it.

**A test helper that substitutes a default for `nil` makes a fail-closed case untestable.** The
first version of the runner helper defaulted `owner` with `?? OWNER_UUID.uuidString`, so the
"absent purchaseOwnerRef" case silently tested the happy path.

---

**BUILD 26S-R2A — PASS / CLOSED.** The transaction is recovered, proven, and deliberately still
unfinished. R2B is not started.
