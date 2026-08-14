# BUILD 26R-R0/R1 — Native StoreKit Capability Audit + Real Product Discovery

**Status: R0 `PASS` · R1 `PASS` — 2026-08-13. R2 NOT STARTED.**

BUILD 26Q-R1 closed with three real App Store Connect products and a native app that had never
imported StoreKit — `import StoreKit` 0 hits, `Product.products(for:)` 0 hits, product IDs
embedded natively 0 hits. This slice connects the two, and stops the moment it can prove the
connection is real.

```
App binary / StoreKit 2  →  Apple / App Store Connect  →  Product.products(for:)  →  3 products
```

Nothing beyond that. No purchase, no entitlement, no `Transaction.finish()`.

---

## 1. Verdict

```
BUILD 26R-R0 — PASS      G0.1 … G0.9
BUILD 26R-R1 — PASS      G1 … G13
BUILD 26R-R2 — NOT STARTED
```

## 2. Native baseline — MEASURED

```
repo          /Users/hanbit/Dev/bty-norebang-admin-ios   (private, dentistchi/bty-norebang-admin-ios)
branch        main
HEAD before   a131d600071927cdedce894cafd58ce0762fa5a2   = origin/main   (0 0)   BUILD 26N
HEAD after    cd4fa9f                                     = origin/main   (0 0)   pushed
project       BTYNorebangAdmin.xcodeproj                  (no .xcworkspace)
scheme        BTYNorebangAdmin                            (the only scheme)
target        BTYNorebangAdmin                            (the only target)
bundle id     com.bty.BTYNorebangAdmin                    resolved, both configurations
team          CS92W2HFCH   ·  CODE_SIGN_STYLE Automatic  ·  signed "Apple Development: Hanbit Chi"
version       MARKETING_VERSION 1.0  ·  CURRENT_PROJECT_VERSION 95 → 96
platform      iOS 18.0 floor · iPhone only · iphoneos + iphonesimulator
```

**Working tree preserved.** One unrelated dirty file existed before this slice and was never
staged, cleaned or absorbed: `BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme`
(a local Release/launch-argument rig). It is still dirty and still unstaged.

## 3. In-App Purchase capability — the finding that is easy to get wrong

The dispatch required distinguishing two statements that are NOT equivalent. Both were measured.

**Statement A — "no IAP-specific entitlement key exists" — TRUE.**

```
BTYNorebangAdmin.entitlements     com.apple.developer.applesignin · com.apple.developer.associated-domains
dev provisioning profile          application-identifier · applesignin · associated-domains
1520451f-…  Entitlements          team-identifier · get-task-allow · keychain-access-groups
```

**Statement B — "the target lacks In-App Purchase capability" — FALSE.**

Statement A cannot support Statement B, because **In-App Purchase carries no entitlement at all.**
Measured from Xcode's own cached developer-portal capability table
(`DVTPortal.framework/…/DVTPortalCachedPortalCapabilities.json`, 196 capabilities):

```
capabilities declaring an `entitlements` block   194 / 196
capabilities declaring NONE                        2   DATA_PROTECTION · IN_APP_PURCHASE

IN_APP_PURCHASE   entitlements: (absent)   enabledByDefault: true   editable: true
                  validTeamTypes: APPLE_DEVELOPER_PROGRAM …
APPLE_ID_AUTH     entitlements: profileKey com.apple.developer.applesignin
ASSOCIATED_DOMAINS entitlements: profileKey com.apple.developer.associated-domains
```

So grepping `.entitlements` for an IAP key can only ever return nothing, on every app that has
ever shipped an in-app purchase. Explicit App IDs get In-App Purchase by default and it contributes
no key to the entitlements file or the profile.

**Therefore no capability repair was made, and none was needed (G0.5).** Adding an invented
entitlement key would have been fabrication, not a fix.

The capability was then confirmed the only way that actually proves it — **the products came back**
(§6). A device with no IAP capability on its App ID cannot return App Store Connect products.

## 4. ASC application identity chain

```
native target  BTYNorebangAdmin
  → bundle id  com.bty.BTYNorebangAdmin        measured from resolved build settings
  → ASC app    BTY Norebang                     BUILD 26J Founder-attested; TestFlight build 88
  → IAP × 3    com.btydaily.norebang.pass.{1hour,4hour,24hour}   BUILD 26Q-R1 §6
```

