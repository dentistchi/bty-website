# BUILD 26I — Account Deletion Production Verification & Gap Closure V1

**Status:** `BLOCKED`
**Blocker:** the single remaining item is G1–G10 on a physical iPhone running build 87.
Everything that does not require a human holding a device is complete, deployed and
verified. §13 is the runbook; §1 states exactly what flips this to `PASS / CLOSED`.

BUILD 26I is a **verification-and-gap-closure build over the already-deployed BUILD 26E
deletion authority**. It is not a re-implementation. No component of the shipped deletion
architecture was redesigned.

---

## 1. Verdict

`BLOCKED` — on physical-device execution only.

| PASS requirement (§16 of the directive) | State |
|---|---|
| existing production deletion authority intact, or measured defects repaired | ✅ one defect found and repaired — §5 |
| Native build 87 | ✅ committed, built, artifact verified |
| retention ledger proven | ✅ all 3 production tombstones PASS — §4 |
| complete automated matrix green | ✅ 2427 tests, 32 new, 27/27 mutants killed — §6 |
| ACTIVE timed-pass production deletion | ⏳ G5 — requires a device |
| multiple-session revocation | ⏳ G4 — requires a device |
| same-Google post-delete lifecycle | ⏳ G7 — requires a device |
| deleted account resurrection impossible | ✅ proven in production for Apple — §8; Google leg ⏳ G7 |
| Apple tombstone invariant proven | ✅ production evidence — §8 |
| linked-provider deletion proven | ✅ production evidence — §10; re-proof ⏳ G6 |
| failure safety | ✅ automated; ⏳ G9 on device |
| KO/EN deletion UX | ✅ catalog verified; ⏳ G1/G2 on device |
| full regression green | ✅ §14 |
| closure document committed | ✅ this file |
| build commits pushed, HEAD/origin `0 0` | ✅ §18, §19 |
| unrelated dirty state preserved | ✅ §19 |

**Nothing here is claimed from source inspection.** Every production statement below is
backed by a live query, a live HTTP probe, or a CLI result captured during this build.

---

## 2. Measured preflight

### Web/server (monorepo `btytrainingcenter`, subdir `bty-karaoke/`)

```
HEAD        55d002a0c4acbbe1cf009cd4d3cc5cdf87d87d5c   (at preflight)
origin/main 55d002a0c4acbbe1cf009cd4d3cc5cdf87d87d5c
left/right  0 0
```

373 dirty entries repo-wide; **370 are `bty-app/` (BTY Arena)** from an unrelated track and
were never touched. Karaoke-scoped dirty state, preserved exactly:

```
 M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
?? bty-karaoke/brand/
?? bty-karaoke/docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md
```

### Native

```
HEAD        30dbf403a042e7684f279dcccb2de8bf925521ff   (at preflight)
origin/main 30dbf403a042e7684f279dcccb2de8bf925521ff
left/right  0 0
CFBundleVersion 86 · MARKETING_VERSION 1.0
PRODUCT_BUNDLE_IDENTIFIER com.bty.BTYNorebangAdmin
CFBundleDisplayName "BTY Norebang Admin" · target/scheme BTYNorebangAdmin
```

`GENERATE_INFOPLIST_FILE = YES`; the checked-in `Info.plist` holds no version keys, so
`project.pbxproj` is the sole version authority.

**xcscheme.** Working-tree SHA-256 `32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e`
— the §18 baseline — while HEAD's committed blob is `215cc266bab9d4dcb0438292ec9c72b6f72fde8ee869e06d3f7c1ce2ba078486`.
The baseline therefore names the **dirty working tree**, not the commit. The uncommitted
delta is a local device-testing edit (`LaunchAction` Debug→Release plus two disabled
`-BTYAPIBaseURL` arguments). Preserved byte-for-byte, never staged; re-verified after the
build-87 bump.

---

## 3. Why re-implementation was rejected

The directive's original objective — build the production deletion path — was already met.
Verified independently of the BUILD 26E document:

| Claim | Independent evidence |
|---|---|
| deletion API is live | `POST /api/host/account/delete` → **401**; control `…/delete-nope` → **404** (non-vacuous) |
| it is not the logout route | `DELETE /api/host/me` with an unknown bearer → **200 `{"ok":true}`**; it 200s for tokens that do not exist and revokes only the presented session |
| schema is deployed | `20260809120000` present in the remote migration table; parity 38/38 at preflight |
| revocation is configured | 16/16 Worker secrets, including all five Apple revocation secrets and `KARAOKE_IDENTITY_FINGERPRINT_SECRET` |
| the app has the UI | `DeleteAccountView`, reachable from **both** signed-in surfaces (`HostViews.swift:60`, `:505`) |
| the promise matches | live `/privacy` serves bilingual `12a. Host account deletion` / `12a. 호스트 계정 삭제` |
| it has been used | three real tombstones in production, all `deletion_source = host_native` |

Rebuilding this would have replaced a gate-proven system, violating directive rules 6 and
13. BUILD 26I therefore verifies, closes gaps, and repairs exactly one measured defect.

---

## 4. Retention ledger

Derived from the deployed migration and **verified against live production data**. Executable
as `scripts/build26i-gate-evidence.mjs --verify <accountId>`.

| Data class | Source | Action | Identifier handling | Retention | Why | Production evidence |
|---|---|---|---|---|---|---|
| Account record | `karaoke_accounts` | **ANONYMIZE** | email, display name, last-login nulled; timezone reset to default | permanent tombstone | 19 FKs reference it; a hard delete either aborts or cascades away retained authority | 3/3 tombstones: all identifying fields null, `deletion_version BUILD26E_V1` |
| Legacy provider columns | `karaoke_accounts.provider(_subject)` | **DELETE** | nulled | — | a second, older copy of provider identity an identity-row-only delete would miss | 3/3 null |
| Commerce/audit handles | `purchase_owner_ref`, `authority_ref` | **RETAIN** | independent random UUIDs | permanent | future purchase authority + audit attribution; a leak of either correlates to nothing | 3/3 mutually distinct and distinct from `id` |
| Identity links | `karaoke_account_identities` | **DELETE** | rows removed | — | neither provider may reopen the account | 0 rows across all tombstones |
| Provider fingerprints | `karaoke_identity_fingerprints` | **RETAIN** | one-way HMAC-SHA256, secret outside the DB | permanent | closes the delete-and-recreate FREE-window reset | 3 rows; **pointer defect found and repaired — §5** |
| Host sessions | `karaoke_host_sessions` | **RETAIN → purge** | status `revoked` | 90 days, then purged | evidence of revocation, then gone | 11/11 revoked, 0 active |
| DJ / device credentials | `karaoke_dj_devices` | **RETAIN** | status `revoked` | permanent | room-scoped auth must die with the room; nulling `account_id` is not revocation | 8 revoked, 0 active |
| Pairing / admin-setup tokens | `karaoke_pairing_tokens`, `karaoke_admin_setup_tokens` | **RETAIN** | expiry forced to now | permanent | unredeemed invitations must not survive | audited counts in each deletion row |
| Guest handoffs | `karaoke_guest_app_handoffs` | **RETAIN** | status `REVOKED` | permanent | an outstanding handoff must not open a retired room | 1 REVOKED, 0 ACTIVE |
| Timed-pass grants | `timed_access_pass_grants` | **RETAIN** | `REVOKED`, `revoke_reason='account_deleted'`; activation facts kept | permanent | refund/audit authority; forfeiting access ≠ erasing the purchase | 1 grant REVOKED with reason; **never-activated only — G5 gap** |
| Timed-pass audit | `timed_access_pass_audit` | **RETAIN** | append-only | permanent | an append-only ledger cannot be rewritten | 2 rows retained + appended |
| Host plan assignments | `karaoke_host_plan_assignments` | **RETAIN** | status `ended` | permanent | billing history | 3/3 ended, 0 active |
| Metering / usage | `karaoke_event_usage_segments` | **RETAIN** | pseudonymous (`account_id` → tombstone) | permanent | anti-abuse + future billing truth | 2 segments retained untouched |
| Saved songs | `karaoke_user_saved_songs` | **DELETE** | rows removed | — | pure user content, no retention basis | 0 rows |
| Idempotency / rollout | `karaoke_room_creation_idempotency`, `karaoke_lease_rollout` | **DELETE** | rows removed | — | operational scratch | 0 rows |
| Workspaces | `karaoke_workspaces` | **RETAIN** | status `retired` | permanent | a cascade would brick rooms into an ownerless graph | 3/3 retired |
| Rooms | `karaoke_rooms` | **ANONYMIZE + RETIRE** | name → `(삭제된 방)`; PIN, welcome text, logo pointer cleared | permanent | frozen, never reopened, never transferred | 3/3 retired and anonymized |
| Room slugs | `karaoke_rooms.slug` | **RETAIN** | kept unique | permanent | an old QR must never resolve to a future room | 3/3 retained under the unique index |
| Request history | `karaoke_requests` | **ANONYMIZE** | `guest_name` → `(삭제됨)`, `search_query` nulled | permanent | BUILD 25 resolution truth must stay historically accurate | 2 rows: names replaced, 0 search queries, statuses/ordering untouched |
| Events | `karaoke_events` | **ANONYMIZE + END** | name → `(삭제된 이벤트)`, host name and `created_by` nulled | permanent | no live event on a retired room | 3/3 ended and anonymized |
| Logo objects | Storage `room-logos` | **DELETE** | pointer cleared in-transaction; object via durable outbox | ≤30-day deadline | DB and Storage are not one transaction | 1 row `DONE` after 1 attempt |
| Deletion audit | `karaoke_account_deletion_audit` | **RETAIN** | pseudonymous only, append-only trigger | permanent | proof the deletion happened | 3 rows, no PII |
| Provider revocation | `karaoke_provider_revocation_jobs` + `…_deletion_events` | **RETAIN** | token material erased in every terminal state | permanent | Apple's call cannot join the transaction | 2 Apple jobs `succeeded`, token erased, attempt 1 |
| FREE-window carryover | `karaoke_free_window_carryover` | **RETAIN** | keyed to tombstone | until window end | stops a recreate resetting the daily allowance | 1 row: 504 s carried, matching the tombstone's 276+228 s exactly |
| Guest/room data of other accounts | various | **NOT USER-OWNED** | untouched | — | isolation | unrelated account `f77dad8f` unchanged |

