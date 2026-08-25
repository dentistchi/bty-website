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
