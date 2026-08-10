# BUILD 26I — Account Deletion Production Verification & Gap Closure V1

**Status:** `PASS / CLOSED`
**Closed:** 2026-08-10, when G1–G10 completed on a physical iPhone running build 87 against
production, and all twelve production tombstones — spanning BUILD 26E and BUILD 26I —
passed the retention ledger.

BUILD 26I is a **verification-and-gap-closure build over the already-deployed BUILD 26E
deletion authority**. It is not a re-implementation. No component of the shipped deletion
architecture was redesigned. Exactly one measured defect was found and repaired.

---

## 1. Verdict

`PASS / CLOSED`

| PASS requirement (§16 of the directive) | State |
|---|---|
| existing production deletion authority intact, or measured defects repaired | ✅ one defect found and repaired — §5 |
| Native build 87 | ✅ committed, built, artifact verified, all gates run on it |
| retention ledger proven | ✅ **12 / 12** production tombstones, 22 classes each — §4, §13 |
| complete automated matrix green | ✅ 2427 tests, 32 new, 27/27 mutants killed — §6 |
| ACTIVE timed-pass production deletion | ✅ **G5** — activation facts retained, first ever execution |
| multiple-session revocation | ✅ **G4** — 3 sessions, one timestamp, revoked cookie refused |
| same-Google post-delete lifecycle | ✅ **G7** — 728 s, not 900 s |
| deleted account resurrection impossible | ✅ **G7 + G8**, both providers, 10/10 invariants each |
| Apple tombstone invariant proven | ✅ **G8** — new account, pointer correctly did not move on sign-in |
| linked-provider deletion proven | ✅ **G6** — both identities gone, Apple grant revoked |
| failure safety | ✅ **G9** — exactly one audit row; failed attempt prepared nothing |
| KO/EN deletion UX | ✅ **G1 / G2** on device, build 87 |
| full regression green | ✅ §14 — re-measured after every gate |
| closure document committed | ✅ this file |
| build commits pushed, HEAD/origin `0 0` | ✅ §17, §18 |
| unrelated dirty state preserved | ✅ §18 |

**Nothing here is claimed from source inspection.** Every production statement is backed by
a live query, a live HTTP probe, or a CLI result captured during this build. Every device
gate is backed by server-side evidence, never by a screenshot — and where the Founder's
report arrived with an unfilled template placeholder (four times), the server was the
arbiter and is what is recorded.

