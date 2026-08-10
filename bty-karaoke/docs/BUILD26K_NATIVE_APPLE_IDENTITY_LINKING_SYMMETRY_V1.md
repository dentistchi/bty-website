# BUILD 26K — Native Apple Identity Linking Symmetry V1

**Status:** `PASS / CLOSED`
**Closed:** 2026-08-10, when the native Apple-link path shipped in build 90, the Apple nonce
authority went live on production, and the physical build-90 evidence plus reconciled prior
physical evidence covered every material risk.

BUILD 26K closes the linking-surface gap that **BUILD 26I §13 formally recorded**: a
Google-first Host could not reach the linked topology on iOS. It also closes a replay window
in the Apple linking path that the gap had been hiding.

**This document does not claim that all ten originally-numbered physical gates were executed.**
Four physical gates ran on build 90; the rest were closed by evidence reconciliation against
prior physical proof on byte-identical code paths. The successful Google-primary → Apple link
was **not** physically repeated, and is recorded as an evidence substitution, not a gate pass.
See §14 and §16.

---

## 1. Verdict

```text
BUILD 26K — PASS / CLOSED

Server implementation   ddc21282770d19398a50c24e661304f6cbabe6e9
Native implementation   56447bfe32bb5c5b4c0833fa2958f5d512ce1203
Native UI repair        a472f6d86effbe26cd8919fbd0718bbfc66cecd7   (shipping native)

Production Worker       3b25b6f8-4e84-47dd-aef4-8416e343cd57 @ 100%
Live build              ddc21282770d
Native release          BTY Norebang · 1.0 (90) · com.bty.BTYNorebangAdmin

Migration               NONE
```

No account merge, transfer, unlink, or deletion behaviour was added. No production identity
was mutated by this build's verification beyond the disposable fixture's own cancelled and
refused attempts, both of which mutated nothing.

---

## 2. Scope

**Included:** native Google-primary → Add Apple; a provider-symmetric Login Methods surface;
end-to-end `rawNonce` transport for Apple linking; a fail-closed Apple nonce boundary on the
server; symmetric coverage of the provider-neutral linking authority.

**Excluded, deliberately:** account merging, identity transfer, provider unlinking, a
primary-provider concept, email matching, account-deletion redesign, IAP/commerce, App Store
metadata, TestFlight changes, iOS 17 fallback, QR handoff work, and any Arena/Foundry change.

---

## 3. Baselines

```text
Monorepo entry HEAD     cb15b74604961534bb4eda06d34751b75e6290d1   (BUILD 26J closure)
Native entry HEAD       459744a9b74f73f2ab4eb3df8cf6939fa9436fe6   (BUILD 26J-R2)
Native entry identity   1.0 (88) · com.bty.BTYNorebangAdmin · iOS 18.0 · iPhone-only

Server suite at entry   220 files / 2441 tests / 0 failed
Native Host at entry    2002 passed / 0 failed
Native Guest at entry   854 passed / 0 failed
```

Release-identity pins were measured as **counts, not substring presence** — BUILD 26J
established that a `contains` check cannot detect a Debug/Release split. Every pin was ×2 at
entry and remained ×2 throughout.

---

## 4. Architecture before BUILD 26K

```text
UI      LoginMethodsView
          Apple row  → methodRow("Apple", …, canAdd: false)      ← hard-disabled
          Google row → canAdd: googleAvailable && !connected
          add button → Button(action: addGoogle)                 ← the only add action

VM      AppSessionViewModel.linkGoogle()                         ← the only linking method

NET     APIClient.hostLinkIdentity(sessionToken:provider:idToken:)
          body = { provider, idToken }                           ← no rawNonce

SERVER  POST /api/host/identities
          authorizeHost → provider ∈ {apple, google}             ← ALREADY SYMMETRIC
          apple  → verifyAppleIdentityToken({ identityToken, rawNonce })
          google → verifyGoogleIdToken({ idToken, rawNonce })
          → linkIdentityToAccount(…)                             ← provider-NEUTRAL

DB      karaoke_account_identities
          unique (provider, provider_subject)                    ← identity cannot be moved
          unique (account_id, provider)
          same account  → already_linked
          other account → owned_by_other → 409 IDENTITY_TAKEN
```