**Ledger result:** `LEDGER PASS` for all three production tombstones after the §5 repair —
22/22 classes each.

One observation recorded rather than smoothed over: tombstone `ef4cc5d2` retains a usage
segment with `ended_at = null` and a request left `status='playing'`. Both are **correct
under F-4**, which forbids rewriting metering and resolution truth. Neither leaks: the
segment's `lease_seconds` was already final under the BUILD 20M non-shrinkable lease, the
event is `ended` so `activePlaybackCount` excludes it, and the room is `retired` so
`begin_song_v2` refuses before ownership is resolved. The 504 s carried forward equals the
sum of both segments, which is the arithmetic proof that retention and carryover agree.

---

## 5. DEFECT-26I-1 — found in production, repaired

**Discovered by running the §4 ledger against production, not by reading source.**

Tombstone `98d3496f` had **no fingerprint row pointing at it**, while the Apple fingerprint
for the identity it owned still pointed at the earlier tombstone `ef4cc5d2` with
`last_deleted_at` correctly advanced to `98d3496f`'s deletion instant.

**Cause.** `karaoke_delete_account_v1` upserted the one-way fingerprint with

```sql
on conflict (fingerprint) do update set last_deleted_at = excluded.last_deleted_at;
```

so the **second and every later** deletion of one provider identity advanced the timestamp
but froze `account_tombstone_id` on the first tombstone that identity ever produced.

**Violated invariant — F-5.** `karaoke_apply_free_window_carryover_v1` resolves the
tombstone through that pointer and then sums (a) that tombstone's metered seconds in the
current window and (b) carryover rows keyed to it. With a frozen pointer **both** terms
address the wrong account from the second delete-and-recreate onward: the intermediate
account's consumed seconds are invisible, and so is the carryover it had itself inherited.
In production, `ef4cc5d2` consumed 504 s and `98d3496f` inherited exactly those 504 s — but
a third signup on that Apple identity inside the same window would have resolved back to
`ef4cc5d2` and carried 504 s, forgiving everything `98d3496f` consumed. Every cycle after
the first returned a fresh FREE allowance. That is precisely the abuse F-5 exists to
forbid.

