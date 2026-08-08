# BUILD 26E — Canonical Account Ownership and Account Deletion Authority V1

**Status:** `PASS / CLOSED`
**Closed:** 2026-08-08, when the privacy disclosure was deployed to production and all
eleven required disclosures were verified live in both languages (§16).

---

## 1. Final verdict

`PASS / CLOSED`

All nine device gates pass, the Apple revocation lifecycle is production-proven, two real
client defects found during gating were repaired and mutation-verified, and the deployed
privacy policy now describes what the product actually does.

The last blocker was a disclosure gap, not a technical one: the live policy described only
Guest data handling and never mentioned in-app account deletion, the tombstone, retained
history, provider revocation, fingerprints, or storage cleanup. That gap is now closed —
bilingual `12a. Host account deletion` / `12a. 호스트 계정 삭제` is live, and all eleven
disclosures were verified against production **after** deployment, not against the source
(§16). Shipping an accurate implementation behind an inaccurate promise was the failure
mode this gate existed to prevent, and it did not happen.

## 2. Scope / explicit non-scope

**In scope.** Safe in-app account deletion; canonical account and purchase-owner authority;
retention-safe treatment of pass, audit, metering and room history; programmatic Sign in
with Apple revocation; Google grant revocation.

**Explicitly NOT in scope.** StoreKit or any purchase runtime; App Store Connect IAP
products; App Store Server API or Notifications; refund processing; TestFlight upload; App
Review submission; duplicate-account consolidation; orphan-account cleanup; stale-session
cleanup outside the deleting account.

## 3. Source / runtime baselines

```
Native  HEAD = origin/main = 0d8e593c1013b65aea7f6027f312d49d1390f129   (BUILD 26E-R2)
        R1   = b721744d923593f1d3b5e39cba26925d16942d9c                (BUILD 26E-R1)
        base = cdc221a19a8cf09df4725efdf42fc5d01ed65c32                (BUILD 26E)
        CFBundleVersion 85 · MARKETING_VERSION 1.0
        Host 1933 / 0 · Guest 779 / 0 · Debug + Release BUILD SUCCEEDED
        mutation 30 / 30 killed, every file restored byte-identical

Server  BUILD 26E runtime commit 06b868100c3bd7d584385cce3ebe27fdda951b55
        server suite 2261 / 0 · tsc clean
```

**Monorepo advance is NOT runtime drift.** The monorepo HEAD has moved to `92b9c413…`, 32
commits ahead, from an unrelated documentation track.
`git diff 06b868100c3b..HEAD -- bty-karaoke` is **empty**, and production still serves
`06b868100c3b`. Recorded honestly; not counted as BUILD 26E drift.

## 4. Migration / schema authority

```
20260809120000_karaoke_account_deletion_authority_v1.sql
checksum fd7c2423b6fec5434168737e6ecbef2d1c092e1135f985a87ee4014f36217992
applied  2026-08-06T04:04:37Z → 04:04:39Z   parity 38 / 38, no drift
```

Forward-only, additive, idempotent. Six new tables (identity fingerprints, FREE-window
carryover, storage-cleanup outbox, deletion audit, provider-revocation jobs, deletion
events), the account tombstone, room/workspace retirement, attribution snapshots, the
BUILD 18C G5 CHECK relaxation, and five missing indexes.

**Zero live-data change on application.** Pre/post snapshots differed only by the six new
tables appearing empty; all 17 existing table counts, all 7 accounts, all rooms, sessions,
passes and plans were byte-identical.

## 5. Canonical account / purchase-owner authority model

**The central invariant: `karaoke_accounts` rows are NEVER hard-deleted.** The row becomes
an anonymized tombstone, so all 19 foreign keys keep a valid target and no cascade or
`SET NULL` ever fires. Attribution, audit and metering survive by construction rather than
by remembering to protect each table.

`purchase_owner_ref` and `authority_ref` are independent random UUIDs — not derived from
`account_id`, not equal to each other — so a leak of either correlates to nothing.

## 6. Deletion transaction behaviour

One transaction, account derived from the authenticated session, never from the request
body. Order: advisory lock → not-already-deleted → **fingerprint completeness (fails closed
before any mutation)** → revoke sessions → resolve estate → revoke devices, pairing and
setup tokens, guest handoffs, room sessions → retire and anonymize rooms → retire
workspaces → end events → anonymize requests → revoke passes with audit → end plans →
store fingerprints → delete identities → delete saved songs and operational rows →
anonymize the account → enqueue storage cleanup → write the immutable audit.

## 7. Apple revocation architecture

Programmatic revocation is the **required normal path**. Missing Worker secrets are a
**deployment blocker** — an Apple-linked deletion refuses to start (503) rather than
completing while recording that revocation was unavailable. A permanent audit must never
present a configuration mistake as a user-level outcome.