The server was already capable of linking Apple. Only the client could not ask.

---

## 5. Root cause

### 5.1 The product gap was three defects, not one flag

1. `methodRow("Apple", connected:, canAdd: false)` — the visible symptom BUILD 26I recorded.
2. The row's add affordance was `Button(action: addGoogle)` **regardless of which provider it
   was rendering**. Flipping the flag alone would have shipped an "Add Google" button on the
   Apple row that linked Google.
3. No `linkApple` seam existed on the view model, and `HostAccountActions` had no Apple link
   callback. There was nothing for a corrected UI to call.

### 5.2 The security hole the gap was hiding

`verifyAppleIdentityToken` computes `expectedNonceHash = rawNonce ? sha256(rawNonce) : null`,
and `validateAppleClaims` enforces the token's `nonce` claim **only when that hash is
non-null**. The native client never sent `rawNonce`.

Consequently the first working Apple link would have verified on signature, audience and
expiry alone, with replay protection **silently disabled**. An Apple identity token captured
from any earlier authorization would have been attachable to whichever account the caller's
session held. This was latent only because the client could not reach the path at all.

---

## 6. Server implementation

One behavioural change, 21 added lines, in
`bty-karaoke/src/app/api/host/identities/route.ts`:

```ts
if (provider === 'apple' && (nonce === null || nonce.trim().length === 0)) {
  return NextResponse.json(
    { error: 'That sign-in could not be verified.' },
    { status: 401, headers: NO_STORE },
  );
}
```

Properties, each deliberate:

* **Fail-closed.** Rejects `null` / absent / empty / whitespace-only / non-string alike.
* **Placed before verification**, therefore far before `linkIdentityToAccount`. A nonce-less
  Apple token is never even evaluated, so no mutation boundary can be reached.
* **Indistinguishable from a verification failure.** Identical status and message, because
  which part of a link attempt was wrong is not something this endpoint narrates.
* **Google untouched.** Google still links with no nonce; the rule did not leak across
  providers, and a test asserts exactly that.

`bty-karaoke/src/lib/host-auth.server.ts` — which holds `linkIdentityToAccount` and
`resolveAccountForIdentity` — was **not modified by this build**. The ownership authority
shipping today is byte-identical to the one that predates BUILD 26K.

---

## 7. Native implementation

| File | Change |
|---|---|
| `HostModels.swift` | `LoginMethodAction`, `LoginMethodRow`, pure `loginMethodRows(identities:googleAvailable:)` |
| `AppSession.swift` | `Backend.hostLinkIdentity` gained `rawNonce: String?`; new `linkApple(_:)` |
| `APIClient.swift` | Forwards `rawNonce` when present; Google passes `nil` and the key is absent |
| `HostViews.swift` | Login Methods renders from the pure row model; real Apple control for `.addApple` |
| `RootView.swift` | `onLinkApple: { await session.linkApple(appleCoordinator.result(from: $0)) }` |
| `Localizable.xcstrings` | `login_methods.add_apple`, `login_methods.apple_taken` — en + ko |

### 7.1 Why the decision moved out of the view

`Tests/run.sh` is a bare-`swiftc` harness and **cannot compile a SwiftUI view**. Leaving
provider availability inside `HostViews.swift` is precisely why no test could catch the
original `canAdd: false`. The decision now lives in a harness-compiled file; the view renders
rows and decides nothing.

### 7.2 Why linking does not reuse the sign-in exchange

`linkApple` deliberately never touches `completeAppleSignIn` / `exchangeAppleCredential`.
Those mint a **new** Host session from the Apple identity — and for a Google-primary account
whose Apple identity is not yet attached, that would create a **second account** and silently
switch the user into it. That is the exact failure this build exists to prevent. `linkApple`
uses the existing session token as-is, never writes or clears it, and never assigns `state`.
Cancellation and authorization failure return **before any backend call**.

### 7.3 A real Apple control, not a proxy

`.addApple` renders a genuine `SignInWithAppleButton` whose `onRequest` runs the same
coordinator as sign-in — which is what makes the raw nonce sent later match the hash Apple
embedded in that exact token. Apple Tap Hotfix V1 already recorded what happens when this
project drives that control from an overlay: the authorization sheet never appears.