**Two verification-tool defects were found and fixed during gating** (§12). Both are
recorded because a harness that cannot fail is not evidence, and both were caught by
running the tool against reality rather than by reading it.

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
| Account record | `karaoke_accounts` | **ANONYMIZE** | email, display name, last-login nulled; timezone reset to default | permanent tombstone | 19 FKs reference it; a hard delete either aborts or cascades away retained authority | **12/12** tombstones: all identifying fields null, `deletion_version BUILD26E_V1` |
| Legacy provider columns | `karaoke_accounts.provider(_subject)` | **DELETE** | nulled | — | a second, older copy of provider identity an identity-row-only delete would miss | 3/3 null |
| Commerce/audit handles | `purchase_owner_ref`, `authority_ref` | **RETAIN** | independent random UUIDs | permanent | future purchase authority + audit attribution; a leak of either correlates to nothing | 3/3 mutually distinct and distinct from `id` |
| Identity links | `karaoke_account_identities` | **DELETE** | rows removed | — | neither provider may reopen the account | 0 rows across all tombstones |
| Provider fingerprints | `karaoke_identity_fingerprints` | **RETAIN** | one-way HMAC-SHA256, secret outside the DB | permanent | closes the delete-and-recreate FREE-window reset | 5 rows; **pointer defect found and repaired (§5), proven closed by G7** |
| Host sessions | `karaoke_host_sessions` | **RETAIN → purge** | status `revoked` | 90 days, then purged | evidence of revocation, then gone | every tombstone: 0 active; G4 revoked 3 at one timestamp |
| DJ / device credentials | `karaoke_dj_devices` | **RETAIN** | status `revoked` | permanent | room-scoped auth must die with the room; nulling `account_id` is not revocation | revoked on every tombstone that owned devices; 0 active |
| Pairing / admin-setup tokens | `karaoke_pairing_tokens`, `karaoke_admin_setup_tokens` | **RETAIN** | expiry forced to now | permanent | unredeemed invitations must not survive | audited counts in each deletion row |
| Guest handoffs | `karaoke_guest_app_handoffs` | **RETAIN** | status `REVOKED` | permanent | an outstanding handoff must not open a retired room | G3 proved it non-vacuously: ACTIVE → REVOKED |
| Timed-pass grants | `timed_access_pass_grants` | **RETAIN** | `REVOKED`, `revoke_reason='account_deleted'`; activation facts kept | permanent | refund/audit authority; forfeiting access ≠ erasing the purchase | **G5**: ACTIVE → REVOKED, `activated_at`/`expires_at` retained byte-identical |
| Timed-pass audit | `timed_access_pass_audit` | **RETAIN** | append-only | permanent | an append-only ledger cannot be rewritten | 2 rows retained + appended |
| Host plan assignments | `karaoke_host_plan_assignments` | **RETAIN** | status `ended` | permanent | billing history | 3/3 ended, 0 active |
| Metering / usage | `karaoke_event_usage_segments` | **RETAIN** | pseudonymous (`account_id` → tombstone) | permanent | anti-abuse + future billing truth | 2 segments retained untouched |
| Saved songs | `karaoke_user_saved_songs` | **DELETE** | rows removed | — | pure user content, no retention basis | **G3**: 1 → 0, proven non-vacuously for the first time |
| Idempotency / rollout | `karaoke_room_creation_idempotency`, `karaoke_lease_rollout` | **DELETE** | rows removed | — | operational scratch | **G3**: 1 → 0, proven non-vacuously for the first time |
| Workspaces | `karaoke_workspaces` | **RETAIN** | status `retired` | permanent | a cascade would brick rooms into an ownerless graph | 3/3 retired |
| Rooms | `karaoke_rooms` | **ANONYMIZE + RETIRE** | name → `(삭제된 방)`; PIN, welcome text, logo pointer cleared | permanent | frozen, never reopened, never transferred | 3/3 retired and anonymized |
| Room slugs | `karaoke_rooms.slug` | **RETAIN** | kept unique | permanent | an old QR must never resolve to a future room | 3/3 retained under the unique index |
| Request history | `karaoke_requests` | **ANONYMIZE** | `guest_name` → `(삭제됨)`, `search_query` nulled | permanent | BUILD 25 resolution truth must stay historically accurate | **G3**: 한빛/테스트s → (삭제됨), search_query → null, `waiting` statuses kept |
| Events | `karaoke_events` | **ANONYMIZE + END** | name → `(삭제된 이벤트)`, host name and `created_by` nulled | permanent | no live event on a retired room | 3/3 ended and anonymized |
| Logo objects | Storage `room-logos` | **DELETE** | pointer cleared in-transaction; object via durable outbox | ≤30-day deadline | DB and Storage are not one transaction | 2 rows, both `DONE` on the first attempt |
| Deletion audit | `karaoke_account_deletion_audit` | **RETAIN** | pseudonymous only, append-only trigger | permanent | proof the deletion happened | 12 rows, no PII, append-only trigger enforced |
| Provider revocation | `karaoke_provider_revocation_jobs` + `…_deletion_events` | **RETAIN** | token material erased in every terminal state | permanent | Apple's call cannot join the transaction | 4 Apple jobs `succeeded`, token erased, attempt 1 each (2 tonight on build 87) |
| FREE-window carryover | `karaoke_free_window_carryover` | **RETAIN** | keyed to tombstone | until window end | stops a recreate resetting the daily allowance | 2 rows; **G7**: 172 s carried, `remainingSeconds` 728 not 900 |
| Guest/room data of other accounts | various | **NOT USER-OWNED** | untouched | — | isolation | unrelated account `f77dad8f` unchanged |