Because Apple's endpoints cannot join the deletion transaction, the outcome lives in a
durable job holding only AES-256-GCM ciphertext, and later transitions are recorded as
append-only events. A prepared job is destroyed if the deletion transaction fails; once it
commits, no Apple or Storage outage restores account access.

## 8. G1–G9 final ledger

| Gate | Verdict | Evidence |
|---|---|---|
| **G1** Installation / existing-account restoration | **PASS** | Founder-attested, physical device, build 83 |
| **G2** Discoverability + disclosure | **PASS (≥1-room scope)** + zero-room gap repaired — see below |
| **G3** Cancellation / zero server mutation | **PASS** | Founder-attested + read-only server verification |
| **G4** Complete account deletion | **PASS** | two production deletions — §9, §10 |
| **G5** Apple identity non-resurrection | **PASS** | §11 |
| **G6** Google identity non-resurrection | **PASS** | Google-only fixture, §9 |
| **G7** Linked-provider deletion safety | **PASS (deletion side)** · post-delete re-link **NOT RUN** |
| **G8** Retained authority integrity | **PASS — NON-VACUOUS** | §13 |
| **G9** Unrelated-account isolation | **PASS** | Founder + `account#f77dad8fa1` unchanged |

**G2 — the history, not a rewrite.** G2 originally passed **within the scope it measured**:
the ≥1-room Host state, attested on the Founder account (5 rooms). It did **not** cover the
zero-room state, and the Founder was never asked to test that branch — no such claim is made
here. BUILD 26E-R2 later discovered the zero-room state exposed no deletion control at all
(§15) and repaired it. On build 85 the Founder attested physically that the zero-room
"첫 노래방 만들기" state shows **계정 삭제** and that **DeleteAccountView opens without creating
a room**. The Login Methods and 로그아웃 label assertions are covered by automation
(`B26E-R2-C1..C3`, `D1..D4`), not by separate device attestation.

**G7 — precisely what was measured.** The deletion side is proven: both Apple and Google
identities removed, two fingerprints retained, Google revoked, Apple revocation succeeded,
tombstone left with zero identities. A separate device flow in which the same Google
identity is explicitly **re-linked** to a newly Apple-created account was **NOT executed**.
If the formal G7 definition requires only linked-provider deletion safety, G7 is PASS; if it
requires the post-delete re-link, that sub-scenario is NOT RUN.

## 9. Google-only destructive evidence

`account#bb095c7cba`, deleted `2026-08-06T13:43:38.24786Z`, source `host_native`.

```
tombstone: status deleted · email/display_name/legacy provider columns nulled · identities 0
sessions revoked 2 · dj devices revoked 1 · rooms retired 1 · events ended 1 · plans ended 1
provider_revocation {"apple":"not_linked","google":"revoked"}
storage NONE_REQUIRED (no logo) · passesRevoked 0 · requestsAnonymized 0
room norebang-1b4p6jqh → retired, "(삭제된 방)", slug retained
live proof: POST /api/rooms/norebang-1b4p6jqh/requests → 410 ROOM_RETIRED
```

This run proved tombstone, retirement, credential revocation and G6. It was **vacuous** for
passes, metering and storage — the account held none. That limitation was recorded at the
time and later closed by the Apple fixture.

## 10. Apple+Google destructive evidence — the canonical gate fixture

`account#ef4cc5d246`, deleted **`2026-08-08T05:36:46.476614Z`**, source `host_native`.

```
identities 2 → 0 (apple + google)          all sessions revoked (3)
room cool-wrqmm5vz retained + retired      renamed "(삭제된 방)"
logo pointer cleared                       workspace retired · event ended
credential_revocation {djDevices:5, hostSessions:3, roomsRetired:1, eventsEnded:1,
                       plansEnded:1, passesRevoked:1, requestsAnonymized:2, guestHandoffs:1}
completion COMPLETED_WITH_PENDING_CLEANUP · storage ENQUEUED
```

A second, independent Apple deletion (`account#98d3496f7c`, `05:41:24Z`) also revoked
successfully on attempt 1. It is corroboration only — **`account#ef4cc5d246` is the
canonical gate fixture**.

## 11. G5 non-resurrection + 504 s carryover

Re-signing in with the **same Apple identity** after deletion:

```
did NOT restore account#ef4cc5d246          created a fresh canonical account
inherited no room                            tombstone remained deleted, deleted_at unchanged
```

The FREE carryover is the positive proof the fingerprint matched:

```
karaoke_free_window_carryover:
  to account#98d3496f7c  from account#ef4cc5d246
  carried_used_seconds 504 · grace_consumed false · window 2026-08-07T11:00:00Z
```