---

## 8. Apple `rawNonce` fail-closed security boundary

Three distinct layers of proof, never merged:

**A. Automated fail-closed negative proof — PASS.**
Six nonce shapes (absent, `null`, `""`, whitespace-only, tab/newline-only, non-string) each
produce `401`, with `verifyAppleIdentityToken` call count **0**, `linkIdentityToAccount` call
count **0**, and the identity table byte-identical. Mutation-tested: deleting the guard fails
exactly those six and nothing else.

**B. Physical positive production path — PASS.** See §13. Reaching `IDENTITY_TAKEN` on
production required the request to have already cleared the nonce guard *and* Apple's
cryptographic verification including the nonce claim.

**C. Crafted live missing-nonce probe — NOT RUN.** It was never executed and is not claimed.
No credential-safe mechanism to issue a crafted authenticated request existed, and improvising
one would have meant handling a live bearer token. Layers A and B cover the same risk.

Deployed-artifact ordering was additionally confirmed inside the minified Worker bundle before
promotion — the guard compiles ahead of both verification and linking:

```js
if(d2==="apple"&&(i2===null||i2.trim().length===0)) return …{status:401}…
let j2 = d2==="apple" ? await(0,x.lL)({identityToken:h2,rawNonce:i2 …
```

---

## 9. The build-89 physical UI defect and the build-90 repair

Physical G1 on **build 89** exposed a real regression: the genuine Sign in with Apple control
inflated into a large white slab filling most of the Login Methods sheet, with an oversized
Apple mark.

**Root cause.** `SignInWithAppleButton` fills whatever space it is proposed on **both** axes.
The shipped modifier set only a floor:

```swift
.frame(maxWidth: stacked ? .infinity : 220, minHeight: 44)   // floor, no ceiling
```

Nothing capped the height, so inside the sheet the control out-competed the trailing `Spacer()`
for free vertical space. The giant Apple mark was **the same defect**, not a second one — the
control scales its glyph to its height. The Google row was unaffected because a padded `Button`
sizes to its content rather than to the space offered.

**Repair** (layout only, `a472f6d8`):

```swift
.frame(maxWidth: stacked ? .infinity : 200)
.frame(height: 44)
```

Two frames on purpose: the first proposes the width, the second **pins** the height, so the row
card can no longer be stretched. 44pt is Apple's minimum tap target, so the hit area is not
reduced. The control remains the real `SignInWithAppleButton`.

Guarded by a source pin scoped to `LoginMethodsView`, so `HostSignInView` keeps its deliberately
tall full-width control. Mutation-tested: restoring `minHeight` fails both new assertions.

**This is why the final native identity is build 90, not build 89.**

---

## 10. Automated verification

```text
Server / web        221 files / 2461 tests / 0 failed      (entry 220 / 2441 — +1 file, +20 tests)
TypeScript          tsc --noEmit CLEAN, exit 0
OpenNext build      PASS

Native Host         2063 passed / 0 failed                 (entry 2002 — +61 assertions)
Native Guest        854 passed / 0 failed                  (unchanged)
Localization        405 keys · orphaned [] · unresolvable [] · en + ko complete

Debug build         PASS
Release build       PASS   (simulator and arm64 device)
Signed device build PASS
```

Nothing was weakened. Two assertions were **advanced** rather than relaxed: the build-number
pins moved 88 → 89 → 90, each retaining the negative clause that fails on a Debug/Release split.

### 10.1 Integrity assertions on the exact new path

Apple link attaches to the **same pre-existing account id** (compared against the id captured
before the link, never inferred from HTTP 200) · original Google identity survives · no second
account created · Host session token unchanged across success, already-linked, conflict,
cancelled and failed-auth · idempotent re-link writes nothing · a conflict fixture holding a
**real** Apple identity row on another account returns 409 and leaves the table byte-identical ·
cancellation and authorization failure make **zero** backend calls.

### 10.2 Mutants planted and killed

| Mutant | Killed by |
|---|---|
| Delete the nonce guard | the six nonce-shape tests |
| `linkApple` sends `provider: "google"` | `the link is sent as provider=apple` |
| `linkApple` drops the nonce | `the credential's EXACT raw nonce is forwarded` |
| Revert the Apple button to unbounded `minHeight` | both 26K-R1 layout pins |

