# BUILD 26S-R2B — Single StoreKit Lifecycle Completion

**Status: PASS / CLOSED — 2026-08-14. Gates G1–G19 measured on a physical iPhone.**

The BUILD 26R Sandbox transaction has been completed. Once.

```
cold launch (build 99)
  → Transaction.unfinished          discovered = 1   → SAME transaction 9a4eafea51f2…
  → /verify replayed=true           → purchase 28ab7288-…  VERIFIED
  → /fulfil replayed=true           → grant    006bc34f-…  PAID / GRANTED / 3600
  → GET /fulfilment                 → linkageVerified=true  authorizesFinish=true
  → finishCalls-before=0
  → FRESH Transaction.unfinished    → same transaction, verified, identityMatch=true
  → await transaction.finish()      → finishCalls-after=1
  → FRESH Transaction.unfinished    → discovered=0, fixture-after=false
  → RESULT=FINISHED
```

The financial ledger is **byte-identical** before and after.

---

## 1. Verdict

```
BUILD 26S-R2B                    PASS / CLOSED       G1 … G19 measured
Transaction.finish() call sites  1                   (was 0)
runtime finish invocations       1                   (measured, not inferred)
fixture in unfinished queue      present → ABSENT
new Sandbox purchases            0
production ledger                byte-identical PRE → POST
Track B commerce lifecycle       COMPLETE
```

BUILD 26S-R1 and 26S-R2A are **not** reopened, reinterpreted or weakened. R2A's recovery gate
still exists and still provably cannot complete anything.

## 2. Baseline

```
native     bty-norebang-admin-ios   build 99   (was 98 / 266d2be)
monorepo   bty-karaoke              docs only
MIGRATION  NONE — parity stays 20260816120000
DEPLOY     NONE — no Worker version, no server change, no endpoint, no catalog write
```

**R2B required no server code change of any kind.** Completing an Apple transaction lifecycle is a
device-side act; there is no `finished_at`, no StoreKit-finished flag, no extra audit row and no new
verification attempt, because none of those describe a fact the server owns.

## 3. Files changed

```
MOD  BTYNorebangAdmin/PassRecovery.swift               +FinishAuthorization, +PassFinishAuthority,
                                                        +PassFinishRefusal, +PassFinishOutcome,
                                                        +PassFinishLog, +PassFinishGateLaunch
MOD  BTYNorebangAdmin/PassRecoveryRunner.swift         issues the authorization from the durable read
MOD  BTYNorebangAdmin/PassTransactionCoordinator.swift +claimLifecycleCompletion (the runtime claim)
MOD  BTYNorebangAdmin/PassRecoveryService.swift        +PassLifecycleCompletion — THE call site
NEW  BTYNorebangAdmin/PassFinishGateView.swift         DEBUG completion gate
MOD  BTYNorebangAdmin/BTYNorebangAdminApp.swift        third flag + precedence
MOD  BTYNorebangAdmin.xcodeproj/project.pbxproj        1 source, CURRENT_PROJECT_VERSION 98 → 99
MOD  Tests/QueueContractTests.swift                    +81 checks; 3 prior scans NARROWED (§5)
```

No new parallel recovery system: R2B reuses R2A's boundary, policy, coordinator and runner intact.

## 4. The single completion call site

`BTYNorebangAdmin/PassRecoveryService.swift`, inside `PassLifecycleCompletion.complete`:

```swift
// ================= THE ONE LIFECYCLE COMPLETION IN THIS APPLICATION =================
await transaction.finish()
// ===================================================================================
```

Its control flow is pinned by source order in the test suite:

```
freshlyQueued(            →  fresh enumeration of Transaction.unfinished
PassFinishAuthority.matches(  →  identity match against the authorization
claimLifecycleCompletion(     →  the runtime claim (also the counter)
transaction.finish()          →  the one completion
PassStoreRecovery.unfinished()→  the fresh re-read that proves it
```

Each step is a prerequisite the next cannot be reached without, and no loop encloses any of it.

### Proof there is exactly one

```
files containing Transaction.finish / .finish()   1   → ["PassRecoveryService.swift"]
occurrences of `transaction.finish()` app-wide     1
occurrences of claimLifecycleCompletion(           1
files referencing PassLifecycleCompletion          2   → the definition + the one gate that drives it
```

The three pre-existing scans that asserted "no shipped source finishes a transaction" were
**narrowed, not dropped** — from "nowhere" to "exactly one file, exactly one site". That says more
about where completion may live than the old assertion ever did.

### Proof `Transaction.updates` cannot finish

The listener body is sliced from `enum PassStoreUpdatesListener` to end of file and asserted to
contain none of `finish(`, `PassLifecycleCompletion`, `claimLifecycleCompletion`,
`FinishAuthorization`. It still only calls `coordinator.observe(transactionID:)`.

**This was exercised for real**: `Transaction.updates` delivered the same fixture during the gate run
(`observed source=updates transactionFp=9a4eafea51f2…`) and completed nothing.

### Proof `Product.purchase()` is unreachable