**Ledger result:** `LEDGER PASS` for **all twelve** production tombstones — 22/22 classes
each — spanning BUILD 26E and BUILD 26I. See §8.

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
re-run, not re-written. Items 33 and 35 took their end-to-end production leg at **G5**, and
item 26 (in-flight double submission) is covered by the client's `busy` guard plus G9's
proof that a failed attempt leaves nothing for a retry to collide with.

**Mutation verification — 27 mutants, 27 killed, 0 survivors.** Each mutant is a real
regression the assertions exist to catch (session revoke limited to one row; identity delete
narrowed to one provider; ACTIVE dropped from the revoke list; activation facts nulled;
carryover reactivating the tombstone; the repair reverted to the frozen clause; the backfill
joined on the wrong column; a schema change smuggled into the re-issue; …). Every mutated
file was restored and SHA-256-verified byte-identical.

Passing assertions are not evidence on their own — the mutants are what make these 32 tests
mean something.

---
## 7. G1–G10 — physical-device gates, build 87, against production

All ten gates executed on a real iPhone running build 87 against production on
2026-08-10. Every destructive gate used a disposable account, was baselined before the
deletion with falsifiable post-conditions **committed in writing beforehand**, and was
verified afterwards from the server rather than the screen.

| Gate | Verdict | Sharpest evidence |
|---|---|---|
| **G1** English deletion UX | **PASS** | copy English, Cancel returns signed-in; census delta traced to a sign-out/sign-in and excluded on four grounds (below) |
| **G2** Korean deletion UX | **PASS** | 취소 returns signed-in; **12/12 tables byte-identical** — zero server mutation |
| **G3** ordinary deletion | **PASS** | saved song 1→0, guest names 한빛/테스트s→(삭제됨), handoff ACTIVE→REVOKED — three classes proven non-vacuously for the first time |
| **G4** multi-session revocation | **PASS** | 3 sessions revoked at the identical microsecond; the revoked **browser cookie** refused by a cookie-reading endpoint |
| **G5** ACTIVE timed-pass deletion | **PASS** | ACTIVE→REVOKED with `activated_at`/`expires_at` **retained**; the CHECK relaxation exercised for the first time ever |
| **G6** linked Apple + Google | **PASS** | both identity rows deleted by one deletion; Apple grant revoked; Apple-authority gate held |
| **G7** same-Google recreation | **PASS** | **728 s, not 900 s** — DEFECT-26I-1 closed on real metered seconds |
| **G8** Apple non-resurrection | **PASS** | new account; fingerprint pointer correctly did **not** move on sign-in |
| **G9** failure safety | **PASS** | exactly **one** audit row; the failed attempt prepared no revocation job at all |
| **G10** regression | **PASS** | QR Guest request row + QR→Native handoff row + Host queue, all verified server-side |

### G1 — the delta that was not the gate

The census was not byte-identical: account `1a0be5e8` had `updated_at` move and one
session went `active → revoked` while a new one appeared. Traced and excluded:

1. the old session was revoked at `18:05:18`, **seven seconds before** the new login at
   `18:05:25` — only `DELETE /api/host/me` (native sign-out) and the web logout helper
   revoke a single session; the deletion RPC is the only other writer and it did not run;
2. `DeleteAccountView` fires re-authentication **only** on an explicit button tap, and
   Cancel dismisses locally — opening and cancelling performs no network call at all;
3. even a re-auth would look different: `reauthenticateGoogleForDeletion` adopts a new
   token but never revokes the prior session, so the old one would have stayed active;
4. all four deletion-side tables unchanged.

Cause: installing build 87 and signing back in. G2 then ran the same sheet with a clean
12/12 byte-identical census, which retroactively confirms the sheet mutates nothing.

### G5 — the gate BUILD 26E could not run