---

## 11. Production deployment

Deployed from a **clean detached worktree** at the pushed commit, never from the primary
working tree, which carries several hundred unrelated Arena/Foundry edits. The build id is
`git rev-parse --short=12 HEAD`, so it proves the **commit**; the clean worktree is what proves
the **tree**. Dependencies came from `npm ci` against the committed lockfile.

```text
previous live      version 55ae6f8b-0c86-409c-b084-3131c3aaa782  (BUILD 26J-R2, build 22054248ecc1)
uploaded           version 3b25b6f8-4e84-47dd-aef4-8416e343cd57
pre-verified       preview URL served ddc21282770d before promotion
promoted           2026-08-10T13:40:49Z at 100%
rollback target    55ae6f8b
live               /api/karaoke-build → ddc21282770d
```

Secrets and bindings **unchanged** — 16 secrets present, none added, deleted, rotated or
renamed; `KARAOKE_SEARCH_KV` + `ASSETS` as before. `KARAOKE_APPLE_BUNDLE_ID` is unset and
correctly defaults to `com.bty.BTYNorebangAdmin`.

**Migration: NONE.** `karaoke_account_identities` already represents the symmetric link. An
Apple row on a Google-primary account is the same shape as the Google row on an Apple-primary
account that already shipped.

---

## 12. Physical-device evidence — build 90

Physical iPhone 17 Pro Max, build 90, against the production BUILD 26K Worker.

Fixture A — a real disposable production account, `5f6351f5…2c13`, initial provider **Google**,
0 rooms, FREE / ACTIVE / System default.

### G1 — PHYSICAL PASS
Sign-In Methods opened on a Google-primary account. Google = **Connected**; Apple
**disconnected** with a genuine Sign in with Apple control present, rendered at normal
single-button size. The build-89 slab and oversized mark are gone.

### G2 — PHYSICAL PASS
Tapping the Apple control presented the **genuine Apple system authorization UI** — not Google,
not a custom modal, and not the proxy/overlay failure mode Apple Tap Hotfix V1 recorded.

### G3 — PHYSICAL PASS
Cancelling returned to Sign-In Methods with Google still Connected, Apple still disconnected,
and the Host still signed in. **Server-authoritative check: `5f6351f5…2c13` provider remained
`Google`.** Cancellation produced zero production identity mutation.

---

## 13. Live production conflict evidence

Recorded separately from G1–G3 because it is a production ownership event, not a scripted gate.

A real Apple identity already owned by another account was presented through the BUILD 26K
Apple-link flow from the Google-only fixture.

```text
initiating account   5f6351f5…2c13   before: Google   after: Google
observed UI          "this Apple account is already linked to another BTY Norebang account"
                     (project-localized copy, login_methods.apple_taken)
foreign owner        1a0be5e8…9a8c   Apple + Google · 5 rooms · unchanged
```

Refused, with **no identity transfer, no merge, no duplicate account**, and the initiating Host
still signed in and usable.

**Why this proves far more than a refusal.** `login_methods.apple_taken` is reachable only via
`LinkResult.conflict` ← `APIError.http(409)` ← `outcome === 'owned_by_other'`. Reaching that
line required the request to have already passed, in order:

1. `authorizeHost` — a valid Host session;
2. `provider === 'apple'` with a token present;
3. **the fail-closed nonce guard** — so build 90 genuinely transmitted a non-empty `rawNonce`;
4. **`verifyAppleIdentityToken` returning ok** — valid Apple signature, audience
   `com.bty.BTYNorebangAdmin`, unexpired, **and a `nonce` claim equal to sha256 of the raw nonce
   the device sent**;
5. `linkIdentityToAccount` executing its ownership lookup.

A missing or mismatched nonce would have produced `401` → `.failed` → the *generic*
`login_methods.link_failed` copy instead. The conflict copy appeared. **The entire new BUILD 26K
chain — native control → credential mapping → nonce generation, hashing and round-trip →
transport → session auth → nonce guard → Apple cryptographic verification → ownership lookup —
is therefore physically proven end-to-end on production with build 90.**