The completion boundary and all six recovery/gate files are scanned for `.purchase(`,
`Product.purchase`, `Product.products(`, `PassPurchase`, `appAccountToken(`, `PassStoreDiscovery`,
`promotionalOffer`. Zero hits. The R2B gate is a third launch flag with **completion → recovery →
acquisition** precedence, so a completion run cannot render the purchase gate.

## 5. `FinishAuthorization` — the design

A plain-value permission produced by the server-facing chain and handed OUT to the StoreKit
boundary. No `StoreKit.Transaction` ever travels through the policy, the coordinator or the runner.

```
FinishAuthorization
  transactionFingerprint  productID  accountTokenFingerprint  environment
  purchaseID  passGrantID  grantedSeconds
  verificationStatus  grantStatus  sourceType  isPaid  linkageVerified
  serverAuthorizesFinish
```

Every field is **measured from the durable read**, never copied from the constants it is checked
against — an authorization assembled out of its own expectations would prove only that the
expectations exist.

`PassFinishAuthority.authorize` re-checks the transaction's own identity even though admission
already did. That is not redundancy: an authorization is a value that crosses a boundary and is
matched against a *different object* later, so every invariant it asserts is pinned at the layer
that asserts it. A check performed only upstream is one a future caller bypasses by constructing
the type another way.

`PassFinishAuthority.matches` then requires the FRESHLY queued transaction to equal the
authorization field by field. A retained `Transaction` proves only what was true when it was
fetched; the queue is the authority on what is still outstanding **now**.

### Exactly-once is a runtime claim, not a source count

`PassTransactionCoordinator.claimLifecycleCompletion(transactionID:)` is non-suspending, so the
check and the increment are indivisible. The counter increments **immediately before** the
completion, so it can only ever over-report — the safe direction, because a completion that hung
mid-call would still be counted rather than silently forgotten.

A source count proves how many places *could* complete a lifecycle. Only this proves how many times
one *did*.

### Not a throwing API

`Transaction.finish()` does not throw, and the suite asserts the boundary contains no
`try await transaction.finish` and no `catch`. Success is not "no exception" — success is that a
fresh read of the queue afterwards no longer contains the transaction.

## 6. Automated verification

```
native contract suite   2554 passed / 0 failed      (+81 new 26S-R2B checks)
Debug build             BUILD SUCCEEDED
Release build           BUILD SUCCEEDED
```

All 24 required behaviours covered. Highlights:

```
 1  exact durable read                        → authorization issued with the MEASURED facts
 2-9 authorizesFinish / linkageVerified / verificationStatus / grantStatus / passGrantId /
     sourceType / isPaid / grantedSeconds each falsified individually → NO authorization
10-13 wrong transaction fp / product / appAccountToken / environment → NO authorization
14-16 fresh lookup absent / unverified / mismatched                  → zero completion
17  first claim succeeds and counts 1;  two CONCURRENT claims → exactly one
18  fixture absent from the fresh post-read  → RESULT=FINISHED
19  fixture still present afterwards         → RESULT=UNPROVEN, never FINISHED, never a second call
20  Transaction.updates cannot reach the completion authority
21  duplicate delivery cannot complete twice; a DIFFERENT transaction stays independent
22  Product.purchase unreachable from the lifecycle path
23  exactly one source call site
24  R2A's recovery gate still has zero completion capability, and its evidence stream is unchanged
```

### Release is unaffected

```
otool -L  Release executable   →  NO StoreKit linkage
nm        PassLifecycleCompletion / PassFinishGateView / PassStoreRecovery
          / PassStoreUpdatesListener                     →  0 symbols each
```

Everything StoreKit sits behind `#if DEBUG` call sites and is dead-stripped, exactly as in R2A.

## 7. Physical gate — iPhone 17 Pro Max `80C931D3`, DEV-signed Debug build 99

```
[GATE-B23] api-base=production
[26S-R2A] recovery-gate=off
[26S-R2B] finish-gate=armed
[26S-R2A] updates-listener=STARTED
[26S-R2A] observed source=updates transactionFp=9a4eafea51f2…
[26S-R2B] ownerRefFp=8107d5628079…
[26S-R2B] unfinished-before discovered=1
[26S-R2B] fixture-before=true
[26S-R2B] transactionFp=9a4eafea51f2…
[26S-R2B] verified=true
[26S-R2B] product=com.btydaily.norebang.pass.1hour
[26S-R2B] tokenFp=8107d5628079…
[26S-R2B] environment=Sandbox
[26S-R2B] verify replay status=recordedNotGranted replayed=true
[26S-R2B] purchase=28ab7288-ed3b-43b6-acef-484d1f635032
[26S-R2B] fulfil replayed=true
[26S-R2B] grant=006bc34f-13a6-4b2b-8eee-aee4df20ba0a
[26S-R2B] fulfilment verificationStatus=VERIFIED
[26S-R2B] fulfilment grantStatus=GRANTED
[26S-R2B] fulfilment linkageVerified=true
[26S-R2B] fulfilment sourceType=PAID
[26S-R2B] fulfilment isPaid=true
[26S-R2B] fulfilment grantedSeconds=3600
[26S-R2B] fulfilment authorizesFinish=true
[26S-R2B] finishCalls-before=0
[26S-R2B] final-lookup fixture=true
[26S-R2B] final-lookup verified=true
[26S-R2B] final-lookup identityMatch=true
[26S-R2B] finish-invoked transactionFp=9a4eafea51f2…
[26S-R2B] finishCalls-after=1
[26S-R2B] unfinished-after discovered=0
[26S-R2B] fixture-after=false
[26S-R2B] finishCalls=1
[26S-R2B] RESULT=FINISHED
```