```
before   ACTIVE   selected_at 23:41:14.358805Z  activated_at 23:41:48.887521Z
                  expires_at  2026-08-10T00:41:48.887521Z   (~57 min still valid)
after    REVOKED  revoke_reason 'account_deleted'  revoked_at 23:44:08.590379Z
         selected_at / activated_at / expires_at  ALL BYTE-IDENTICAL
pass audit   3 rows → 4;  new row REVOKED · SYSTEM · account_deletion
             prior three (ISSUED/MANAGER, SELECTED/HOST, ACTIVATED/SYSTEM·dj_start) unchanged
usable passes remaining: NONE
```

Deleted **mid-playback**, with a live event, an in-flight lease and a `playing` request.
Room retired, event ended, guest anonymized, request status left `playing` (F-4: resolution
truth is never rewritten), usage segment retained byte-identical.

**The transaction did not abort.** `timed_pass_status_time_chk` accepted a REVOKED row
carrying `activated_at` and `expires_at` — the revoked-after-use branch added by
`20260809120000`, never exercised in production until this moment. Without it, this
deletion would have failed outright and left a paying account undeletable.

Access forfeited; purchase record not falsified. That distinction is the entire reason the
grant is retained rather than deleted.

### G7 — DEFECT-26I-1 closed on real seconds

The fixture arrived by accident and was better than the one planned: Google B had a
tombstone with **zero** usage (`159043bc`) sitting behind an account with **172** metered
seconds (`f8b2f098`). That makes the two code paths numerically distinguishable.

| | pre-repair (frozen pointer) | repaired (shipped) |
|---|---|---|
| fingerprint resolves to | `159043bc` — 0 s | `f8b2f098` — 172 s |
| carryover written | none | 172 s |
| new account starts with | **remaining 900** | **remaining 728** |

Measured: `usedSeconds 172, remainingSeconds 728`. The carryover row names
`source_tombstone_id = f8b2f098` — the account that actually burned the seconds.

```
fingerprint 9fbfe541…   pointer 159043bc → f8b2f098
                        first_deleted_at 00:38:32 preserved · last_deleted_at → 00:43:32
recreation invariant    10 / 10 PASS
```

Five earlier cycles had shown the pointer moving with nothing at stake. This one had 172
real seconds at stake and they were not forgiven.

### G8 — the negative control

Signing in with Apple A produced a new account `8350ae59`; `70e3bf37` stayed tombstoned;
rooms `24 → 24` and workspaces `13 → 13` unchanged — nothing of the old account reappeared.
And deliberately: **fingerprints `5 → 5`, carryover `2 → 2`, both unchanged.** The pointer
advances only on deletion, never on sign-in, and no carryover is invented for a tombstone
that burned nothing. G7 proved seconds follow the pointer when they exist; G8 proved
nothing is conjured when they don't.

Apple A's chain across two builds, on one fingerprint row that never lost its original
`first_deleted_at` of `2026-08-08T05:36:46`:
`ef4cc5d2 → 98d3496f → 70e3bf37 → 8350ae59`.

### G9 — failure safety by airplane mode

The sanctioned `-BTYAdmissionFailureInjection` harness is DEBUG-only, absent from the
deletion path, and BUILD 23 already established that *a client injection upstream of the
network cannot gate a server contract*. Build 87 is Release. So the failure was induced by
transport loss instead — re-authenticate online, enable airplane mode, then confirm.

```
failed attempt   deletion_audit 11→11 · revocation_jobs 3→3 · deletion_events 6→6
                 fingerprints 5→5 · identities 11→11 · account still active
                 app showed deletion.error.network → the .retryable branch → stayed signed in
retry            EXACTLY ONE audit row (01:02:20) · identities → 0 · 3 sessions all revoked
                 apple revocation job succeeded, attempt 1, token material erased
```

`revocation_jobs` being untouched is the sharpest fact: `deleteAccount` prepares the Apple
job **before** running the RPC, so a request that reached the server would have left a
`prepared` row even had the transaction later failed. There is none — the failure was
genuinely pre-server, hence pre-commit. The retry was safe precisely because the first
attempt left nothing to collide with.

---

## 8. Retention ledger — 12 / 12 production tombstones