Neither account was mutated. No email address or provider subject was recorded at any point.

---

## 14. Evidence reconciliation

**Not every originally-numbered physical gate was re-run, and this document does not pretend
otherwise.**

| Original gate | Final classification |
|---|---|
| G1 Google-primary Apple-add UI | **PHYSICAL PASS — build 90** |
| G2 Genuine Apple authorization control | **PHYSICAL PASS — build 90** |
| G3 Cancellation safety | **PHYSICAL PASS — build 90**, server-confirmed zero mutation |
| G4 Successful Google-primary → Apple link | **EVIDENCE SUBSTITUTION — not physically executed on build 90** (§16) |
| G5 Persistence across relaunch | **PRIOR PHYSICAL — unchanged path** (BUILD 26D G4) |
| G6 Foreign-Apple conflict | **PHYSICAL PASS in production**, using the actual existing foreign owner rather than a synthetic fixture |
| G7 Post-conflict session integrity | **PHYSICAL PASS — build 90** |
| G8 Apple-primary → Add Google | **PRIOR PHYSICAL + 26K automated regression; unchanged path** |
| G9 Google login continuity | **PRIOR PHYSICAL + 26K automated regression; byte-identical path** |
| G10 Apple login continuity | **PRIOR PHYSICAL + 26K automated regression; byte-identical path** |

### 14.1 Why the original fixture plan over-required work

Three concrete errors in the gate script, recorded so a future operator does not repeat them:

1. **Fixture C existed only because of G4's ordering.** A third disposable Google account was
   demanded solely because Fixture A would have gained Apple in G4 and could no longer initiate
   a conflict. G4 did not run, so A remained Google-only and served as the conflict initiator.
   C was an artifact of sequencing, never a requirement.
2. **Fixture B was already in the production data.** The conflict needed *any* Apple identity
   owned by another account. `1a0be5e8…9a8c` already was one, observable read-only.
3. **G8/G9/G10 would have re-tested code BUILD 26K did not touch** (§15.2).

---

## 15. Prior BUILD evidence reused

### 15.1 BUILD 26D — `docs/BUILD26D_NATIVE_IOS_GOOGLE_SIGNIN_VERIFICATION_V1.md`
`PASS / CLOSED` 2026-08-05, build 82, eight physical-device gates, each pairing Founder device
attestation with read-only server verification against a pre-captured baseline.

| Gate | Measured behaviour |
|---|---|
| **§4 G1** | Apple sign-in resolved to the existing dual-provider `account#1ce22dd82e` (providers `['apple','google']`); `last_used_at` advanced on the **same subject hash**; accounts/identities 7/7 unmoved |
| **§4 G3** | Google sign-in on that same account → **same `account_id`**, identity→session 79 ms, proven by ordering under a foreign key |
| **§4 G6** | google → apple → google legs all resolving to one account; the Apple row stayed **frozen** through the Google legs; counts 7/7/6 throughout. **Both switch directions proven** |
| **§4 G4** | Force-quit and relaunch **restored without re-login** — a single session's stamp climbed while **no new session row appeared** |

### 15.2 Why that evidence still holds

Each sign-in and re-auth function body was hashed across `459744a → a472f6d`:

```text
completeAppleSignIn              UNCHANGED   8f887c46cfbc
exchangeAppleCredential          UNCHANGED   d102e33e805b
signInWithGoogle                 UNCHANGED   c87850c36fcb
exchangeGoogleCredential         UNCHANGED   d9a2b4f224c0
reauthenticateAppleForDeletion   UNCHANGED   705fe8323c8f
reauthenticateGoogleForDeletion  UNCHANGED   c834452f9240
```

The only APIClient signature that changed is `hostLinkIdentity`. Server-side, the BUILD 26K
commit is three files and +350 additive lines, and `host-auth.server.ts` is untouched.

### 15.3 BUILD 26I — `docs/BUILD26I_ACCOUNT_DELETION_PRODUCTION_VERIFICATION_GAP_CLOSURE_V1.md`
`PASS / CLOSED` 2026-08-10, build 87, G1–G10 on a physical iPhone against production.