**Why BUILD 26E could not see it.** The first recreate is always correct, and 26E's gating
exercised exactly one.

**Repair — one clause.** Migration `20260810120000_karaoke_deletion_fingerprint_latest_tombstone_v1.sql`:

```sql
on conflict (fingerprint) do update set
      last_deleted_at      = excluded.last_deleted_at,
      account_tombstone_id = excluded.account_tombstone_id;
```

That is the value the carryover chaining already assumed ("a second deletion inside one
window must not drop the first's state"); the write site simply never supplied it.
`karaoke_delete_account_v1` is re-issued **byte-identically apart from this clause** —
`diff` of the two function bodies reports exactly the three changed lines, and test (28)
pins it by splitting both normalized bodies on the clause and asserting the surrounding
text is identical.

**Backfill.** The fingerprint is one-way and the identities are gone, so the producing
identities cannot be recomputed. `last_deleted_at` and `karaoke_accounts.deleted_at` are
written from the same `clock_timestamp()` in the same transaction, so joining on that
equality names the correct tombstone without reversing anything. Idempotent (`<>` predicate
excludes already-correct rows); it only re-points, never inserts or deletes.

**Applied to production 2026-08-09.** Migration parity **39/39**. Result:

```
apple  account_tombstone_id  ef4cc5d2… → 98d3496f…   (first_deleted_at preserved)
```

All three tombstones then returned `LEDGER PASS`.

**Scope discipline.** Forward-only and additive. No table, constraint, grant, or other
function was touched — test (30) asserts no `create table` / `alter table` /
`drop constraint`, and test (32) asserts `begin_song_v2`, the carryover RPC and the
entitlement RPC are **not** re-issued. Retention policy is unchanged: nothing newly
deleted, nothing newly retained.

---

## 6. Automated gap matrix

Existing BUILD 26E deletion coverage: **96 tests** across five files. Mapping them onto the
directive's 35-item matrix left seven items with no assertion anywhere. Added in
`src/lib/account-deletion-gap-closure.test.ts` — **32 tests, additive only**:

| Matrix item | Tests |
|---|---|
| §4.5 post-delete protected API refusal | (1)(2)(3) — `GET /api/host/me` → 401, byte-identical to an unknown token, guard re-resolved per request |
| §4.7/4.8 multi-session revocation | (4)(5)(6) — account-scoped, no `limit`, no `id =`, devices revoked not orphaned, count audited |
| §4.13 account-scoped, not identity-scoped | (7)(8)(9)(10) — no provider predicate, every identity fingerprinted, completeness guard unbounded, legacy columns nulled |
| §4.16 non-retained content deleted | (11)(12)(13) — saved songs, idempotency, lease rollout; and the retained classes still never deleted |
| §4.30/4.31 no resurrection | (14)(15)(16)(17)(18) — `deleted_at` never cleared, carryover refuses self-target, writes only the carryover row, restores only window seconds, tombstone FKs are RESTRICT |
| §4.33/4.35 ACTIVE timed pass | (19)(20)(21)(22)(23)(24) — ACTIVE revoked, activation facts retained, the CHECK admits revoked-after-use, per-grant audit, retained evidence confers no playback, retired room refuses first |
| DEFECT-26I-1 regression | (25)–(32) |

Matrix items 1–4, 6, 9–12, 14–15, 17–29, 32, 34 were already covered by BUILD 26E and were
re-run, not re-written. Items 26 (native double-submit), 33 and 35 have their end-to-end
production leg at G5.

**Mutation verification — 27 mutants, 27 killed, 0 survivors.** Each mutant is a real
regression the assertions exist to catch (session revoke limited to one row; identity delete
narrowed to one provider; ACTIVE dropped from the revoke list; activation facts nulled;
carryover reactivating the tombstone; the repair reverted to the frozen clause; the backfill
joined on the wrong column; a schema change smuggled into the re-issue; …). Every mutated
file was restored and SHA-256-verified byte-identical.

Passing assertions are not evidence on their own — the mutants are what make these 32 tests
mean something.

---

## 7. ACTIVE timed-pass deletion — GAP OPEN (G5)

Confirmed open **from production, not from the BUILD 26E document**: the only pass ever
revoked by a deletion was `ONE_HOUR`, `activated_at = null` — never activated. The
already-ACTIVE path has still never executed in production.

Everything around it is verified: the CHECK relaxation admitting revoked-after-use is
deployed, the RPC includes `ACTIVE` in the revoke set, activation facts are provably not
rewritten, and `begin_song_v2` keys playback on `status='ACTIVE' and expires_at > now`, so
retained evidence confers nothing. Test (21) also pins why this matters operationally: a
non-relaxed CHECK would **abort the whole deletion transaction** for exactly the accounts
that paid. G5 is therefore a loud gate, not a silent one.

**Fixture C recipe** (real product path, no DB poking): Manager issues a pass → Host selects
it → Host starts a song, which activates it → confirm `status='ACTIVE'` via `--baseline` →
delete through the Native UI → `--verify`.

---

## 8. Apple recreation / non-resurrection — PROVEN in production

Recovered from BUILD 26E's own production data, which 26E did not claim:

```
ef4cc5d2  created 2026-08-08T04:58:51  deleted 05:36:46   (Apple + Google linked)
98d3496f  created 2026-08-08T05:37:11  deleted 05:41:24   (Apple)
apple fingerprint  first_deleted 05:36:46   last_deleted 05:41:24
carryover  98d3496f ← source ef4cc5d2, 504 s
```

`98d3496f` was created **25 seconds after** `ef4cc5d2` was deleted. The Apple fingerprint's
`last_deleted_at` advanced to `98d3496f`'s deletion instant, which only happens through the
`on conflict` path — i.e. the **same Apple subject** was deleted twice. The carryover row
names `ef4cc5d2` as its source. Together these prove: a new account row, the old one still
tombstoned and never re-activated, and only FREE-window seconds carried across.

`--recreation ef4cc5d2 98d3496f` → **RECREATION PASS**, 10/10 invariants.

This is historical evidence supporting the ledger. G8 re-proves it on build 87.

---

## 9. Google recreation — GAP OPEN (G7)

Also confirmed from production rather than from the document: there are **two distinct
Google fingerprint rows** (`bb095c7c`, `ef4cc5d2`). A reused Google identity would have
produced **one** row with an advanced `last_deleted_at`, exactly as Apple did. So the
same-Google post-delete lifecycle has never executed. G7 remains genuinely open.

Note the interaction with §5: before this build, a second same-identity deletion was the
very operation that exposed DEFECT-26I-1. G7 now also serves as the live proof of the
repair.

---

## 10. Linked Apple + Google — PROVEN (deletion side)

`ef4cc5d2` carried **both** an Apple and a Google fingerprint and one deletion audit row
reporting `{apple: pending→succeeded, google: revoked}`. One BTY account, one deletion, both
identity rows gone, both grants addressed. Deleting through one provider did not leave the
other holding an active account.

G6 re-proves this on build 87.

---

## 11. Session revocation, failure safety, transaction boundary

All sessions for the account are revoked inside the single deletion transaction, scoped by
`account_id` with no row limit (tests 4–6); production shows **11/11 revoked, 0 active**
across the three tombstones, with counts recorded in each audit row (2, 3, 2).

**Commit point.** One transaction under the canonical account advisory lock. Everything
that can refuse does so **before** any mutation: source validation, not-already-deleted,
fingerprint completeness, Apple config, Apple code exchange, subject match. After the RPC
commits, nothing restores access — not an Apple outage, not a Storage outage, not a crash.

**Outside the transaction, by necessity.** Apple's token/revoke endpoints and Storage
deletes cannot join it, so both are durable: a revocation job with an explicit terminal
state and append-only events, and a retryable outbox with a 30-day deadline. Failures are
recorded, never swallowed — production shows `succeeded` with token material erased and
`DONE` after one attempt. The immutable audit snapshots the status at commit time
(`apple: pending`) and the append-only event log carries the later truth
(`APPLE_REVOCATION_SUCCEEDED`), which is the reconciliation the design intends and
production demonstrates.

---

## 12. Native UX, localization, security

**UX.** `DeleteAccountView` is reached from **both** signed-in surfaces, never gated behind
creating a room. Sign-out and deletion are distinct labels and distinct code paths; the
retired misleading sign-out label is pinned so it cannot return. `.deleted` is the only
outcome that authorizes clearing credentials as a deletion; `.sessionInvalid` clears a
worthless credential without ever claiming deletion; every recoverable failure keeps the
session so a failed deletion cannot strand the user.

**Localization.** Catalog unchanged by this build — no new user-facing strings were needed.

```
total catalog keys   403
manual translations  403      (every key translated in en AND ko)
non-manual             0      (states = {translated} only)
deletion-related keys 33
localization mutants  12 / 12 killed  (BUILD 26F architecture, re-run intact)
```

Built Release artifact ships `en.lproj` + `ko.lproj`. Zero fallback leakage.

**Security.** The deletion target derives from `authorizeHost()` over the session; the body
is never consulted for identity and there is no code path that reads a body-supplied
account id (test 2, BUILD 26E). No `DELETE /account/{id}` shape exists. Confirmation phrase
+ recent-auth window + per-account rate limiting; CSRF required for cookie callers and
correctly not required for Bearer callers, which carry no ambient credential. `409` on
identity mismatch reveals only that the proved identity is not this session's — never
whether another account exists. No response returns a provider subject, token material, or
audit internals. IDOR, CSRF, replay (`apple_code_invalid`), privilege escalation and
provider-linkage confusion are each covered by named tests.

---

## 13. Runbook — the remaining physical-device gates (build 87)

Install build 87 on a real iPhone. Use disposable Founder-controlled accounts only.

```bash
cd bty-karaoke
node scripts/build26i-gate-evidence.mjs --list                       # pick a disposable account
node scripts/build26i-gate-evidence.mjs --baseline <id> > before.json # BEFORE each destructive gate
#   … perform the gate on the device …
node scripts/build26i-gate-evidence.mjs --verify   <id>              # 22-class ledger, exit 0 = PASS
node scripts/build26i-gate-evidence.mjs --recreation <oldId> <newId> # G7 / G8
```

| Gate | What to do | PASS condition |
|---|---|---|
| **G1** English surface | English device | Delete Account visible, copy fully English, Cancel mutates nothing (`--verify` must still say *not deleted*) |
| **G2** Korean surface | Korean device | `계정 삭제` localized, confirmation fully Korean, no leakage beyond proper nouns |
| **G3** Ordinary deletion | Fixture A | `--verify` exit 0; app signed out; relaunch still signed out; `GET /api/host/me` → 401 |
| **G4** Multi-session | Fixture B, ≥2 sessions | after deletion `sessions.active = 0`; the second session's token → 401 |
| **G5** ACTIVE pass | Fixture C (§7 recipe) | deletion succeeds; grant `REVOKED`/`account_deleted` with `activated_at` and `expires_at` **retained**; `--verify` exit 0 |
| **G6** Linked providers | Fixture E | one account deleted, both identity rows gone, both revocations reported |
| **G7** Google recreation | Fixture D | `--recreation` exit 0; **and** the Google fingerprint's `account_tombstone_id` now names the NEW tombstone — the live proof of §5 |
| **G8** Apple invariant | Apple fixture | `--recreation` exit 0; old account never re-activated |
| **G9** Failure safety | force a pre-commit failure | no false success; `--verify` reports *not deleted*; account still coherent; retry succeeds |
| **G10** Regression | — | Apple sign-in, Google sign-in, logout, QR Guest, QR→Native handoff, Host access, KO/EN |

When G1–G10 pass, replace §1's verdict with `PASS / CLOSED`, paste the evidence, and commit.

---

## 14. Regression — measured this build, not reused

```
server unit suite      219 files / 2427 tests passed, 0 failed
  (preflight baseline 218 / 2395 — +1 file, +32 tests, none removed or weakened)
TypeScript             tsc --noEmit clean, exit 0
native host suite      1993 passed, 0 failed        (on build 87)
native Guest suite       854 passed, 0 failed
localization mutants      12 / 12 killed
deletion mutants          27 / 27 killed, 0 survivors, all files restored byte-identical
native Debug build     ** BUILD SUCCEEDED **        generic/platform=iOS
native Release build   ** BUILD SUCCEEDED **        generic/platform=iOS
built artifact         CFBundleVersion 87 · 1.0 · com.bty.BTYNorebangAdmin · en+ko
xcscheme SHA-256       32b3247e…aa1e  — unchanged before and after the bump
```

---

## 15. Native build 87 identity

```
CFBundleVersion            86 → 87   (both build configurations)
MARKETING_VERSION          1.0       unchanged
PRODUCT_BUNDLE_IDENTIFIER  com.bty.BTYNorebangAdmin   unchanged
CFBundleDisplayName        "BTY Norebang Admin"       unchanged (cleanup deferred by directive)
target / scheme            BTYNorebangAdmin           unchanged
```

The catalog pin advanced to 87 and kept its purpose: the negative clause now fails if
*either* configuration is left behind, which is how a Debug/Release split ships two
different build numbers.

---

## 16. Production identity, migration parity, secrets

**No server source changed** — the repair is a migration. Per directive §13 the Worker was
**not** redeployed, because redeploying unchanged code only manufactures a deployment.

```
live build         GET /api/karaoke-build → {"build":"5f37f34dc7da"}
Worker version     9b2701e4-f4bb-4443-a1f8-29fa33d35c97 @ 100%   (BUILD 26H deployment)
runtime drift      git diff 5f37f34d..HEAD -- bty-karaoke/src → ONLY the new .test.ts file
                   non-test runtime files changed: none
secrets            16 / 16 present, unchanged
migration parity   39 / 39 local ↔ remote, no drift
deletion route     POST /api/host/account/delete → 401   (control → 404, non-vacuous)
```

**Deviation recorded.** Bare `supabase … --linked` returned
`403 "Your account does not have the necessary privileges"`. Per the known diagnosis this is
a *wrong-credential* fault, not an access-control one: the `supabase-karaoke` wrapper
(Keychain PAT `bty-norebang-supabase-pat`) succeeded immediately and produced every result
above. The browser login that previously fixed bare `supabase` has lapsed; the wrapper is
required again for any `db push`.

---

## 17. Commits

```
a6a16afc  fix(karaoke):  BUILD 26I — deletion fingerprint must track the latest tombstone
72e4fda0  test(karaoke): BUILD 26I — automated gap-closure matrix + production evidence tool
25b2740   chore(ios):    BUILD 26I — bump CFBundleVersion to 87 for the deletion gates
```

No account-deletion implementation commit exists beyond the one measured defect, and no
churn was manufactured. The pre-existing xcscheme edit and all unrelated Karaoke/Arena dirty
state were deliberately left uncommitted.

---

## 18. Final repository state

```
monorepo   HEAD = origin/main = 72e4fda0…      left/right 0 0   (before this document)
native     HEAD = origin/main = 25b2740…       left/right 0 0
```

Preserved untouched:

```
 M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
?? bty-karaoke/brand/
?? bty-karaoke/docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md
 M BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
 … 370 unrelated bty-app/ (BTY Arena) files
```

---

## 19. Explicit non-claims

Stated plainly rather than smoothed into the verdict:

1. **G1–G10 have not been run on a physical device.** No device gate is claimed. Simulator
   testing would not substitute and was not attempted.
2. **ACTIVE timed-pass deletion has still never executed in production.** The SQL path is
   deployed and pinned; the production proof is G5.
3. **Same-Google post-delete recreation has never executed in production.** G7.
4. **The DEFECT-26I-1 repair is deployed but has not yet been exercised end-to-end.** The
   corrected `ON CONFLICT` clause fires only on a second deletion of one identity; the
   backfill is verified in production, the new clause is proven only by test and by the
   successful DDL application. G7 is its first live exercise.
5. **The `AppleManualRevocationGuidance` path is unexercised in production.** Both real
   Apple revocations succeeded on attempt 1; `manual_required` has never been returned by
   Apple here.
6. **Storage-cleanup retry has never been exercised** — the one outbox row completed on its
   first attempt.
7. **`CFBundleDisplayName` remains "BTY Norebang Admin"**, deferred by directive rule 12.
8. **The §18 xcscheme baseline describes the dirty working tree, not HEAD** (§2).

---

**BUILD 26I is `BLOCKED`** — on physical-device execution alone. The architecture is intact
and unchanged, one genuine production defect was found by measurement and repaired with a
one-clause forward-only migration, the retention ledger passes against every deleted account
in production, the automated matrix is complete and mutation-proven, and build 87 is built
and pushed. §13 is the runbook that closes it.
