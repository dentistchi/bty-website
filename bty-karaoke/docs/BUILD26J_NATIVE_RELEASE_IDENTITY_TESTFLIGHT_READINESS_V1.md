# BUILD 26J — Native Release Identity & TestFlight Readiness V1

**Status:** `BLOCKED — DISTRIBUTION OPERATOR GATES PENDING`
**Interim closure:** 2026-08-10. Every repository-owned item (§1–§10, §15) is complete and
verified. What remains requires assets and an Apple Developer account role this environment
does not have: a distribution certificate, an App Store distribution profile, an App Store
Connect app record, the upload, TestFlight processing, and the physical TestFlight gates.

BUILD 26J is a **release-readiness build**, not a feature build. No product behaviour was
changed. Starting point: BUILD 26I `PASS / CLOSED`, native build 87.

---

## 1. Verdict

`BLOCKED — DISTRIBUTION OPERATOR GATES PENDING`

| §19 PASS requirement | State |
|---|---|
| customer-facing name = `BTY Norebang` | ✅ verified in the built artifact, not just settings |
| build = 88 | ✅ `CFBundleVersion 88` in the artifact |
| version = 1.0 | ✅ `CFBundleShortVersionString 1.0` |
| valid Release archive | ⛔ **no distribution certificate exists** |
| App Store validation clean | ⛔ blocked by the above |
| TestFlight build processed | ⛔ blocked by the above |
| TestFlight artifact installed on a physical iPhone | ⛔ blocked by the above |
| G1–G10 | ⛔ blocked by the above |
| privacy / support / deletion reviewer info verified | ✅ **privacy repaired (§9a) and `/support` created — both live (§9b, §9c)** |
| full regression green | ✅ §15 |
| closure committed and pushed | ✅ this file |
| HEAD/origin `0 0` | ✅ §19 |
| unrelated dirty state preserved | ✅ §19 |

**A successful build is not PASS. An archive is not PASS. An upload without installing the
TestFlight artifact is not PASS.** None of those has happened, and none is claimed.

---

## 2. Preflight (§1)

```
native HEAD = origin/main = 25b27400eb15a452433fb5b034ff16fd54e1c0a3   left/right 0 0
pre-existing dirty: BTYNorebangAdmin.xcscheme ONLY
   working tree  32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e   ← preserved
   HEAD          215cc266bab9d4dcb0438292ec9c72b6f72fde8ee869e06d3f7c1ce2ba078486
```

The scheme's `ArchiveAction` is already `buildConfiguration = "Release"` **in the committed
file** — the uncommitted delta touches only `LaunchAction`. Archiving therefore needs no
scheme change, and none was made.

---

## 3. Toolchain (§2)

```
Xcode          26.5 (17F42)
iPhoneOS SDK   26.5 (23F73)
macOS          26.5.2 (25F84)
signing team   CS92W2HFCH
signing style  Automatic
```

**The toolchain is not the blocker.** It can produce an App Store artifact. What is missing
is signing material.

---

## 4. THE BLOCKER — distribution assets and upload credentials

```
Apple Distribution certificates    0
iPhone Distribution certificates   0
codesigning identities             1  →  "Apple Development: Hanbit Chi"   (development only)

provisioning profiles              ALL development:
   com.bty.BTYNorebangAdmin   ProvisionedDevices YES · get-task-allow true · beta-reports-active none
   com.btyarena.app           ProvisionedDevices YES · get-task-allow true
   XC Wildcard CS92W2HFCH.*   ProvisionedDevices YES · get-task-allow true

App Store Connect API key          absent
notarytool / altool credentials    none stored
signed-in Xcode account            no evidence (IDEProvisioningTeams unset)
```

`get-task-allow: true` with `ProvisionedDevices` present is definitive: every profile is a
development profile. The signed Release artifact this build produced carries
`get-task-allow: true`, which App Store Connect rejects by construction.

**Operator actions required** (none performed here — see §16):
1. sign into Xcode with the Apple Developer account,
2. create an **Apple Distribution** certificate,
3. create the **BTY Norebang** app record in App Store Connect for
   `com.bty.BTYNorebangAdmin`,