**§13 is titled "Product gap found — Apple cannot be linked from the native client"** and states
that the only reachable linked topology was Apple-primary then add Google, which "cost two extra
production deletions to work around during G6". Its **§9 fixture ledger** logs account
`ca23dfe4` as "created by an **aborted Google-first attempt**", and **§7** records the physical
G1–G10 run on build 87 whose G6 exercised a linked Apple + Google account.

That workaround **is** the physical evidence for Apple-primary → Add Google: a dual-provider
account was constructed on a device via the Add Google flow, because the Apple leg did not
exist. It is also the clearest statement of the gap BUILD 26K closes.

---

## 16. Successful-link evidence substitution

**The successful Google-primary → Apple link was not physically repeated on build 90.** It is
recorded here as an evidence substitution, not as a gate pass.

Everything up to and including the ownership decision is physically proven on production
(§13). The only branch not physically exercised is:

```text
ownership miss → INSERT an Apple identity row on the existing Google account
```

Coverage for that single branch:

* `linkIdentityToAccount` is **byte-identical** — BUILD 26K did not modify `host-auth.server.ts`.
* The same function physically inserted a `provider='google'` row on device during BUILD 26I.
* **Inserting an Apple row into `karaoke_account_identities` is the most-exercised write in the
  system** — `resolveAccountForIdentity` does exactly that on *every* first-time Apple sign-in,
  including BUILD 26I's six delete-recreate cycles.
* Real schema verified rather than assumed:
  `provider text not null check (provider in ('apple','google'))` explicitly permits `'apple'`,
  and `email text` is **nullable**, so an Apple authorization returning no email cannot violate
  a NOT NULL constraint — a failure mode the mocked tests could not have caught.
* BUILD 26K automated tests assert same-account id, Google survival, no second account, session
  preservation, and idempotency on this exact path.

The residual delta is that `account_id` references a pre-existing account instead of a freshly
created one — a plain uuid FK with no provider coupling. **No material BUILD 26K risk justified
obtaining another Apple ID or a borrowed device solely to repeat that INSERT.**

---

## 17. Regression proof

| Path | Changed in 26K? | Evidence |
|---|---|---|
| Apple sign-in | **No** — byte-identical | BUILD 26D G1/G6 physical + 26K automated |
| Google sign-in | **No** — byte-identical | BUILD 26D G3/G6 physical + 26K automated |
| Apple-primary → Add Google | **No** — `linkGoogle` unchanged; only the transport signature gained `rawNonce`, which Google passes as `nil` (asserted) | BUILD 26I G6 physical (build 87) + 26K automated: provider=google, nonce nil, fresh auth forced |
| Deletion re-auth (Apple and Google) | **No** — byte-identical | BUILD 26I physical + 26K automated |
| Guest surfaces | **No** | Guest harness 854 / 0, unchanged |

---

## 18. Localization

`login_methods.add_apple` and `login_methods.apple_taken` ship in **en and ko**, verified inside
the built Release binary rather than in source:

```text
en.lproj  "Add Apple"      · "This Apple account is already linked to another BTY Norebang account."
ko.lproj  "Apple 추가"      · "이 Apple 계정은 이미 다른 BTY Norebang 계정에 연결되어 있습니다."
```

Catalog: 405 keys, orphaned `[]`, unresolvable `[]`. The conflict copy names **Apple**, not
Google — reusing the Google string would have told a Host the wrong provider was taken, and an
assertion pins that. The conflict copy was additionally observed rendering correctly on device
in the device's language during the live production conflict (§13); both languages are proven
present in the shipped binary by the harness rather than by a second device pass.

One implementation note worth keeping: threading a localization **key** through a function
parameter made both conflict strings look orphaned to the catalog audit, because that audit
finds usages by scanning for literal `L10n.s("…")` call sites. The helper takes the resolved
string instead.

---

## 19. Release identity

Measured from the built **Release device artifact**, not only from source:

```text
CFBundleDisplayName            BTY Norebang
CFBundleVersion                90
CFBundleShortVersionString     1.0
CFBundleIdentifier             com.bty.BTYNorebangAdmin
MinimumOSVersion               18.0
UIDeviceFamily                 [1]
ITSAppUsesNonExemptEncryption  false
architecture                   arm64
```