**504 seconds is the non-zero authority evidence** — the anti-abuse path did not merely run,
it carried a real balance, so deleting and re-creating an account cannot reset the daily
free allowance.

## 12. Storage outbox non-vacuous proof

```
bucket room-logos · status DONE · attempts 1
enqueued 2026-08-08T05:36:46.470Z → completed 2026-08-08T05:36:48.702Z
```

The original 205,894-byte WebP object was removed and the public proxy stopped serving it.
The durable retry path was exercised end-to-end for the first time.

## 13. Pass / audit retention proof

```
pass grant RETAINED, AVAILABLE → REVOKED, revoke_reason 'account_deleted'
pass audit retained and appended
2 guest requests retained, guest_name anonymized, status/resolution/video ids untouched
504 metered FREE seconds retained (nothing rewritten)
room / workspace / event retained in retired + anonymized form
2 identity fingerprints (apple + google), one-way 64-hex, no subject or email
immutable deletion audit, zero PII
```

**Explicit limitation — not smoothed into a PASS.** The pass was **AVAILABLE** at deletion.
The already-**ACTIVE** pass deletion path, and therefore the BUILD 18C G5 CHECK relaxation
that makes revoked-after-use representable, was **NOT re-exercised** in BUILD 26E.

## 14. R1 — false-success logout defect (build 84)

**The defect, measured on build 83.** A user tapped 영구 삭제, the app went straight to the
login screen with no message, and the server had deleted nothing.

The server emits three different 401 bodies; the client matched one:

```
server   401 {"error":"reauth_required"}        recoverable, mutated nothing
client   errorCode == "apple_reauth_required" ? .reauthRequired : .sessionInvalid
result   → .sessionInvalid → Keychain purged → login screen → account still existed
```

`confirm()` then set an error message and called `dismiss()` in the same tick, so it never
rendered. Silent logout is indistinguishable from successful deletion.

**Why nothing caught it.** The server suite asserted it emits `reauth_required`; the native
suite asserted it handles `apple_reauth_required`. No test compared the two literals, and
mutation testing had only ever mutated the guard, never the string.

**Repair — commit `b721744d923593f1d3b5e39cba26925d16942d9c`, build 84.**

```
reauth_required        → reauthRequired, credentials retained
apple_reauth_required  → reauthRequired, credentials retained
Unauthorized           → sessionInvalid
unknown / nil 401      → retryable, credentials retained (fail safe)
only .deleted performs the deletion teardown
failure sheet remains visible (no synchronous dismiss)
dead-session login screen states the account was NOT deleted
serverNow anchors the re-auth timestamp; server's 10 min / 60 s authority unchanged
```

Two pre-existing assertions had **encoded the defect as the contract** and were corrected,
not accommodated.

**Honesty.** A deliberate physical-device reproduction of the server's `401 reauth_required`
branch on build 84/85 was **NOT performed**. The evidence is the automated server↔native
literal contract plus mutation proof (R1a–R1f), not a device observation.

## 15. R2 — zero-room discoverability defect (build 85)

`FirstRoomOnboardingView` exposed only a room-name field, 노래방 만들기, and a button
labelled "다른 로그인 방법 사용" that actually performed sign-out. It omitted Login Methods,
an explicit logout, and Delete Account. `DeleteAccountView` was reachable only from
`MyNorebangView`, and `.myNorebang` is unreachable while `rooms.isEmpty` — so a valid
authenticated account had to create karaoke data it did not want before it could delete
itself.

**Repair — commit `0d8e593c1013b65aea7f6027f312d49d1390f129`, build 85.** A shared
`HostAccountControls` / `HostAccountActions` surface, rendered by both signed-in states, with
exactly one `DeleteAccountView` construction in the app.

**Founder-attested on device (build 85):** `account#70e3bf37b5`, zero rooms, "첫 노래방
만들기" state — **계정 삭제 visible**, **Delete Account sheet opened successfully**, **no room
had to be created**, and **no destructive deletion was required**. The Login Methods and
logout-label changes are covered by automation only.

## 16. Privacy / retention disclosure — **RESOLVED**

**PASS.** Before this build the deployed policy was entirely Guest-oriented: §11 covered the
YouTube cache, song request records and browser storage; §12 offered manual, email-based
deletion of a display name and song requests. All **eleven** required disclosures were
absent.

The correction shipped as one new bilingual section, `12a. Host account deletion` /
`12a. 호스트 계정 삭제` — **+78 lines, one file, additive only**, no schema, API or StoreKit
change.