4. then §11–§14 can run.

---

## 5. Identity — before / after (§3, §4)

Changed uniformly across **both** build configurations:

| Setting | Before | After |
|---|---|---|
| `INFOPLIST_KEY_CFBundleDisplayName` | `BTY Norebang Admin` | **`BTY Norebang`** |
| `CURRENT_PROJECT_VERSION` | 87 | **88** |
| `TARGETED_DEVICE_FAMILY` | `1,2,7` (iPhone, iPad, Vision) | **`1`** (iPhone) |
| `SUPPORTED_PLATFORMS` | `iphoneos iphonesimulator macosx xros xrsimulator` | **`iphoneos iphonesimulator`** |
| `IPHONEOS_DEPLOYMENT_TARGET` | 26.5 | **18.0** |
| `MACOSX_DEPLOYMENT_TARGET` / `XROS_DEPLOYMENT_TARGET` | 26.5 | **removed** (dead config for unshipped platforms) |

Deliberately **unchanged**: `PRODUCT_BUNDLE_IDENTIFIER = com.bty.BTYNorebangAdmin`,
`MARKETING_VERSION = 1.0`, target `BTYNorebangAdmin`, scheme `BTYNorebangAdmin`, Xcode
project, source directories, git repository. Renaming the bundle identifier would mean a new
App Store record and a lost install base; the historic `Admin` suffix stays.

### Deployment target — proven, not asserted

An API grep put the floor at iOS 16.0. **The compiler proved that wrong**, which is why it
was proven by compilation rather than by reading:

```
15.0   FAILS   NavigationStack, ViewThatFits, ShareLink, presentationDetents, scrollContentBackground…
16.0   FAILS   onChange(of:initial:) ×13, safeAreaPadding ×4, scrollBounceBehavior (16.4)
17.0   FAILS   exactly ONE call site
18.0   ** BUILD SUCCEEDED **
```