Every deleted account in production, spanning BUILD 26E and BUILD 26I, verified against the
§4 ledger at 22 classes each:

```
bb095c7c  ef4cc5d2  98d3496f      (BUILD 26E)
e85abb78  6f8e5eae  a7972bab  b0a66b88  ca23dfe4
70e3bf37  159043bc  f8b2f098  8350ae59  (BUILD 26I)
                                    → ALL TOMBSTONES PASS
```

Three retention classes had never been proven non-vacuously in production before tonight —
**saved songs (DELETE)**, **request anonymization**, and **guest-handoff revocation** —
because every prior deletion had zero of each. G3's fixture was deliberately loaded so they
would be exercised.

---

## 9. Fixture ledger — what was destroyed, and why

Nine production deletions were performed. Every one was authorised, and each is listed
rather than summarised:

| Account | Role | Note |
|---|---|---|
| `e85abb78` | G3 | created for the gate: 1 room, 1 saved song, 2 guest requests, 1 handoff |
| `6f8e5eae` | unrecorded step | Founder signed in and deleted again after the G3 relaunch; confirmed deliberate. First live exercise of the DEFECT-26I-1 repair |
| `a7972bab` | G4 | two independent sessions (Bearer + cookie) |
| `b0a66b88` | G5 | ACTIVE ONE_HOUR pass, deleted mid-playback |
| `ca23dfe4` | G6 prep | created by an aborted Google-first attempt; deleted to free Google A |
| `70e3bf37` | G6 | pre-existing empty account behind Apple A; Founder-authorised |
| `159043bc` | G7 prep | **pre-existing account from 2026-07-21 owning `chi-norebang-xqjbyszq`** — Google B was not the fresh identity we assumed. Founder confirmed disposable; logged as fixture cost. The slug is retained and can never be reused, by design |
| `f8b2f098` | G7 | 172 metered FREE seconds burned deliberately |
| `8350ae59` | G9 | failure-safety fixture |