```
commit        50b34aca3e64758fdf893ab64edba02a6fbdc995
              docs(karaoke): disclose account-deletion retention
              1 file changed, 78 insertions(+) · secret scan 0 hits
verify        server suite 2261 / 0 · tsc --noEmit clean · cf:build success
Worker ver    8e1f90f8-a4e0-4f72-b7a7-6f884a32dea5
              16 / 16 secrets verified inherited BEFORE deploy (parity with live)
deployment    9754e56c-df51-45bc-9343-18740733af8e @ 100%  ·  2026-08-08T14:11:18Z
```

Verification was run against **production**, not the source, and only after edge
convergence: an initial probe still saw the previous build on ~2.5 % of responses, so the
measurement was repeated until 60 / 60 consecutive responses reported `50b34aca3e64`. A
single deployed version at 100 % distinguished propagation lag from a genuine traffic split.

Live result — **EN 11 / 11, KO 11 / 11**: in-app deletion · tombstone · retired/anonymized
rooms · anonymized history · pass & usage retention (anti-abuse) · one-way fingerprint ·
opaque purchase/authority reference · 90-day session retention · provider revocation with
the iOS Settings fallback · asynchronous logo cleanup (24 h normal / 30 d maximum) · non-PII
deletion audit. Both `12a` headings render.

## 17. Known non-blocking gaps / NOT RUN items

1. **Native room-logo management — NOT IMPLEMENTED** in build 85. The only supported logo
   surface is the web console at `/host/rooms/{slug}/settings`.
2. **Web room-settings discoverability** — the route exists but has no in-product link; the
   URL had to be typed.
3. **ACTIVE timed-pass deletion — NOT RUN.** `AVAILABLE → REVOKED` is production-proven; the
   already-activated path and the BUILD 18C CHECK relaxation are not.
4. **Same-Google post-delete explicit re-link — NOT RUN** (see G7).
5. **R1 device reproduction — NOT RUN** (see §14).

None is converted into a successful physical test anywhere in this document.

## 18. Preserved dirty files / scheme integrity

```
M  bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
?? bty-karaoke/brand/
?? bty-karaoke/docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md
M  BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
   SHA-256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e  (unchanged throughout)
```

The xcscheme's disabled `-BTYAPIBaseURL` device-gate arguments were neither removed nor
enabled at any point.

## 19. Production identity / migration parity

```
/api/karaoke-build   50b34aca3e64          (60 / 60 consecutive, converged)
Worker version       8e1f90f8-a4e0-4f72-b7a7-6f884a32dea5 @ 100%
deployment           9754e56c-df51-45bc-9343-18740733af8e   2026-08-08T14:11:18Z
migrations           38 / 38 local+remote paired, no drift (incl. 20260809120000)
```

The runtime commit `06b868100c3b` (§3) carried every BUILD 26E code path; `50b34aca3e64` is
that commit plus the privacy disclosure and nothing else.

Prior deployment, retained for the record:
`68455c8f-20a2-4135-ba0b-1dba29ac303a` @ 100 % / `3eb33d74-5da5-41b6-b4ff-dea7ddaec04b`,
serving `06b868100c3b`.

## 20. Why StoreKit / TestFlight / App Review remain outside BUILD 26E

BUILD 26E exists to make deletion safe **before** commerce, because the two are coupled in
one direction only: a purchase ledger must survive account deletion, and that is impossible
until deletion is a tombstone rather than a cascade. Track B0 established the sequencing —
BUILD 26E is Slice 1, and the purchase ledger, transaction verification, StoreKit surface,
notifications and refunds are Slices 2–10. Deletion is also an App Review prerequisite in
its own right (Guideline 5.1.1(v)), independent of any purchase.

Purchase authority in this build is **schema and deletion behaviour only**:
`purchase_owner_ref` exists, and the future ledger's `ON DELETE RESTRICT` rule and global
`UNIQUE(environment, apple_transaction_id)` requirement are recorded. No purchase runtime
was written.

## 21. Final statement

**BUILD 26E is `PASS / CLOSED`** as of 2026-08-08.

Every gate passes, both defects found during gating are repaired and mutation-verified, the
Apple revocation lifecycle is production-proven, and the deployed privacy policy now
describes the shipped behaviour in both languages — verified live, after convergence, at
11 / 11 in each.

A Host can permanently delete their account from inside the app; the deletion removes access
and personal data while preserving the pass, audit, metering and future financial authority
that a purchase ledger will depend on. Deletion is now safe to build commerce on top of,
which was the entire reason this build preceded StoreKit.

Deliberately **not** claimed: deletion of an account holding an ACTIVE paid pass, explicit
post-delete Google re-link, and physical reproduction of the exact R1 401 — all NOT RUN
(§17). Native logo management remains unimplemented and the Web settings surface remains
hard to discover; both are recorded as non-blocking gaps, not as passes.