Source pins, as counts across both configurations: `90` ×2 with `89` ×0, `1.0` ×2, bundle id ×2,
`18.0` ×2, `"1"` ×2, display name ×2. Confirmed on the installed device as
`BTY Norebang · com.bty.BTYNorebangAdmin · 1.0 · 90`.

Signing reused the existing Apple Development identity and team provisioning profile; **no
tracked project setting, entitlement, App ID, or scheme was changed to install it.**

---

## 20. Migration status

```text
migration: NONE
```

No schema change, no new migration file, no Supabase migration executed. The existing
`karaoke_account_identities` table represents the symmetric link unchanged.

---

## 21. Worktree safety

Every commit staged explicit paths only; `git add .`, `git add -A` and directory-wide staging
were never used.

```text
server commit    3 files   +350
native commit    8 files   +507 / −49
UI repair commit 3 files   +46  / −9
```

Preserved untouched throughout: the karaoke dirt (`docs/BUILD17_TIMED_ACCESS_PASS.md`,
`brand/`, `docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md`), all Arena/Foundry changes, and
the native scheme.

```text
BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
SHA-256  32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e   unchanged
```

An Arena-side deletion, `D "bty-app/tailwind.config 2.ts"`, appeared in the monorepo working
tree during this build from outside BUILD 26K. It was left exactly as found — not staged, not
restored, not investigated.

---

## 22. Deferred, non-blocking observations

**1. `linkIdentityToAccount` 23505 recovery is narrower than the indexes.** The recovery path
re-reads on `(provider, provider_subject)`, but the table also carries a unique index on
`(account_id, provider)`. An attempt to insert a *different* subject for a provider already
attached to the same account would trip the second index, and the re-read would find nothing,
producing a 500. It is **pre-existing** (the function is byte-identical), **provider-symmetric**
(identical for Google today), **fails closed with no mutation**, and is **unreachable from the
BUILD 26K Login Methods UI**, which hides Add once a provider is connected. Not repaired here.

**2. Provider unlinking remains unbuilt.** Login Methods offers no way to detach a provider.
Unchanged by this build and out of scope, as it has been since Cross-Platform Identity V1.

**3. The crafted live missing-nonce probe was never run** (§8C). Recorded as not run rather
than smoothed into the nonce result.

---

## 23. Final closure statement

```text
BUILD 26K — PASS / CLOSED
```

Native Google-primary → Apple identity linking is shipped in build 90. Apple linking nonce
validation fails closed on production, before verification and therefore before any mutation
boundary. Physical build-90 evidence covers the new Apple control, the genuine system
authorization, cancellation safety with server-confirmed zero mutation, and the live ownership
conflict path through production.

The successful insert branch was closed by **explicit evidence reconciliation** — exact
automated proof on the new path, an unchanged provider-neutral authority, prior physical proof
in the Google direction, and a verified schema — rather than being falsely recorded as a
physical gate.

No further Founder Apple-ID or device fixture action is required.

---

## 24. References

| Subject | Location |
|---|---|
| Apple nonce boundary | `bty-karaoke/src/app/api/host/identities/route.ts` |
| Provider-neutral linking authority | `bty-karaoke/src/lib/host-auth.server.ts` (unchanged in 26K) |
| Identity schema | `bty-karaoke/supabase/migrations/20260721120000_karaoke_account_identities.sql` |
| Route + authority tests | `route.test.ts`, `src/lib/host-auth.test.ts` |
| Pure row model | `BTYNorebangAdmin/HostModels.swift` |
| Apple link seam | `BTYNorebangAdmin/AppSession.swift` — `linkApple(_:)` |
| Login Methods surface | `BTYNorebangAdmin/HostViews.swift` |
| Prior Apple/Google login physical proof | `docs/BUILD26D_NATIVE_IOS_GOOGLE_SIGNIN_VERIFICATION_V1.md` §4 |
| The gap this build closes | `docs/BUILD26I_ACCOUNT_DELETION_PRODUCTION_VERIFICATION_GAP_CLOSURE_V1.md` §13 |
| Release identity baseline | `docs/BUILD26J_NATIVE_RELEASE_IDENTITY_TESTFLIGHT_READINESS_V1.md` |