The chain is no longer only attested. §6 closes it empirically: a binary signed for
`com.bty.BTYNorebangAdmin` asked App Store Connect for those three IDs and App Store Connect
returned all three, with the prices and names 26Q-R1 recorded. No ASC app was created, and the
bundle ID was not changed to chase the products.

Note `com.bty.BTYNorebang` also exists as a provisioning profile on this machine — the stray App ID
from BUILD 26J's mutation-test mistake. It is NOT the shipping identity and was not used.

## 5. Native product contract

**One source of truth:** [`BTYNorebangAdmin/PassStoreProducts.swift`](../../../bty-norebang-admin-ios/BTYNorebangAdmin/PassStoreProducts.swift)

```swift
nonisolated enum PassStoreProductID {
    static let oneHour         = "com.btydaily.norebang.pass.1hour"
    static let fourHours       = "com.btydaily.norebang.pass.4hour"
    static let twentyFourHours = "com.btydaily.norebang.pass.24hour"
    static let all: [String] = [oneHour, fourHours, twentyFourHours]   // 1h → 4h → 24h
}
```

No prior duplicate or conflicting constant existed anywhere in the native repo (0 hits before this
slice), so nothing was replaced. Test `26R-T3b` scans all 36 shipped Swift files and fails if the
literal `com.btydaily.norebang.pass.` ever appears outside this file.

**Identity only.** No price, no localized name, no duration, no entitlement rule — each already has
an owner:

| Authority | Owns |
|---|---|
| StoreKit / ASC | `displayName` · `displayPrice` · `price` · currency · `ProductType` |
| server `karaoke_product_catalog` | duration · `is_paid` · `is_active` · fulfilment |
| this file | which product IDs the app requests, and in what order |

**Byte-equality across three independent authorities** (26Q-R1 §8 compared two; this adds StoreKit):

```
                    len  md5
native source        32  92cefeb8f51e0f03bd1e85321cd2538e  …pass.1hour
production catalog   32  92cefeb8f51e0f03bd1e85321cd2538e  …pass.1hour
StoreKit (device)    32  92cefeb8f51e0f03bd1e85321cd2538e  …pass.1hour
native / prod / SK   32  f271cc892ddc9a36871383bb1d5e51b3  …pass.4hour   (all three identical)
native / prod / SK   33  5fe8fe27f72f7ece0f350c3b8ee89e2d  …pass.24hour  (all three identical)

NATIVE == PRODUCTION == STOREKIT : True
```

This matters because a verified Apple `productId` resolves *directly* against
`karaoke_product_catalog.storekit_product_id` with no mapping layer — one wrong character would
fail every genuine purchase with `unknown_product` (422).

## 6. Real product discovery — the R1 gate

Executed on a physical iPhone. Console captured verbatim via
`xcrun devicectl device process launch --console`:

```
[GATE-I3] external-open refusal mode=off
[GATE-B21] admission-failure-injection=off
[GATE-B23] api-base=production
[26R-R1] probe=armed
[26R-R1] state=loaded
[26R-R1] requestedCount=3 returnedCount=3 found=3 missing=0 unexpected=0 duplicates=0
[26R-R1] product id=com.btydaily.norebang.pass.1hour  type=Consumable displayName=BTY Norebang 1-Hour Pass  displayPrice=$1.99
[26R-R1] product id=com.btydaily.norebang.pass.4hour  type=Consumable displayName=BTY Norebang 4-Hour Pass  displayPrice=$4.99
[26R-R1] product id=com.btydaily.norebang.pass.24hour type=Consumable displayName=BTY Norebang 24-Hour Pass displayPrice=$9.99
[26R-R1] isComplete=true
```

| Requested ID | Returned | StoreKit ID | displayName | displayPrice | type |
|---|:--:|---|---|---|---|
| `com.btydaily.norebang.pass.1hour` | ✅ | `com.btydaily.norebang.pass.1hour` | BTY Norebang 1-Hour Pass | `$1.99` | Consumable |
| `com.btydaily.norebang.pass.4hour` | ✅ | `com.btydaily.norebang.pass.4hour` | BTY Norebang 4-Hour Pass | `$4.99` | Consumable |
| `com.btydaily.norebang.pass.24hour` | ✅ | `com.btydaily.norebang.pass.24hour` | BTY Norebang 24-Hour Pass | `$9.99` | Consumable |

```
requested   3
returned    3
missing     0
unexpected  0
duplicates  0
```

Every field above is **measured from the `Product` values**, not asserted against a constant. The
display names and prices happen to match BUILD 26Q-R1 §6 exactly, which is corroboration — it was
not a precondition, and no test hard-codes them.