### Gate table

```
G1   fresh device execution sees the SAME historical fixture unfinished   PASS   discovered=1
G2   StoreKit verified                                                    PASS
G3   transaction fingerprint 9a4eafea51f2…                                PASS
G4   product com.btydaily.norebang.pass.1hour                              PASS
G5   appAccountToken fingerprint 8107d5628079…                            PASS
G6   environment Sandbox                                                  PASS
G7   /verify converges onto the existing purchase                         PASS   replayed=true
G8   /fulfil converges onto the same existing paid grant                  PASS   replayed=true
G9   separate GET /fulfilment proves the full predicate                   PASS
G10  fresh pre-completion lookup sees the SAME fixture                    PASS   identityMatch=true
G11  fresh transaction matches the FinishAuthorization exactly            PASS
G12  runtime finish invocations                                           PASS   0 → 1
G13  fresh post-completion lookup: fixture ABSENT                         PASS   discovered=0
G14  Apple purchases remain exactly 1                                     PASS
G15  paid grants remain exactly 1                                         PASS
G16  paid ISSUED audits remain exactly 1                                  PASS
G17  catalog remains 3 rows / 0 active                                    PASS
G18  new Sandbox purchases remain 0                                       PASS
G19  financial ledger otherwise unchanged                                 PASS   diff = ∅
```

### A stalled run, reported

An earlier launch reached the gate, printed its startup lines and then went silent: the device
re-locked and iOS suspended the process mid-flight. It never reached `finishCalls-before`, never
took the claim and never completed anything, which the evidence file shows directly. It was
relaunched rather than reasoned around. **Two launches, one completion.**

## 8. Production census — PRE and POST

`diff` of the full census before and after the completion is **empty**.

```
apple purchases            1                        1
purchase                   28ab7288-…  VERIFIED / GRANTED / 3600
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
```

The R2B pre-census was also diffed against the R2A post-census: identical, so nothing touched the
ledger between the two builds either.

## 9. The complete Track B lifecycle

```
26L   schema that could represent a paid grant                     (no grant existed)
26P   verify + record a genuine Apple JWS                          VERIFIED / NOT_GRANTED
26R-R2 one genuine Sandbox purchase, left unfinished               409 product_inactive
26S-R1 atomic settlement — the FIRST real paid entitlement         VERIFIED / GRANTED, grant 006bc34f-…
26S-R2A same transaction physically recovered from the queue,      authorizesFinish=true,
        replay converged, deliberately NOT finished                finishCalls=0
26S-R2B same transaction freshly recovered, exact durable          finishCalls=1,
        authorization proven, ONE completion                       absent from the queue afterwards
```

Earlier blocker and failure history is preserved as written, including the BUILD 26S-R1 SIGPIPE
note — an **observability** ambiguity about invocation counts, never a financial-state ambiguity.

## 10. What R2B did NOT do

```
make a new Sandbox purchase             NO   (0 new purchases)
press PassPurchaseGate                  NO   (structurally unreachable)
activate or modify the catalogue        NO   (still 3 / 0 active)
issue a second paid grant               NO   (still exactly 1)
write anything to the server post-finish NO  (read-only census only)
add a finished_at column / audit / endpoint / migration  NO
finish from Transaction.updates or UI state              NO
finish a cached Transaction object                       NO   (fresh queue lookup required)
call finish twice                                        NO   (runtime claim; 1 invocation)
weaken owner-token / environment / identity binding      NO   (all re-checked at the finish layer)
```

## 11. Hard-won notes

**An authorization must be a value, not a captured object.** The whole reason the fresh pre-finish
lookup exists is that a `Transaction` held from an earlier stage proves what was true when it was
fetched, not what is outstanding now. Keeping the permission as plain data made "look it up again
and match field by field" the natural implementation instead of an extra chore.

**Narrow an obsolete assertion; do not delete it.** Three suites said "no shipped source finishes a
transaction". R2B is the build that makes that false. Rewriting them as "exactly one file, exactly
one site" kept a stronger guarantee than deleting them would have left.

**Count the invocation, not the button press.** A source-code count of call sites and a runtime
count answer different questions, and the PASS condition needs both. The claim that gates the
second completion out of existence is the same object that produces the count, so they cannot
disagree.

**A suspended app looks exactly like a hung one.** The stalled run printed its startup lines and
stopped; the cause was the screen locking, not the gate. Relaunching was correct — but only because
nothing in the stalled run had taken the claim, which is a property worth designing for rather than
hoping for.

---

**BUILD 26S-R2B — PASS / CLOSED.** The transaction is completed, exactly once, and the money it
represents is exactly where it was.
