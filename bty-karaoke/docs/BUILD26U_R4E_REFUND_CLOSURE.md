# BUILD 26U-R4E-R2 — Apple Sandbox server-notification E2E

**BLOCKED / REFUND INITIATION PATH REQUIRED** — two prerequisites are absent, both Founder-side.

## What is now live

Migration `20260827120000` applied to production (sha256 `426b671b…`, commit `b6d343d2`,
HEAD == origin/main, exactly one pending file in the dry run). Worker deployed, version
`995d7aa8-e5a1-4648-ac7a-a898aadaa849`.

Readback: notification inbox present · refund/reversal/ingestion RPCs present and fail-closed
(`purchase_not_found`, `notification_uuid_required`) · purchase refund columns present · grant
compensation provenance present · inbox rows after probes **0**. Both entitlement readers and
`premium_room_mode = dual_allowlist` unchanged.

## §F negative probes — live endpoint, zero mutation

| probe | result |
|---|---|
| empty body | 400 `invalid_request` |
| missing signedPayload | 400 `invalid_request` |
| malformed JWS | 400 `unverifiable` |
| fabricated payload (valid shape, fake x5c) | 400 `unverifiable` |
| unsigned but well-formed | 400 `unverifiable` |

Counts before and after are identical — inbox 0, purchases 2, grants 57, audit 160 — and zero
forged notificationUUIDs were recorded. **Decoded JSON never reaches mutation logic.**

## The two blockers

**1. No App Store Server API credentials.** Requesting a test notification and calling
*Get Test Notification Status* need an App Store Connect in-app-purchase key (issuer ID + key ID
+ .p8). None is configured. The only Apple secrets present are
`KARAOKE_APPLE_REVOCATION_*` — Sign in with Apple *account* revocation from BUILD 26E, a
different API with a different key type. So §H was **never attempted**, which is not the same as
having failed.

**2. No refund-request entry point.** `beginRefundRequest` / `requestRefund` / `refundRequest`
appear **zero times** in the entire native app. Apple's Sandbox refund flow is initiated from the
device by `Transaction.beginRefundRequest`; there is no server API that starts one. Per §K this is
reported rather than papered over with a Founder-only refund button.

§G (ASC Sandbox URL) is a Founder GUI action and was not performed, so §D/§U readbacks cannot be
made either.

## Regression

Web 275 files / 3458 tests, lint clean. R4E, R4C and R4D harnesses re-run: **0 failures each**.
Production DEPLOY gate 7/7.

## Production containment

Production Server URL **UNSET** — nothing was configured in App Store Connect at all. Per §Z it
stays unset regardless of R2's outcome.

---

# BUILD 26U-R4E-R2B — BLOCKED / APPLE SANDBOX REFUND SHEET CONNECTIVITY

External blocker. Not a BTY refund-lifecycle failure.

Everything up to Apple's own sheet worked: the exact ledger transaction `2000001226703140` was
supplied by launch argument, parsed as a UInt64, and the DEBUG gate reached
`Transaction.beginRefundRequest(for:in:)`. Apple's refund sheet presented and returned
**Cannot Connect** — reproducibly, and again under a different Sandbox Apple Account.

No refund request was submitted. No Apple REFUND notification was received. The fixture was left
exactly as it was: grant `d12ed9e8` ACTIVE, purchase `e38cbb38` VERIFIED, nothing mutated to
manufacture a pass.

R4E-R1's deterministic proof and R2A's live TEST-transport proof are untouched and still stand.
R2B resumes when Apple's Sandbox refund sheet is operational.

---

# BUILD 26U-R4E-R3-R0 — recovery archaeology (read-only)

Measured against the live Sandbox App Store Server API with the R2A credentials. Nothing was
implemented and no production behaviour changed.

## A. What the three candidate endpoints actually return

| endpoint | HTTP | shape |
|---|---|---|
| `GET /inApps/v1/transactions/{id}` | 200 | one `signedTransactionInfo` |
| `GET /inApps/v2/refund/lookup/{id}` | 200 | `signedTransactions[]`, `revision`, `hasMore` |
| `GET /inApps/v2/history/{id}` | 200 | `signedTransactions[]`, `revision`, `hasMore`, `bundleId`, `environment` |

Refund lookup returned **0** transactions with `revision: 0, hasMore: false` — correct, nothing
has been refunded. History returned **all 3** of our Sandbox purchases.

## B. Applicability to a consumable

`type: Consumable` is returned by all three; none of them refuses a consumable. This is the
opposite of the client-side `Transaction.all` problem that blocked R2B-R1 — the SERVER API has no
finished-consumable exclusion and needs no history flag.

## C. Revocation fields

`revocationDate` / `revocationReason` are simply **absent** on an unrefunded transaction rather
than null. Their presence is the refund signal.

## D. JWS verification — no new verifier

The API's `signedTransactionInfo` is a transaction JWS: `alg ES256`, `x5c` chain of 3, 3 segments.
`verifyAppleSignedTransaction` (BUILD 26P) accepts it **unchanged** and returns
`environment: Sandbox`, `transactionId: 2000001226703140`. That is the same claim shape it was
written for, unlike the notification envelope that needed `verifyAppleSignedPayload` in R2A.

## E. Recommended source: Get Transaction Info

We already hold the exact transaction ids in `karaoke_apple_purchases`, so the per-transaction
endpoint is the smallest correct call: one request per known purchase, no pagination, and exact
provenance by construction. Refund lookup is customer-scoped and paginated, and would have to be
mapped back to our rows anyway.

## F. Missed vs already-applied

`karaoke_apple_purchases.revoked_at` already answers it: null means a refund was missed, non-null
means it was applied. `apply_apple_purchase_refund` returns `replayed: true` and writes nothing
when `revoked_at` is set, so recovery re-uses the R4E-R1 RPC with no second code path and no new
revocation semantics.

## G. Production behaviour change required: NONE

The recovery operation is additive and runs on demand. No scheduler, no client polling, no
launch-time or room-start Apple checks, no Production Server URL.