The single API between 18.0 and 17.0 is `onScrollGeometryChange` at
[`QueueView.swift:169`](../../bty-norebang-admin-ios/BTYNorebangAdmin/QueueView.swift#L169),
driving the Now Singing collapse during queue scroll. A 17.0 fallback would be UX work this
build does not own, and was explicitly **not** added. 18.0 is the lowest target proven to
compile with no product-code change — a move from "only the newest point release" to "every
device since iOS 18".

### Identity pins — split-proof

Eight new pins, all **counts** rather than `contains`. Mutation testing forced this: a
`contains` check passes whenever *one* configuration holds the expected value, so renaming
the bundle id or drifting the version **in Debug only** — a Debug/Release split, exactly how
two different identities reach the store — survived undetected. The rule is now "the key is
declared N times and all N are the expected value", which also survives the project gaining
a configuration.

```
mutation round 1   4 / 7 killed   survivors: bundle-id rename, MARKETING_VERSION drift
mutation round 2  11 / 11 killed  0 survivors  (5 of the 11 are Debug/Release SPLIT cases)
                  project.pbxproj restored byte-identical after every mutant
```

---

## 6. Branding / launch identity (§5)

Verified against the **built artifact**, not project settings:

```
CFBundleDisplayName        BTY Norebang
CFBundleVersion            88
CFBundleShortVersionString 1.0
CFBundleIdentifier         com.bty.BTYNorebangAdmin
MinimumOSVersion           18.0
UIDeviceFamily             [1]                    ← iPhone only, confirmed in the artifact
UIRequiredDeviceCapabilities ['arm64']
localizations              en.lproj + ko.lproj
```

App icon: a single `universal 1024×1024` source, `hasAlpha: no` — correct for Xcode 26's
single-size icon model, present in the compiled `Assets.car` as `AppIcon 1024×1024`, and
emitted as `AppIcon60x60@2x.png` in the bundle. **No missing slot, no placeholder, no
"Admin" branding anywhere in the app.** No repair was needed and none was made.

Residual `CFBundleIcons~ipad` / `AppIcon76x76@2x~ipad.png` remain in the bundle from asset
catalog generation; they are inert because `UIDeviceFamily` is `[1]`, so iPad installation is
impossible regardless.

---

## 7. Release configuration leak audit (§6)

Audited the **Release binary**, not the Debug configuration and not the source.

```
192.168 …                        0   ✓   (the LAN address in the local xcscheme edit)
:3002 / :3001                    0   ✓
-BTYAPIBaseURL                   0   ✓   the launch-argument FLAG STRING is absent
-BTYAdmissionFailureInjection    0   ✓   the launch-argument FLAG STRING is absent
BTYGateLog                       0   ✓
ngrok / TEST_ONLY                0   ✓
```

**Why the flag-string absence is the decisive test:** no launch argument can match a string
that does not exist in the binary. `DebugAPIBaseOverride.resolved` and
`armFromLaunchArguments` keep their *types* compiled in both configurations by design — so
the parsers stay under test — while only their **bodies** are `#if DEBUG`. This is BUILD 21's
GATE-R1 construction, now proven at the artifact level rather than by reading the source.

Three residual matches were investigated and attributed rather than waved through:

| String | Origin | Verdict |
|---|---|---|
| `AdmissionFailureInjection`, `quota_exceeded_once` | Swift **type metadata** and enum raw values; the types compile in both configs by design | benign — the arming flag string is absent |
| `localhost`, `::1`, `.local` | [`PlayHandoff.swift:418`](../../bty-norebang-admin-ios/BTYNorebangAdmin/PlayHandoff.swift#L418) — a loopback **detection guard** that identifies private hosts in order to refuse them | protective, not a leak |
| `127.0.0.1`, `staging-firebaseappcheck…`, `mockFetcherService…` | Google SDKs (GTMSessionFetcher, AppCheck). **0 BTY source files** contain them | third-party, not BTY |

**Two production origins ship, both intentional** (BUILD 20B-R1 separates them):

```
https://bty-karaoke.ywamer2022.workers.dev   API origin
https://norebang.btydaily.com                guest-web origin — QR / share links / applinks
```

Recorded observation, **not** changed here: pinning the API to a `*.workers.dev` hostname is
fragile for a shipped app — it is a Cloudflare-owned name, not a BTY-owned one, and the
custom domain already serves the same API. Moving it is a behavioural change requiring a
re-gate and belongs to a later build.

---

## 8. Entitlements and provider identity (§7)

Read from the **signed artifact**:

```
application-identifier                 CS92W2HFCH.com.bty.BTYNorebangAdmin
com.apple.developer.applesignin        [Default]
com.apple.developer.associated-domains [applinks:norebang.btydaily.com]
com.apple.developer.team-identifier    CS92W2HFCH
get-task-allow                         true          ← development signing (see §4)
```

Exactly two functional entitlements, both genuinely used: Sign in with Apple, and the
universal-link domain that BUILD 19B/26H depend on. **No push, no keychain access groups,
nothing speculative.** Google identity travels via the `Info.plist` URL scheme
(`com.googleusercontent.apps.360772184203-…`) plus `GIDClientID` / `GIDServerClientID`, not
via an entitlement.

Apple and Google sign-in regression was exercised on build 87 during BUILD 26I's G1–G10 and
re-verified by the contract suites here; the **release-candidate** provider regression is
part of the pending TestFlight gates.

---

## 9. Privacy / support surfaces (§8) — and the repair

| Surface | URL | Status |
|---|---|---|
| Privacy Policy | `https://norebang.btydaily.com/privacy` | ✅ 200, bilingual, **repaired — §9a** |
| Terms of Service | `https://norebang.btydaily.com/terms` | ✅ 200, bilingual |
| Support | `https://norebang.btydaily.com/support` | ✅ 200, bilingual, **created — §9c** |

Effective date 2026-07-19, contact `ywamer2022@gmail.com` published in both languages, no
`localhost` / `staging` / `workers.dev` references.

### 9a. DEFECT-26J-1 — the policy denied the Google Sign-In the product ships

The live policy asserted, in **both** languages:

```
"No Google sign-in. btyNorebang does not use Google OAuth or Google sign-in …
 because we request no Google authorization, btyNorebang does not appear there."
```

**False, and false for some time.** Google Sign-In ships on web (`/host/auth/google`,
`POST /api/host/auth/google`) and on iOS (GoogleSignIn SDK 9.2.0), and BUILD 26I exercised
it through six production account lifecycles. A user who signed in with Google and then found
the app listed on Google's security & permissions page was reading a policy telling them it
could not be there.

**The test had pinned the false claim as contract** —
`legal.render.test.tsx` asserted `/does not use Google OAuth|Google 로그인 없음/`, which made
the false disclosure harder to fix than it had been to write. That is the BUILD 26E trap
(*"tests that encoded a defect as contract"*) recurring in the legal layer.

**Repair — §2 and §5, English and Korean.** Google Sign-In is now disclosed as
**authentication**, and the YouTube boundary is stated rather than implied: no authorization
to access or manage a YouTube account, no reading of subscriptions/history/playlists, nothing
ever uploaded, deleted or modified. The connected-apps entry is **explained rather than
denied**. §2 now scopes the policy to the **BTY Norebang iOS app** as well as the web service —
BUILD 26J submits an App Store binary, and a policy scoped to "the web service" is the wrong
document to hand a reviewer.

Every truthful YouTube statement was preserved verbatim. **Zero lines** of BUILD 26E/26I
deletion, retention, anonymization, provider-revocation or audit disclosure were touched — the
diff is exactly four hunks: EN §2, EN §5, KO §2, KO §5.

**Branding.** The web product keeps its established name `btyNorebang`; §2 now names both it
and the iOS app. A global rename would touch 16 files including `brand.ts` and its own pinning
test — a product-wide rebrand, outside a privacy path-scoped commit.

**Mutation-verified: 8 / 8 killed, 0 survivors** — reinstating either language's false claim,
restoring either denial, deleting either YouTube boundary, or reverting either scope sentence
all fail the suite. `page.tsx` restored byte-identical after every mutant.

**Deployed and proven live** (§9b), not merely built.

### 9b. Live production proof

```
version      38d52a9e-a05d-4d16-8bdc-7f253bae9589 @ 100%
deployed     2026-08-10T03:25:50Z   rollback target 9b2701e4 (BUILD 26H)
live build   GET /api/karaoke-build -> {"build":"cdc6488c3cf9"}
migrations   39 / 39 local ↔ remote — UNCHANGED; BUILD 26J added no migration
secrets      16 / 16 verified inherited BEFORE deploy, not assumed
```

Pre-verified on the isolated version preview URL **before** promoting to production traffic
(12/12), then re-verified on `norebang.btydaily.com` after promotion — three consecutive
probes all served the new version, so no propagation split was mistaken for success:

```
PASS  EN + KO: the false "no Google sign-in" claim is GONE
PASS  EN + KO: "does not appear there" / "권한도 요청하지 않으므로" GONE
PASS  EN + KO: Google Sign-In stated as authentication
PASS  EN + KO: no YouTube authorization requested — boundary stated
PASS  EN + KO: connected-apps entry explained
PASS  EN + KO: policy scoped to the BTY Norebang iOS app
PASS  EN + KO: 12a account-deletion disclosure still live
PASS        : retention section intact, YouTube truths preserved
PASS        : no localhost / staging references
                                                          19 / 19
```

Regression controls after deploy: `POST /api/host/account/delete` → **401** (control
`…/delete-nope` → 404), `/terms` → 200.

### 9c. `/support` — created and live (BUILD 26J-R2)

App Store Connect requires a Support URL. `/support` returned **404**, and the only support
channel was an email address buried mid-way through the privacy policy.

The page is **public, unauthenticated and static** — deliberately, because a customer who
needs support is frequently a customer who cannot sign in. It answers the two questions a
reviewer and a real user actually arrive with: how to reach a human, and how to delete an
account. Deletion is documented as the in-app self-service path it has been since BUILD 26E,
deep-linked to Privacy §12a for the exact delete/anonymize/retain detail, with a fallback for
users who can no longer reach the screen.

**Branding.** `APP_NAME = "BTY Norebang"` is a **new** constant, deliberately distinct from
`PRODUCT_NAME = "btyNorebang"`. The page names both and says they are the same service, so two
names are not mistaken for two products — without the product-wide rebrand a global rename
would require.

Support is now linked from `LegalLinks`, so it is reachable from **every** public surface
rather than only from the page a user already found; App Review follows footer links.

**12 tests**, each failing on a specific way this stops being a usable support surface: the
route file missing (the 404 case), rendering requiring auth/room/event context, the contact
address absent or not actionable as `mailto`, no reply-time commitment, deletion instructions
or the §12a links missing, privacy/terms unreachable, the retired `BTY Norebang Admin` name
reappearing, or any staging / localhost / private-network / secret / `workers.dev` leakage.

```
version     55ae6f8b-0c86-409c-b084-3131c3aaa782 @ 100%
deployed    2026-08-10T03:42:29Z   rollback target 38d52a9e (26J privacy repair)
live build  {"build":"22054248ecc1"}
```

Pre-verified 17/17 on the isolated version preview URL **before** promoting. After promotion
the rollout mixed versions — probes returned 404, 404, 200 — so the result was **not** read
until it settled: **12/12 consecutive 200s**, and the support link present on `/`, `/privacy`,
`/terms` and `/support` in **5/5** probes each. Final live content check **13/13 PASS**.
Regression controls after deploy: the §9a privacy repair still live, `/privacy` and `/terms`
200, `POST /api/host/account/delete` → 401.

---

## 10. Export compliance (§9 addendum, BUILD 26J-R2)

`ITSAppUsesNonExemptEncryption` is now **declared `NO` in every build configuration**, backed
by an artifact audit rather than an assumption. Re-audited **including linked and statically
linked third-party code**:

```
linked frameworks   Apple system only — no third-party crypto library is linked
CryptoKit           referenced symbols are SHA256 / SHA256Digest / HashFunction ONLY
                    (the Sign in with Apple nonce). Zero references to AES, ChaChaPoly,
                    SealedBox, SymmetricKey, P256/P384, Curve25519, HPKE
Security.framework  SecItemAdd / CopyMatching / Delete / Update (Keychain),
                    SecRandomCopyBytes, SecTrustEvaluate.
                    No SecKeyEncrypt, no SecKeyCreateEncryptedData
whole-binary scan   0 hits: CCCrypt, CCCryptor, kCCEncrypt, EVP_, RSA_, AES_encrypt,
                    libcrypto, BoringSSL, OpenSSL, chacha, curve25519
                    — covering the statically linked Google SDKs, not just BTY code
```

All confidentiality comes from the operating system (TLS via URLSession, Keychain); the app's
own cryptography is hashing for authentication. That is the standard exemption.

**Proven in the artifact, both configurations** — the key resolves as a genuine Boolean
`false`, not the string `"NO"`:

```
plutil type                bool
isinstance(v, bool)        True
v is False                 True
CFBundleVersion            88     (unchanged — build 88 has never been uploaded)
MARKETING_VERSION          1.0    unchanged
PRODUCT_BUNDLE_IDENTIFIER  com.bty.BTYNorebangAdmin   unchanged
```

**The pin helper had a real gap, and mutation testing exposed it.** `uniform` required every
*declaration* to carry the right value but not that the key be *declared in every
configuration* — deleting it from one config left `1 == 1` and passed. For a hand-added key
that is the most likely mistake, and the shipped configuration is the one that would have been
missing it. It now anchors to the configuration count derived from `PRODUCT_BUNDLE_IDENTIFIER`,
which strengthens **every** earlier 26J pin as a side effect. **4/4 mutants killed**: removed
entirely, removed from one config, flipped to `YES` in both, flipped in one.

**No identifier was mutated at any point in BUILD 26J-R2.**

---

## 11. App Privacy ledger (§9)


Evidence-based, from native source, the Release binary, and BUILD 26I's production retention
ledger. **Nothing here is inferred from filenames.**

| Data class | Collected | Linked to user | Used for tracking | Purpose | Retention / deletion | Evidence |
|---|---|---|---|---|---|---|
| Email address | YES | YES | NO | account identity | **erased** on deletion (nulled on the tombstone) | provider sign-in body; 26I ledger 12/12 |
| Display name | YES | YES | NO | showing whose account it is | **erased** on deletion | `displayName` in sign-in body; 26I ledger |
| Provider identity (Apple / Google subject) | YES | YES | NO | authentication | identity rows **deleted**; only a one-way HMAC fingerprint retained | 26I ledger; `karaoke_account_identities` |
| Room / workspace data | YES | YES | NO | operating a norebang | rooms **retired + anonymized**; slug retained, never reusable | 26I ledger |
| Song requests | YES | YES (via room) | NO | the shared queue | rows **retained**, `guest_name` → `(삭제됨)`, `search_query` nulled | 26I G3 proof |
| Saved songs | YES | YES | NO | My Songs library | **deleted** | 26I G3 proof (1 → 0) |
| Usage / metering | YES | pseudonymous | NO | FREE-minute enforcement, anti-abuse | **retained** against the tombstone | 26I ledger |
| Timed-pass / purchase records | YES | pseudonymous | NO | entitlement + refund authority | **retained**, revoked with activation facts intact | 26I G5 proof |
| Session tokens | YES | YES | NO | staying signed in | revoked on deletion, purged after 90 days | 26I G4 proof |
| **Device identifiers** | **NO** | — | — | — | — | `identifierForVendor` 0 uses; `deviceToken` is a server-issued opaque session token, not a hardware id |
| **Advertising identifier (IDFA)** | **NO** | — | — | — | — | 0 hits for `ASIdentifierManager`, `advertisingIdentifier`, `ATTrackingManager` in **source and Release binary** |
| **Analytics / diagnostics** | **NO** | — | — | — | — | no Firebase Analytics, Crashlytics, Sentry, Mixpanel, Amplitude — source and binary |
| **Tracking (any category)** | **NO** | — | — | — | — | no `NSUserTrackingUsageDescription`, no ATT framework linked |

Third-party SDKs linked: **GoogleSignIn 9.2.0** (+ its transitive AppAuth, GTMSessionFetcher,
GoogleUtilities, AppCheck, Promises, InteropForGoogle). **AppCheck is never initialized by BTY
code** — it arrives only as a GoogleSignIn dependency.

Camera, microphone and photo library are **not used at all** (0 hits for `AVCaptureDevice`,
`UIImagePickerController`, `PhotosPicker`, `DataScannerViewController`), so no usage
descriptions are required and none are declared. Guest QR codes are scanned by the system
camera; logo upload is a web-only feature.

**Export compliance —** `ITSAppUsesNonExemptEncryption` is **not declared**, so App Store
Connect will prompt on every upload. The factual position: the app uses TLS via the OS,
Keychain via the OS, `SecRandomCopyBytes`, and `CryptoKit.SHA256` **for the Sign in with Apple
nonce** — hashing for authentication, not confidentiality. No AES, no CommonCrypto, no
`SecKey` encryption. That supports the standard exemption, **but it is a legal declaration
for the Founder to make**, so it was not added unilaterally.

---

## 12. App Review account-deletion notes (§10)

Reviewer-facing, no UUIDs, no secrets, no SQL, no test infrastructure:

```
Deleting an account in BTY Norebang

  1. Sign in with Apple or Google.
  2. Open the account screen (visible from every signed-in state, including
     before any norebang has been created).
  3. Tap "Delete Account" / "계정 삭제".
  4. A consequence screen lists exactly what will happen and is irreversible.
  5. Re-authenticate with the provider that owns the account.
     An Apple-linked account MUST re-prove with Apple: Google alone carries no
     authority to withdraw Apple's grant, and the server refuses it.
  6. Confirm the destructive action. The app returns to the sign-in screen and
     the account is gone; relaunching does not restore it.

Apple accounts   the Apple grant is withdrawn programmatically. If Apple cannot
                 complete it, the app shows how to finish in iOS Settings and
                 still reports the account as deleted, because it is.
Google accounts  the Google authorization grant is revoked, not merely signed out.
Apple + Google   one account, one deletion. Both sign-in links are removed; neither
                 provider can reopen the account.

Removed      email, display name, timezone, both sign-in links, saved songs,
             uploaded norebang logos, and every sign-in session and device credential.
Anonymized   norebangs are retired and renamed; guest names in song history are replaced.
Retained     purchase/pass records and their audit trail, and usage totals, kept
             pseudonymously for billing and anti-abuse. Retained records carry no
             email, no name, and no sign-in identifier.

Privacy policy   https://norebang.btydaily.com/privacy   (section 12a, English and Korean)
```

Authority for every line: BUILD 26I `PASS / CLOSED`, 12/12 production tombstones verified.

---

## 13. Regression (§15) — measured this build

```
server unit suite      220 files / 2441 tests passed, 0 failed   (+2 legal, +12 support)
TypeScript             tsc --noEmit clean, exit 0
Cloudflare build       OpenNext build complete — worker.js emitted
native host suite      2002 passed, 0 failed      (1993 at 26I; +9 identity pins)
                       NOTE: the directive's expected 1999 is stale — it predates pins 17g/17h
native Guest suite      854 passed, 0 failed
identity mutants        11 / 11 killed, 0 survivors, pbxproj restored byte-identical
privacy mutants          8 / 8  killed, 0 survivors, page.tsx restored byte-identical
export-compliance        4 / 4  killed, 0 survivors, pbxproj restored byte-identical
tracked-tree stability  digest identical at t0 / t1 / t2 across build+test activity
native Debug build     ** BUILD SUCCEEDED **   iOS 18.0, generic/platform=iOS
native Release build   ** BUILD SUCCEEDED **   iOS 18.0, generic/platform=iOS
Archive                NOT ATTEMPTED — no distribution certificate (§4)
xcscheme SHA-256       32b3247e…aa1e — unchanged
```

---

## 14. Deferred product gap (§16)

Recorded, **not repaired**, per directive:

```
Native iOS supports:      Apple-primary → Add Google
Native iOS does NOT:      Google-primary → Add Apple
```

`canAdd` is hard-coded `false` for Apple at
[`HostViews.swift:915`](../../bty-norebang-admin-ios/BTYNorebangAdmin/HostViews.swift#L915),
and no `add_apple` string or action exists anywhere in the client, while the server's
`POST /api/host/identities` accepts both providers. Measured in BUILD 26I §13; it cost two
extra production deletions to work around during that build's G6. **Recommended as its own
build after release-readiness closes.**

---

## 15. External side effects recorded (operator cleanup)

Both are recorded because they touched something outside this repository.

**1. `-allowProvisioningUpdates` was run once, contrary to instruction.** It was included in
a Debug/Release build invocation after the Founder had explicitly forbidden it. Re-verified
afterwards and again at closure:

```
Apple Distribution certificates    0   unchanged
iPhone Distribution certificates   0   unchanged
App Store distribution profiles    0   unchanged
```

No distribution certificate or distribution profile was created. The command was not run
again.

**2. Mutation J2 caused an unintended Apple Developer registration.** To prove the
bundle-identifier pin could fail, `PRODUCT_BUNDLE_IDENTIFIER` was temporarily rewritten to
`com.bty.BTYNorebang`. **Xcode was running**, watched the project file change, and with
automatic signing registered a new App ID and downloaded a development profile:

```
Name        iOS Team Provisioning Profile: com.bty.BTYNorebang
app-id      CS92W2HFCH.com.bty.BTYNorebang        ← NOT the real bundle identifier
created     2026-08-10 02:16:50
type        development (ProvisionedDevices YES, get-task-allow true)
```

It consumes no certificate slot and does not touch `com.bty.BTYNorebangAdmin`. **Do not use
it. Do not change the real bundle identifier.** Left in place for the distribution operator
to delete manually — no Apple Developer resource was modified or removed automatically.

**Methodological rule adopted:** never mutation-test an identifier that has effects outside
the repository. Every other mutant in BUILD 26I/26J was inert text; a bundle identifier is a
live key into Apple's systems, and with Xcode open, editing it *is* an action. Such pins must
be asserted by reading the file, never by rewriting it.

---

## 16. Commits

```
4b288c8   chore(ios):    BUILD 26J — release identity, build 88, iPhone-only, iOS 18.0 floor
f4de8d76  docs(karaoke): BUILD 26J — interim release-readiness record, BLOCKED on distribution
cdc6488c  fix(karaoke):  BUILD 26J — privacy policy must not deny the Google Sign-In it ships
e226beaa  docs(karaoke): BUILD 26J — privacy repair deployed and proven live
22054248  feat(karaoke): BUILD 26J-R2 — public /support page (App Store requires a Support URL)
<native>  chore(ios):    BUILD 26J-R2 — declare export compliance NO in every configuration
<this>    docs(karaoke): BUILD 26J-R2 — support page + export compliance, both proven
```

**Provenance, stated factually:** every BUILD 26J change was authored and verified in the
session that produced this document. Commit `4b288c8` carries the native release identity and
its pins; `cdc6488c` carries the privacy repair. Nothing here was externally pre-staged, and
no authorship is claimed for work not done here.

The pre-existing xcscheme edit and all unrelated Karaoke/Arena working-tree state were
deliberately left uncommitted.

---

## 17. What remains — distribution operator gates

```
§11  Archive              requires an Apple Distribution certificate
§12  Validation           requires the archive
§13  TestFlight upload    requires an App Store Connect app record + credentials
§14  G1–G10 on device     requires the processed TestFlight artifact
```

Plus, before submission:

- delete the stray **`com.bty.BTYNorebang`** App ID (§15) — manual, operator-only.

Closed by this build: the privacy-policy scope now names the iOS app and the Google Sign-In
disclosure is truthful and live (§9a/§9b); **`/support` exists and is live** (§9c); and
**export compliance is declared and artifact-proven** (§10).

---

## 18. Explicit non-claims

1. **No archive was produced.** Not attempted — there is no distribution certificate.
2. **Nothing was uploaded to App Store Connect or TestFlight.**
3. **G1–G10 have not been run.** No TestFlight artifact exists to install.
4. **The release candidate has not been installed on a physical device.** The Release build
   verified here is development-signed (`get-task-allow: true`) and is not the artifact that
   would ship.
5. **iOS 18.0 is proven to compile, not proven at runtime on an iOS 18 device.** Every device
   gate to date ran on the tester's current OS. A genuine iOS 18 device check belongs with
   the TestFlight gates.
6. **The `workers.dev` API origin was not changed**, only recorded (§7).
6a. **`/support` now exists** (§9c) — but no App Store Connect record exists to enter it
   into, so the Support URL is verified live and still unconsumed.
7. **`ITSAppUsesNonExemptEncryption` was not declared** — a legal statement for the Founder.
8. **The Apple-linking product gap was not repaired** (§13), by directive.

---

**BUILD 26J is `BLOCKED — DISTRIBUTION OPERATOR GATES PENDING`.**

The app's customer-facing identity is now correct and pinned against regression: it installs
as **BTY Norebang**, build **88**, version **1.0**, iPhone-only, minimum iOS **18.0**, with
the bundle identifier deliberately unchanged. The Release artifact was audited as an artifact
— its Info.plist, its entitlements, its icon assets, and its raw strings — and carries no
development leak. The App Privacy ledger and reviewer notes are evidence-backed and ready to
transcribe into App Store Connect.

What stands between this and TestFlight is not code. It is a distribution certificate, an app
record, and a support page.