## 7. Physical environment

```
device        Hanbit Chi's iPhone — iPhone 17 Pro Max (iPhone18,2)
              80C931D3-265B-5B37-B608-F3EB200C66AA, paired over CoreDevice tunnel
app           BTY Norebang · com.bty.BTYNorebangAdmin · 1.0 (96)
              installed over the previously present 1.0 (95)
install       xcrun devicectl device install app — DEVELOPMENT-SIGNED, NOT TestFlight
signing       Apple Development: Hanbit Chi (Z4X34T4VRN)
              profile "iOS Team Provisioning Profile: com.bty.BTYNorebangAdmin" (1520451f-…)
config        Debug (probe run) · Release (negative control, §9)
query start   2026-08-14T03:18:00Z    report emitted within ~10 s of launch
```

**No Sandbox Apple Account was created, and none was needed.** The dispatch anticipated this: a
Sandbox tester is a prerequisite for a *purchase*, not for a product lookup. StoreKit returned all
three products without one and reported no account error, so nothing was assumed either way —
the measured path simply never needed it. It remains a prerequisite for BUILD 26R-R2.

## 8. Why this is not a mock

Each of these was independently excluded, because §7 lists them as things that alone prove nothing:

```
.storekit configuration files in the repo       0   (test 26R-T11a walks the whole tree)
StoreKitConfiguration in the shared scheme      absent (test 26R-T11b)
Xcode StoreKit Testing                          not involved — launched via devicectl, not Xcode
simulator                                       not used — a simulator cannot reach real ASC
seeded / fabricated products                    none
server catalog activated to make it work        NO — is_active is still false on all three
```

The last one is the important one. `karaoke_product_catalog.is_active` and StoreKit
discoverability are **separate authorities**; all three rows remain `false` and discovery worked
anyway, which is exactly the independence BUILD 26L §5 describes.

## 9. Probe safety — proven in both directions

The probe follows the app's existing DEBUG launch-argument convention (BUILD 21 GATE-R1, BUILD 23
GATE-R3). Its single call site is inside `#if DEBUG` in the app entry point.

```
Debug   + flag        → probe=armed, full discovery report          (§6)
Debug   without flag  → probe=off, no query, no product line        negative control
Release + flag        → NOTHING PRINTED AT ALL — the whole #if DEBUG block is compiled out
```

The Release run is a **runtime** proof, not a source scan: a Release binary was built, installed on
the same device, and launched with `-BTYPassStoreDiscoveryProbe`. It emitted no `[26R-R1]` line, and
none of the other gate diagnostics either. A Release build cannot activate this probe.

The device was left with the Debug 1.0 (96) build installed, so the gate is re-runnable.

## 10. Safety proof

```
Product.purchase() calls                     0
appAccountToken bindings                     0
VerificationResult<Transaction> handling     0
JWS extraction / submission                  0
/api/host/purchases/apple/verify calls       0
paid grants created                          0
Transaction.finish() calls introduced        0
production commerce mutations                0
ASC mutations                                0
migrations                                   0   (parity stays 20260815120000)
deployments                                  0
```

Test `26R-T9b` fails if any acquisition symbol appears in the two new files; `26R-T9c` scans **all
36 shipped sources** for `Transaction.finish` / `transaction.finish` and requires zero. No existing
code path finished a StoreKit transaction before this slice, and none does now.

Full-line comments are stripped before that scan, matching the BUILD 26E helper — both new files
DOCUMENT the boundary in prose, and the prose necessarily names the symbols it forbids. A scan that
fired on a comment would be reporting its own documentation. Only whole-line comments go, so a line
of real code with a trailing comment is still scanned.

## 11. Production commerce census — READ ONLY

Re-read with unauthenticated service-role `GET`s only. No RPC, no write, no authenticated smoke, so
no session `last_used_at` was touched.

| | 26Q-R1 | now |
|---|--:|--:|
| Apple purchases | 0 | **0** |
| Paid grants | 0 | **0** |
| All grants | 55 | **55** |
| Catalog rows | 3 | **3** |
| Catalog `is_active=true` | 0 | **0** |
| Audit rows | 155 | **155** |

Catalog contract unchanged: `PASS_1H` 3600 / `PASS_4H` 14400 / `PASS_24H` 86400, all
`PAID_CONSUMABLE`, `is_paid=true`, `is_active=false`, `BUILD_18C_V1`.

## 12. Files changed

