# BUILD 26D — NATIVE iOS GOOGLE SIGN-IN VERIFICATION V1

## 1. Verdict

**BUILD 26D — PASS / CLOSED — 2026-08-05**

All eight physical-device gates passed, each with **both** Founder-attested device evidence **and**
read-only server-authoritative verification against a pre-captured baseline.

```text
No runtime authentication defect was proven.
No production source change was required.
No native build-number increase was required — build 82 stands.
No migration. No deployment.
```

**The two defects this build actually found were in my own gate instructions, not in the product.**
Both are recorded in §6 and §7 in full, because a future gate operator who repeats them will waste
the Founder's time exactly as I did.

## 2. Scope

BUILD 26D verified that the **already-implemented, already-wired** Native Google Sign-In works on a
physical iPhone, resolves to the existing canonical Host account, coexists with Apple Sign-In, and
creates no duplicate logical account.

**Included:** Apple regression · Google cancellation · linked-Google resolution · console
restoration · logout persistence and reauthentication · provider isolation · Guest-handoff/Google
callback coexistence · BUILD 25 resolution spot regression.

**Excluded:** identity-linking UX, account merging, email matching, separate-account recovery,
unlinking, provider reassignment, migrations, Web changes, Android, Guest UI, BUILD 25 contract
changes. Deferred items are listed in §9.

The audit found the implementation already complete — `GoogleSignIn-iOS` SPM, `RealGoogleSignInAdapter`,
`GIDClientID`/`GIDServerClientID`, reversed-client-ID URL scheme, `hostSignInWithGoogle(idToken:)`,
`onOpenURL` routing — so this was a verification build, not a construction build. Nothing was rebuilt.

## 3. Baselines

### Inherited

```text
BUILD 25 — PASS / CLOSED
BUILD 26B — PASS / CLOSED
BUILD 26C — NOT REQUIRED (physical Android Chrome journey passed; no Android-specific
             architectural or platform defect was found)

Native HEAD/origin (entry)  56bb830e5a38cf575b498f5f02550d5bc6915a5a   build 82
Host tests 1700 · Guest tests 779 · Debug + Release SUCCEEDED
Web production runtime       67de80dac5c7ae48cd59360f09ff74ea0c1f4718
/api/karaoke-build           67de80dac5c7
Deployment                   82af291a-ee52-415a-af78-1ab1b6012021
Migration parity             37 local / 37 remote / no drift
```

### Automated baseline re-run at entry

```text
Native Host   1700 passed / 0 failed
Native Guest   779 passed / 0 failed
Xcode Debug    BUILD SUCCEEDED       CFBundleVersion 82
Xcode Release  BUILD SUCCEEDED       CFBundleVersion 82
```

Focused auth coverage already present: `[7c-2]` 27 · `[7c-4]` 21 · `[7d]` 35 · `[7e]` 25 ·
`[7f]` 16 · `[7g]` 38 · `[7h]` 25 · `[7i]` 40 assertions.

### One test gap identified and closed

The `onOpenURL` routing order — Guest handoff attempted before the Google callback fallback — had
**zero** automated assertions. Commit `ec05d9999582631e76098d1e974be0a3dc6bf407` (test-only) added
**25** assertions: the routing decision exercised behaviourally through
`GuestUniversalLink.extractToken` (real compiled code), plus the order pinned structurally against
comment-stripped scene source. **Three mutants killed** — order reversed (2 failures), guard bypassed
so both handlers run (1), browsing-activity route dropped (1) — with the source restored
byte-identical each time. Host tests 1700 → **1725**.

## 4. G1–G8 evidence

Every gate pairs Founder device attestation with a read-only server check against a baseline
captured *before* the gate ran. Identifiers are hashed throughout; no email, raw provider subject,
token, authorization code, cookie, or session credential appears anywhere in this record.

### G1 PASS — Existing Apple Sign-In Regression

```text
apple last_used_at   2026-07-25T17:14:57Z → 2026-08-05T16:08:09.974Z   (advanced)
apple subject        subj#7e0ac8d7f9 unchanged · created 2026-07-20T17:58:30Z
resolved account     account#1ce22dd82e
providers            ['apple','google']
accounts/identities  7 / 7 unchanged · newest account created_at unmoved
ownership            workspace#f7adeb9a67 · members ['1ce22dd82e']
```