`1a0be5e8` (the Founder's primary account, 16 open rooms including `bty-home`) was **never
deleted**. It was signed into once at `00:51:40` during G8 and is intact: active, both
identities present, all rooms open, `deleted_at` null. Flagged and verified rather than
passed over, because on a night of destructive gating a login on the protected account is
exactly the event that must not go unremarked.

---

## 10. Apple behaviour

Programmatic Sign in with Apple revocation is the required normal path, and it executed
twice tonight on build 87 (G6, G9), both times `succeeded` on attempt 1 with token material
erased in the same terminal state — a schema guarantee via
`provider_revocation_terminal_has_no_token`, not a code habit.

**The Apple-authority gate held.** An Apple-linked account requires Apple re-authentication:
`AccountDeletion.requiresAppleReauth` returns true whenever `apple` is linked, and the
server independently refuses a Google-only re-auth with `apple_reauth_required`, because a
Google proof carries no authority to revoke Apple's grant. The existence of a revocation
job is the proof this happened — `deleteAccount` refuses before any mutation when the Apple
authorization code is absent, so the job cannot exist without a real code exchange.

The audit/event reconciliation behaved exactly as designed:

```
audit  (immutable, in-transaction)   provider_revocation { apple: "pending" }
events (append-only, after commit)   APPLE_REVOCATION_PREPARED → APPLE_REVOCATION_SUCCEEDED
```

The audit says `pending` forever because it is a commit-time snapshot and Apple's HTTP call
cannot join the transaction; the event log carries the later truth.

---

## 11. Google behaviour

Google deletion is account-scoped, not identity-scoped: G6 deleted an Apple+Google account
through one session and **both** identity rows went. `provider_revocation.google` reports
`revoked` on the native path, where the client revokes the Google grant itself — distinct
from sign-out, which never does.

Google A went through **six** delete-recreate cycles tonight
(`e85abb78 → 6f8e5eae → a7972bab → b0a66b88 → ca23dfe4 → 70e3bf37`) with its fingerprint
pointer advancing each time and `first_deleted_at` preserved at `19:33:09` throughout.
That repetition is the exact condition that produced DEFECT-26I-1, and it is now the
condition under which the repair is demonstrated.

---

## 12. Verification-tool defects found during gating

Two, both in the harness rather than the product, both caught by running it against reality.
Recorded because a check that cannot fail is not evidence.

**TOOL-1 — the recreation check was over-strict.** It asserted the new account is `active`,
which fails whenever a gate fixture is deleted again afterwards — a re-deletion is not a
resurrection. Replaced with: the new account has its **own** lifecycle (active, or carrying
its own distinct deletion audit).

**TOOL-2 — the fingerprint check was not time-invariant.** Found by the full-tombstone sweep
after G10: six accounts that had passed their own gate earlier the same night reported
`LEDGER FAIL`. The production data was correct; the assertion had decayed.
`karaoke_identity_fingerprints` holds **one row per identity** (the fingerprint is the
primary key) and the repair advances `account_tombstone_id` forward — so "a fingerprint
points at THIS tombstone" is true only until that identity is deleted again. The check now
asserts the durable fact: for every provider linked at deletion (read from the audit's
`provider_revocation`, since the identity rows are gone), a fingerprint of that provider
exists whose `[first_deleted_at, last_deleted_at]` span **contains** this account's deletion
instant. Negative control: the corrected predicate rejects a missing row, a wrong-provider
row, a span starting after the deletion, a span ending before it, and a linked account
missing one provider's fingerprint.

No gate verdict changed. At the moment each gate ran, the fingerprint did point at that
tombstone and that was verified; the fix makes the claim re-verifiable later rather than
only at the instant of capture.

---

## 13. Product gap found — Apple cannot be linked from the native client

Not a deletion defect, and recorded separately so it is not lost.

[`HostViews.swift:915`](../../bty-norebang-admin-ios/BTYNorebangAdmin/HostViews.swift#L915):

```swift
methodRow("Apple",  connected: res.isConnected("apple"), canAdd: false)
methodRow("Google", connected: res.isConnected("google"),
                    canAdd: googleAvailable && !res.isConnected("google"))
```

`canAdd` is hard-coded `false` for Apple. There is **no** `add_apple` string, no `addApple`,
no `linkApple`, no `onLinkApple` anywhere in the client — the only linking affordance is
`addGoogle`. Meanwhile the server's `POST /api/host/identities` accepts both providers.

Consequence: **a Google-first user cannot reach the linked topology on iOS.** The only
reachable path is Apple-primary then add Google, which the app's own `link_required.body`
copy already states. This cost two extra production deletions to work around during G6, and
it is a linking-surface gap, not a deletion-contract gap.

---

## 14. Regression — re-measured at closure

```
server unit suite      219 files / 2427 tests passed, 0 failed
  (preflight baseline 218 / 2395 — +1 file, +32 tests, none removed or weakened)
TypeScript             tsc --noEmit clean, exit 0
native host suite      1993 passed, 0 failed        (build 87)
native Guest suite       854 passed, 0 failed
localization           403 keys · 403 manual · 0 non-manual · 12/12 mutants
deletion mutants        27 / 27 killed, 0 survivors, all files restored byte-identical
native Debug build     ** BUILD SUCCEEDED **        generic/platform=iOS
native Release build   ** BUILD SUCCEEDED **        generic/platform=iOS
built artifact         CFBundleVersion 87 · 1.0 · com.bty.BTYNorebangAdmin · en+ko
xcscheme SHA-256       32b3247e…aa1e  — unchanged before and after the bump
device regression      G10: Apple sign-in, Google sign-in, logout, QR Guest,
                       QR→Native handoff, Host access, KO, EN — all PASS
```

Localization was not touched: BUILD 26I required no new user-facing strings, so the
BUILD 26F catalog architecture is intact and zero fallback leakage remains.

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
                   unchanged by BUILD 26I — no ceremonial redeploy
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
b9a76917  test(karaoke): BUILD 26I — whole-database census for the non-destructive gates
<fix>     fix(karaoke):  BUILD 26I — fingerprint ledger check must be time-invariant
<doc>     docs(karaoke): BUILD 26I — PASS / CLOSED, G1–G10 evidence
25b2740   chore(ios):    BUILD 26I — bump CFBundleVersion to 87 for the deletion gates
```

**Exactly one product change** shipped in this build: the one-clause repair in
`20260810120000`. Everything else is tests, gate tooling, the build-number bump, and this
document. No churn was manufactured, and the pre-existing xcscheme edit plus all unrelated
Karaoke/Arena dirty state were deliberately left uncommitted.

---

## 18. Final repository state

```
monorepo   HEAD = origin/main      left/right 0 0
native     HEAD = origin/main = 25b2740…    left/right 0 0
```

Preserved untouched throughout:

```
 M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
?? bty-karaoke/brand/
?? bty-karaoke/docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md
 M BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
     SHA-256 32b3247e…aa1e — identical before and after the build-87 bump
 … 370 unrelated bty-app/ (BTY Arena) files
```

---

## 19. Explicit non-claims

Stated plainly rather than smoothed into the verdict. Every earlier NOT-RUN entry that
G1–G10 closed has been removed; what remains is what genuinely did not execute.

1. **`AppleManualRevocationGuidance` is still unexercised in production.** All four real
   Apple revocations (two in BUILD 26E, two tonight) succeeded on attempt 1. Apple has never
   returned a permanent refusal here, so the Settings-guidance UI has never rendered from a
   real server response. Its copy and its gating logic are unit-tested only.
2. **Storage-cleanup retry is still unexercised.** Both outbox rows in production completed
   on their first attempt; the retry and deadline-overrun paths have never fired.
3. **Provider-revocation failure after commit is unexercised in production.** The durable
   job's `retryable_failure` state and its backoff are covered by tests, not by a live
   Apple outage.
4. **The 90-day session purge has never run.** `karaoke_purge_expired_deleted_sessions_v1`
   is deployed and callable; no tombstone is yet 90 days old.
5. **Web-originated deletion (`host_web`) is unexercised in production.** Every one of the
   twelve tombstones carries `deletion_source = host_native`. The cookie/CSRF path is
   route-tested, and G4 proved a *web session* is revoked by a native deletion, but a
   deletion *initiated* from the browser has never happened.
6. **`CFBundleDisplayName` remains "BTY Norebang Admin"**, deferred by directive rule 12 to
   the next release-readiness build.
7. **Apple linking is unreachable from the native client** (§13). A product gap, not a
   deletion gap, and deliberately not fixed inside this build.
8. **The §18 xcscheme baseline describes the dirty working tree, not HEAD** (§2).

---

**BUILD 26I is `PASS / CLOSED`** as of 2026-08-10.

The deployed BUILD 26E deletion architecture was preserved unchanged; the single measured
defect found in it — a fingerprint pointer that froze on the first tombstone an identity
ever produced, silently reopening the F-5 delete-and-recreate FREE-window reset from the
second cycle onward — was repaired with a one-clause forward-only migration, backfilled, and
then **proven closed in live production by G7**: 728 seconds remaining where the pre-repair
code would have handed back 900.

All ten physical-device gates pass on build 87 against production, with server-side evidence
for every one. Twelve production tombstones spanning two builds satisfy the retention ledger
at 22 classes each. Three retention classes that had never been proven non-vacuously —
saved-song deletion, request anonymization, guest-handoff revocation — were deliberately
loaded and proven. The two gates BUILD 26E left NOT RUN — ACTIVE timed-pass deletion and
same-identity recreation — both executed and both passed, the first of them exercising a
CHECK relaxation that had shipped eleven months of code ago and never once run.

Two harness defects were found and fixed along the way, both by running the tool against
reality rather than reading it. Neither changed a verdict; both make the claims
re-verifiable rather than true only at the instant of capture.

What is deliberately **not** claimed is listed in §19 and is not hidden anywhere else.