| File | Why |
|---|---|
| `BTYNorebangAdmin/PassStoreProducts.swift` | **new** — the one native product contract; pure, no StoreKit import, so the reconciliation logic is testable without mocking a store |
| `BTYNorebangAdmin/PassStoreDiscovery.swift` | **new** — `Product.products(for:)` + the DEBUG launch-argument probe |
| `BTYNorebangAdmin/BTYNorebangAdminApp.swift` | +5 lines: the single `#if DEBUG` probe call site |
| `BTYNorebangAdmin.xcodeproj/project.pbxproj` | register the two new sources; `CURRENT_PROJECT_VERSION` 95 → 96 in both configurations |
| `Tests/QueueContractTests.swift` | +47 checks (§13); three build-number pins 95 → 96 |
| `Tests/run.sh` | compile the two new sources into the suite |

Deliberately NOT changed: `BTYNorebangAdmin.entitlements` (§3), the shared scheme, and every file
whose tests forbid StoreKit symbols — `UsageBannerView`, `UsageProjection`, `ProPilotRequest`,
`APIClient`, `QueueViewModel`, `HostViews`, `TimedPass`, `TimedPassCardView`. Those bans are
intact and were routed around, never weakened.

## 13. Tests / build

```
bash Tests/run.sh                          2212 passed, 0 failed   (2165 baseline + 47 new)
xcodebuild -configuration Debug   -destination id=80C931D3-…   ** BUILD SUCCEEDED **
xcodebuild -configuration Release -destination id=80C931D3-…   ** BUILD SUCCEEDED **
```

No test was weakened. Three pre-existing pins moved 95 → 96 because the binary genuinely changed;
the count-based one (`26R-N`, `== 2` occurrences and `== 0` of the old value) is the BUILD 26J
"counts, never `contains`" rule, and it is what caught the third pin the other two missed.

The 47 new checks pin what a mock cannot: the sealed identities, single-source-of-truth, and — the
part most likely to be smoothed over later — that **every** partial StoreKit answer stays partial.
`3 requested / 0, 1, 2 returned`, an unexpected ID, and a duplicated ID each have their own
assertion, so none of them can ever render as success.

## 14. Commit

```
native  cd4fa9f  feat(karaoke-ios): BUILD 26R-R0/R1 — real StoreKit product discovery, build 96
        pushed; HEAD == origin/main (0 0)
```

No migration. No deployment. Worker and web unchanged.

## 15. Deferred / unchanged

- Sandbox Apple Account provisioning — required for R2's purchase, not for this lookup
- server catalog activation (`is_active = true`) — still deliberately false
- the BUILD 26P **genuine Apple transaction** proof — still deferred, now one slice away
- `Transaction.finish()` fulfilment authority, and the atomic paid-entitlement contract + migration
- first-IAP App Review submission bundled with a new app version (26Q-R1 §12)
- App Store Server Notifications V2, refunds, reconciliation
- BUILD 26O REVOKED audit actor provenance · BUILD 18C G4/G6/G7 · legacy RPC wrapper removal

## 16. Next gate

```
BUILD 26R-R2 — NOT STARTED

Next authorized work, only after founder review:
real Sandbox purchase acquisition
→ appAccountToken binding
→ verified StoreKit transaction/JWS
→ BUILD 26P server VERIFY + RECORD
→ expected VERIFIED / NOT_GRANTED
→ still NO Transaction.finish()
```

## 17. What this build should be remembered for

- **An absent entitlement key was the answer, not the gap.** The obvious move — grep
  `.entitlements`, find nothing, "add the IAP capability" — would have produced a fabricated key
  for a capability that has none. 194 of 196 capabilities declare an entitlement; In-App Purchase
  is one of the two that do not, and it is on by default. The measurement that settled it took one
  JSON read, and the honest finding was *no change required*.
- **The only proof of a store is the store.** Compilation, unit tests, project inspection and a
  `.storekit` file can all be green while discovery is broken. What closed R1 was a signed binary
  on a real iPhone getting three real products back — which simultaneously closed the ASC identity
  chain that had been attested but never exercised.
- **A partial answer must be structurally unable to look complete.** `isComplete` is derived from
  missing/unexpected/duplicate counts and cannot be set; the console report prints the counts
  before the products. `3 requested / 2 returned` was the failure this build was most likely to
  ship quietly, so it was made loud in six separate tests.
- **Prove the off switch too.** The probe was run three ways — armed, unarmed, and Release — and
  the Release run's silence is what turns "it's inside `#if DEBUG`" from a claim into a fact.