The decisive fact was `last_used_at` moving from ten days earlier to that day on the *same* subject
hash — positive proof the login resolved to the existing canonical account rather than creating or
re-pointing anything. That is only meaningful because the baseline was captured beforehand.

### G2 PASS — Native Google Sign-In Cancellation and Retry

```text
gate google last_used_at   2026-08-02T16:25:46Z — UNMOVED
gate-account sessions in the G2 window   none
accounts / identities / google rows      7 / 7 / 6
ownership                                unchanged
```

`resolveAccountForIdentity` stamps `last_used_at` on every successful resolution, so an unmoved value
is positive proof no Google sign-in completed for the gate identity. Cancellation minted nothing.

**Session-evidence limitation, stated narrowly:** no exact pre-G2 session snapshot existed (the G1
baseline predated G1's own sign-in), so session-count equality was **not** claimed. Instead the
window was proven empty for the gate account.

**Observed and disclosed:** a Google sign-in *completed* at `16:12:19Z` to `acct#dde8b9ad78`
(a google-only account owning a different room). No BLOCKED condition was met — the gate identity was
untouched, nothing was created, and a cancelled attempt cannot mint a session because
`signInWithGoogle` returns at `.failure(.cancelled)` before `hostGoogleSignIn` is ever called.

**Do not re-evaluate the historical G2 baseline against later state.** G3 legitimately advanced the
gate Google `last_used_at`; re-running G2's timestamp invariant afterwards produces a false
`BLOCKED — CANCELLED GOOGLE SIGN-IN MUTATED AUTH STATE`. G2's invariants are a snapshot of the G2
window, not a standing assertion.

### G3 PASS — Linked Google Identity Resolution

```text
google identity used   2026-08-05T17:08:12.699Z   acct#1ce22dd82e  subj#c7424a3929
session created        2026-08-05T17:08:12.778Z   same account_id
identity → session     79 ms
ownership              workspace#f7adeb9a67 · members ['1ce22dd82e'] · unchanged
accounts/identities    7 / 7 / 6 · no new or conflicting identity
```

Resolution was proven by **ordering under a foreign key**, not by wall-clock matching: the identity
stamp and the session creation are 79 ms apart on the same `account_id`. Both timestamps carry
`+00:00`, so the timezone relationship is proven rather than assumed.

Two timing assertions written against the Founder's "approximately 10:09" were **withdrawn as
over-strict** — the events occurred at `10:08:12–10:08:22 PDT`, 48 seconds earlier, comfortably
within an approximation. The data was correct; the assertion was not.

### G4 PASS — Native Host Console Restoration

```text
room slug                  bty-home
user-visible display name  btyNorebang
active gate session        created 2026-08-05T20:47:02.699Z
same row last_used_at      advanced to 2026-08-05T20:48:11.917Z
re-validation window       69.2 seconds
sessions created during refresh / 10s background / force-quit / relaunch   NONE
```

**This is the restoration proof, and it is the count that matters — not presence.** `authorizeHost`
stamps `last_used_at` on every validated call, so a single row whose stamp climbs across the sequence
while **no new row appears** distinguishes genuine restoration from silent re-authentication. Had any
step re-authenticated, a new session row would exist. None does.

Console restored without re-login. Fixed-count expectations withdrawn — see §7.

### G5 PASS — Explicit Logout Persistence and Google Reauthentication

```text
G4 session          revoked 2026-08-05T20:50:54.423Z
its last_used_at    20:50:52.994Z — never advanced after revocation
new gate session    created 2026-08-05T20:51:03.775Z · ACTIVE
google last_used    advanced to 20:51:03.703Z
pre-existing revoked sessions   0 changed — logout revoked exactly one row
```

**The revocation proof is `last_used_at ≤ revoked_at`.** `authorizeHost` refuses any non-active
session and stamps `last_used_at` only on success, so a stamp that never moves past the revocation
instant proves **no authenticated request succeeded on that credential after logout**. Revocation is
real, not cosmetic.

All four previously-revoked gate sessions kept their original `revoked_at` values: the logout was
single-device and did not sweep the account, matching the Founder's report that other devices were
unaffected.

### G6 PASS — Provider Isolation

```text
leg 1  google 20:51:03.703Z → session 20:51:03.775Z → btyNorebang   (revoked 20:54:29.636Z)
leg 2  apple  20:54:34.597Z → session 20:54:34.669Z → btyNorebang   (revoked 21:00:19.033Z)
leg 3  google 21:00:27.766Z → session 21:00:27.830Z → btyNorebang   ACTIVE

both subjects and both created_at values unchanged
accounts / identities / google rows   7 / 7 / 6 throughout
```

**The isolation proof is the Apple row staying frozen at `20:54:34.597Z` through leg 3.** If the
providers were entangled — a shared subject, an email match, one identity re-pointed — the Google
sign-in would have touched the Apple row. It did not move at all. Each provider stamps only its own
identity, and both point at one account by `account_id` alone.

Both switch directions are proven (Google→Apple and Apple→Google) and neither created an account. No
provider was added or removed.

**Recorded honestly:** the first G6 run executed only legs 1–2; the third leg had not reached the
server (Google `last_used_at` unmoved, the active session was Apple's). G6 was **not** recorded as
passing until the Founder completed legs 6–8, at which point all nineteen checks passed.

### G7 PASS — Guest Handoff and Google Callback Coexistence

```text
G6 leg-3 Host session   stayed alive through the Guest handoff, last_used ran on to 21:06:43.665Z
logout                  21:06:47.547Z
google identity used    21:06:55.259Z → new ACTIVE session 21:06:55.327Z  (68 ms)
apple last_used_at      20:54:34.597Z — FROZEN throughout
accounts / identities   7 / 7 / 6 · ownership unchanged
```

**The coexistence proof is in what did not move.** The Guest invitation opened the Native Guest
surface while the Host session stayed alive, so the handoff neither consumed the Host credential nor
was mistaken for a Google callback. The subsequent Google sign-in stamped only the Google identity.
Neither URL path touched the other's state.

This is the live counterpart to the automated routing coverage in `ec05d999`; the contract is now
pinned both mechanically and on the device.

### G8 PASS — BUILD 25 Host Authority and Resolution Spot Regression (Path A)

```text
request        req#664da66c3b     room bty-home ("btyNorebang")
created        2026-08-05T21:08:56Z
started        2026-08-05T21:09:06.852Z
completed      2026-08-05T21:09:15.793Z
status         completed
resolution_code  NULL
resolved_at      NULL
dispositions     exactly one · completions in this room that day: 1
BUILD 25 code/timestamp pairing violations across the room: 0
```

**The core result is the NULL.** A Google-authenticated Native Host completed a Guest's song and the
server recorded `completed` with **no** `resolution_code` — exactly BUILD 25's contract that natural
completion is not an abnormal disposition and must never be given a reason. The Guest therefore saw
it under 방금 부른 노래 with **no** 신청 결과 card. Native Google authentication did not weaken
owner-only resolution authority: the Host acted on their own room's request, once, truthfully.

A single path is sufficient as a spot regression because BUILD 25 and BUILD 26B already closed the
full completed-versus-skipped matrix.

## 5. Server-authoritative final state

```text
karaoke_accounts rows            7
karaoke_account_identities rows  7
Google identity rows             6
conflicting (provider, subject)  none — all pairs distinct
new account created              none
newest account created_at        2026-07-31T13:45:30.597Z   (unmoved all build)

canonical account   account#1ce22dd82e
  apple  subj#7e0ac8d7f9   created 2026-07-20T17:58:30Z
  google subj#c7424a3929   created 2026-07-21T00:06:08Z
workspace           workspace#f7adeb9a67
active members      ['1ce22dd82e']
room                bty-home / "btyNorebang"

production build identity   67de80dac5c7
migration parity            37 / 37 · no drift · none added by this build
```

Both identities on one canonical account, each stamping only itself, with counts unmoved across
eight gates and roughly a dozen sign-ins. That is the identity model working as designed: keyed to
`account_id`, never to email.

## 6. G3/G4 instruction correction — slug versus display name

**This was a gate-script defect, not a product authentication defect.** It must not be softened.

```text
bty-home      the internal room SLUG — a URL identifier
btyNorebang   the user-visible room DISPLAY NAME
```

`HostViews.swift:700` renders `Text(room.displayName)`. A repo-wide search for the slug inside any
`Text(...)`/`Label(...)` returns nothing: **the slug is displayed nowhere in the Native Host UI.**
(The preview stub at `HostViews.swift:917` compounds the trap by using a third value,
`displayName: "BTY Home"`, which is neither the slug nor the production display name.)

The original G3 and G4 instructions told the Founder to *"confirm the room list shows `bty-home`"*
and to stop if it showed other slugs. **Those strings can never appear on screen.** The Founder
correctly concluded that no Google account showed `bty-home` and cycled through accounts for nothing
— five gate-account sign-ins and four other-account sign-ins were spent on an unfollowable
instruction. G3 passed only because the *server* verification was the real proof, not the on-screen
check.

**The corrected human-readable fixture, which resolved it immediately:**

```text
Google account   y********2@g****.com   (masked)
Room to look for btyNorebang
Account display  Hanbit Chi
```

Both `karaoke_accounts.email` and `karaoke_account_identities.email` store an address, so the
fixture was directly discoverable read-only. **No email was inferred from a provider subject.** The
other Google accounts were distinguishable by masked address and by the room name each displays
(`Newcastle`, `Chi Family Norebang`, `Joy`, or none), which is what made a safe, recognisable
identifier possible.

**Rule for future gate authors: instruct the operator using values the UI actually renders.** A gate
criterion the operator cannot observe is worse than no criterion — it produces false negatives and
burns trust.

## 7. Fixed-session-count specification correction

**Also a specification defect of mine, not a product defect.**

G4's baseline asserted the gate-account session rows would grow by **exactly 1** and the table total
by exactly 1. Both failed: the actual growth was +3 and +6.

The cause is that **my own corrected G4 procedure mandated retries** — *"자동 로그인되면 다시
로그아웃 후 '다른 계정 사용'… 잘못된 계정이면 로그아웃하고 2번으로"*. Every retry legitimately
mints and revokes a session. A count threshold that can hold only if no retry occurs was never a
valid specification, and it contradicted the very instruction it was meant to verify.

**Exact total-session and exact account-session count expectations are withdrawn for any gate that
permits account-picker retries.**

**The valid restoration discriminator is:**

```text
exactly ONE active session for the account, AND
that same row's last_used_at advancing well past its own created_at, AND
ZERO new sessions created during the restoration sequence
```

That triple distinguishes restoration from silent re-authentication without depending on how many
attempts the operator needed to select the right account. G4 satisfied it with a 69.2-second
re-validation window and zero new rows.

A related lesson worth carrying: two verification scripts initially reported `MISSING`/`FAIL` because
they compared `timestamptz` values for **exact float equality** against millisecond-truncated
baselines, while the stored values carry sub-millisecond precision (e.g. `20:47:02.699035+00:00`).
Prefer prefix matching, database ordering, and foreign-key scoping over reconstructed wall-clock
comparisons.

## 8. Why no runtime repair was required

The read-only implementation audit classified every traced path before any device work:

| Area | Classification |
|---|---|
| Sign-in entry (`RootView` → `signInWithGoogle` → adapter → `GIDSignIn` → `hostSignInWithGoogle`) | IMPLEMENTED AND COVERED — `[7e]`, 25 assertions via `FakeGoogleAdapter` |
| Cancellation (`GIDSignInError.canceled` → `.cancelled` → `signedOut(message: nil)`) | COVERED at the ViewModel; the real SDK error mapping was UNVERIFIED in-harness → confirmed by G2 |
| Callback routing (`onOpenURL`: handoff first, Google fallback guarded) | IMPLEMENTED BUT UNVERIFIED → **gap closed** by `ec05d999`, then confirmed live by G7 |
| Session restoration (Keychain → `hostMe` → account + rooms; stale/401 escape) | IMPLEMENTED AND COVERED — `[7g]` 38, `[7h]` 25 |
| Sign-out (`clearAllBTYAuthenticationState` with Keychain read-back verification) | IMPLEMENTED AND COVERED — `[7i]` 40 |

No defect was reproduced in any of them, and all eight device gates passed. Under the build's change
policy that means: **no production source change, and therefore no build-number increase.** Build 82
is the verified binary; the only commit is test-only, which changes no app code and needs no
reinstall or upload.

The one behaviour that might look like a defect is not one: a *different* Google identity resolving
to its own canonical account with its own room is precisely the provider isolation the model
promises, and G6 proves it deliberately.

## 9. Deferred to BUILD 26E — deliberately open, not fixed or approved here

```text
Google-only duplicate canonical accounts
identity-less orphan account   account#866dda8e34   (created 2026-07-30, never logged in)
stale never-revoked sessions on account#dde8b9ad78  (5 rows from Aug 1–3)
in-app account deletion
deletion-safe retention of pass and audit authority
future StoreKit purchase ownership
```

BUILD 26D **did not** repair, consolidate, relink, revoke, reassign, or approve any of these. They
were observed read-only as forensic context. `[7f] accidental-Google ownership-conflict recovery`
(16 assertions) shows the codebase already anticipates the duplicate-account shape and refuses to
re-point an identity — `linkIdentityToAccount` returns `owned_by_other` rather than stealing it — but
recovery, unlinking and consolidation remain unbuilt and belong to 26E.

## 10. Native identity, build, scheme hash, push state

```text
branch                main
HEAD = origin/main    ec05d9999582631e76098d1e974be0a3dc6bf407   ahead/behind 0/0
commit type           TEST-ONLY (Tests/QueueContractTests.swift, +113)
runtime source changed since ec05d999   0 files
CFBundleVersion       82 in Debug and Release (pbxproj:404, :451; read back from both built plists)
xcscheme SHA-256      32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
                      preserved byte-identically, modified-and-unstaged throughout
tests                 Host 1725 passed / 0 failed · Guest 779 passed / 0 failed
builds                Xcode Debug SUCCEEDED · Xcode Release SUCCEEDED
```

No reset, stash, discard, rebase, clean, or force-push in either repository. No `git add -A` /
`git add .` — every commit staged explicit paths with the staged set proven first.

## 11. Production identity and migration parity

```text
/api/karaoke-build   67de80dac5c7
runtime commit       67de80dac5c7ae48cd59360f09ff74ea0c1f4718   (BUILD 26B D-6a correction)
deployment version   82af291a-ee52-415a-af78-1ab1b6012021 @ 100%
migration parity     37 local / 37 remote · no drift · BUILD 26D added none
```

**BUILD 26D deployed nothing.** Production still serves the BUILD 26B runtime; the only commits in
this build are test-only and documentation-only, and neither is deployed. Migration parity was
re-verified at entry and at closure through the `supabase-karaoke` wrapper — bare `supabase` returns
the 403 documented in BUILD 25 §7.2, which is an invocation fault, not drift.

## 12. Status

```text
BUILD 26D — PASS / CLOSED                                          2026-08-05

G1  PASS   Existing Apple Sign-In regression         Founder + server
G2  PASS   Google cancellation and retry             Founder + server
G3  PASS   Linked Google → account#1ce22dd82e        Founder + server (79 ms identity→session)
G4  PASS   Native Host console restoration           Founder + server (69.2 s, zero new sessions)
G5  PASS   Logout persistence + reauthentication     Founder + server (revocation proven real)
G6  PASS   Provider isolation, three legs            Founder + server (Apple row frozen)
G7  PASS   Guest handoff / Google callback coexist   Founder + server (neither path touched the other)
G8  PASS   BUILD 25 resolution spot regression       Founder + server (completed + NULL reason)

Runtime defect        NOT PROVEN
Native build          82, UNCHANGED
Migration             none · parity 37/37
Deployment            none
Identity state        7 accounts / 7 identities / 6 google · no duplication · ownership intact
Gate-script defects   2, recorded in §6 and §7 — slug-vs-display-name, and fixed session counts
Deferred              BUILD 26E (§9)
```

**BUILD 25 and BUILD 26B remain PASS / CLOSED and untouched.** BUILD 25's resolution contract was
re-verified by G8.

## 13. References

| Item | Value |
|---|---|
| Native entry baseline | `56bb830e5a38cf575b498f5f02550d5bc6915a5a` (build 82) |
| Native test-only commit | `ec05d9999582631e76098d1e974be0a3dc6bf407` |
| Web production runtime | `67de80dac5c7ae48cd59360f09ff74ea0c1f4718` |
| Deployment version | `82af291a-ee52-415a-af78-1ab1b6012021` |
| Live build identity | `67de80dac5c7` |
| Canonical Host account | `account#1ce22dd82e` (apple `subj#7e0ac8d7f9` + google `subj#c7424a3929`) |
| Workspace | `workspace#f7adeb9a67` · members `['1ce22dd82e']` |
| Room | `bty-home` / display `btyNorebang` |
| G8 request | `req#664da66c3b` — `completed`, `resolution_code` NULL |
| Production project ref | `zycwaqignioawtqynopj` |

Related: [BUILD 25](./BUILD25_GUEST_VISIBLE_REQUEST_RESOLUTION_V1.md) ·
[BUILD 26B](./BUILD26B_BROWSER_HOST_ACCESS_RESPONSIVE_HARDENING_V1.md)
