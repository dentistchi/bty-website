# BUILD 26T-R1B-R3 — Cloud Distribution Signing + App Store Validation

**Status: PASS / CLOSED — 2026-08-14. Classification `A. CLOUD_SIGNING_VALIDATED`.**

**No build uploaded. No app submitted. No IAP submitted. No ASC metadata changed. `PASS_1H` inactive.**

Build 100 was distribution-signed with **`Apple Distribution: Hanbit Chi (CS92W2HFCH)`** and passed
Apple's server-side pre-delivery verification — on a Mac whose keychain holds **no Apple
Distribution private key at all**. That is the finding: cloud-managed distribution signing works
for this account and this machine.

```
VERIFY SUCCEEDED with no errors                  ← App Store Connect, server-side
Organizer: "Your app successfully passed all validation checks."
processingState / buildProcessingState  = null   ← nothing entered build processing
local Apple Distribution identities      = 0     ← before AND after
```

---

## 1. Verdict

```
BUILD 26T-R1B-R3                     PASS / CLOSED     A. CLOUD_SIGNING_VALIDATED
archive creation                     PROVEN            valid App Archive, 1.0 (100)
Organizer authentication             PROVEN            GUI path authenticated
Organizer / App Store validation     PROVEN            VERIFY SUCCEEDED with no errors
cloud-managed distribution path      PROVEN            Apple Distribution signing, 0 local private keys
build upload                         NOT PERFORMED
app submission                       NOT PERFORMED
IAP submission                       NOT PERFORMED
ASC metadata / IAP readiness         NOT FULLY MEASURED (§7)
PASS_1H                              INACTIVE
```

## 2. Pre-archive state — verified, nothing adjusted to pass

```
native HEAD == origin/main   e7724c6   0 ahead / 0 behind      staged 0
working tree                 only the pre-existing .xcscheme Founder edit
Localizable.xcstrings        byte-identical to HEAD
PrivacyInfo.xcprivacy        committed at HEAD · 4 pbxproj references
1.0 (100) · com.bty.BTYNorebangAdmin · Release · iOS 18.0 · iPhone-only
production catalog           catalogActive 0 · PASS_1H is_active=false
                             Apple purchases 1 · paid grants 1
```

## 3. Archive — valid App Archive

```
/tmp/r1b-r3/BTYNorebangAdmin.xcarchive        Fri Aug 14 20:01:02 PST 2026
scheme BTYNorebangAdmin · configuration Release · arm64
ApplicationProperties PRESENT  → App Archive, NOT a Generic Xcode Archive
  SigningIdentity  Apple Development: Hanbit Chi (Z4X34T4VRN)     ← pre-distribution, expected
  Team CS92W2HFCH · CFBundleIdentifier com.bty.BTYNorebangAdmin · 1.0 (100)
embedded profile  iOS Team Provisioning Profile (get-task-allow=true)
entitlements      applesignin ✓ · associated-domains applinks:norebang.btydaily.com ✓
PrivacyInfo.xcprivacy  present
```

## 4. Two distribution attempts, and why they differ

### 4.1 CLI attempt — FAILED. A local credential-path failure, NOT an Apple denial.

`xcodebuild -exportArchive` with `signingStyle=automatic`, `method=app-store-connect`,
`destination=export`, `-allowProvisioningUpdates`:

```
DVTDeveloperAccountManager: Failed to load credentials for 4FD32952-…
  "Invalid credentials in keychain … missing Xcode-Username"
IDEProvisioningErrorDomain Code=23  "No Accounts"
Provisioning profile "iOS Team Store Provisioning Profile" failed qualification checks
IDECodesignResolverErrorDomain Code=1  "No signing certificate 'iOS Distribution' found"
  "…matching team ID 'CS92W2HFCH' WITH A PRIVATE KEY was found."
IDEDistributionSigningAssetsStep: "Locating signing assets failed."   ** EXPORT FAILED **
```

**Xcode never authenticated, so cloud signing was never attempted.** The non-interactive path
cannot prompt for sign-in; it fails at the account step and reports the downstream symptom
("no certificate with a private key") as though it were the cause. It is not evidence of an
account, team, permission or agreement problem — §4.2 disproves that reading directly.

**Recorded as: non-interactive local credential-path failure.**

### 4.2 Organizer GUI attempt — SUCCEEDED

Founder-executed. Corroborated here from the distribution log bundle
`BTYNorebangAdmin_2026-08-14_20-10-53.718.xcdistributionlogs`, which this session read directly:

```
distributionMethod(resolved) = IDEDistributionMethodiOSAppStoreValidation   ← VALIDATION, not upload
steps run: TeamStep · SigningMethodStep · SigningAssetsStep · AnalyzeArchiveStep ·
           AnalyzeVersionStep · FetchAppRecordStep · CreateAppRecordStep · UploadAccountStep ·
           PackagingStep · ValidationStep · SummaryStep · ResultStep
errors / "Step failed" / "No Accounts" :  NONE
signing certificate used:  Apple Distribution: Hanbit Chi (CS92W2HFCH)
provisioning profile used: iOS Team Store Provisioning Profile, UUID 1b01b255-…
                           teamName "Hanbit Chi"
```

The seven §D questions, answered:

```
1  Xcode accepts the account/team                       YES  no account errors; team resolved
2  cloud-managed distribution permission exists         YES  it signed with a cert whose private key
                                                             is not on this machine
3  distribution identity obtainable without local key   YES  Apple Distribution used, 0 local identities
4  valid App Store profile obtainable/usable            YES  1b01b255, App Store type
5  Sign in with Apple + Associated Domains accepted     YES  App ID features APPLE_ID_AUTH = 1,
                                                             ASSOCIATED_DOMAINS = 1; both survive re-signing
6  distribution artifact get-task-allow=false           YES  §5
7  certificate/profile chain valid                      YES  codesign --verify --strict: valid on disk,
                                                             satisfies its Designated Requirement
```

## 5. Distribution artifact forensics — measured, not attested

Xcode retained the packaged, distribution-signed IPA at
`…/T/XcodeDistPipeline.~~~3ACSQn/Packages/BTYNorebangAdmin.ipa`. Extracted and inspected read-only:

```
Authority        Apple Distribution: Hanbit Chi (CS92W2HFCH)
                 Apple Worldwide Developer Relations Certification Authority
                 Apple Root CA
TeamIdentifier   CS92W2HFCH
Identifier       com.bty.BTYNorebangAdmin
codesign --verify --strict --verbose=2   valid on disk · satisfies its Designated Requirement

entitlements
  application-identifier            CS92W2HFCH.com.bty.BTYNorebangAdmin   ← exact match
  com.apple.developer.team-identifier  CS92W2HFCH                          ← exact match
  com.apple.developer.applesignin      [Default]                           ← PRESERVED
  com.apple.developer.associated-domains  [applinks:norebang.btydaily.com] ← PRESERVED
  beta-reports-active               true                                   ← TestFlight-capable
  get-task-allow                    false                                  ← DISTRIBUTION

embedded.mobileprovision
  iOS Team Store Provisioning Profile: com.bty.BTYNorebangAdmin
  UUID 1b01b255-f594-4311-8463-56e20038c634 · get-task-allow false ·
  beta-reports-active true · no ProvisionedDevices · expires 2027-08-10   → APP STORE type

identity preserved through re-signing
  1.0 (100) · iOS 18.0 · iPhone-only · ITSAppUsesNonExemptEncryption false

PrivacyInfo.xcprivacy   PRESENT, 200 bytes, survived distribution packaging
  NSPrivacyAccessedAPICategoryUserDefaults / CA92.1 — exactly as committed in R1B-R1

DEBUG gates in the DISTRIBUTION binary
  -BTYVerifyReplayGate 0 · -BTYPassPurchaseGate 0 · -BTYPassRecoveryGate 0 ·
  -BTYPassFinishGate 0 · -BTYAPIBaseURL 0
```

### The key negative measurement

```
security find-identity -v -p codesigning
  1) Apple Development: Hanbit Chi (Z4X34T4VRN)      1 valid identity
```

**Before and after.** No Apple Distribution private key appeared locally, and none was needed —
which is precisely the signature of cloud-managed signing. Provisioning profiles: 6 before, 6
after, newest still dated Aug 9. **Xcode created no local signing asset.**

## 6. Validation — succeeded, and the binary was NOT delivered

Server-side, from `ContentDelivery.log`:

```
Contacting Apple Services…
Making copy of 'BTYNorebangAdmin.ipa'…
Preparing to verify 'BTYNorebangAdmin.ipa'…
Analyzing package…
Sending analysis to App Store Connect…
Waiting for App Store Connect analysis response…
Sending SPI analysis to App Store Connect…
Waiting for App Store Connect SPI analysis response…
Verify succeeded.
VERIFY SUCCEEDED with no errors
```

**Errors: 0. Warnings: 0.** Nothing to classify by consequence — Apple returned a clean verify.

**Proof that no build was delivered:**

```
"processingState"      : null
"processingErrors"     : null
"buildProcessingState" : null
```

Validation uploads the package for *analysis* and returns a verdict; it does not create a build
record. Nothing entered processing, and no upload action was taken.

### Incidental ASC readback — the first real one from this machine

The validation flow queried ASC and the response was logged. It was a **read**
(`GET /v1/apps?filter[bundleId]=…&include=…`); `CreateAppRecordStep` ran but `FetchAppRecordStep`
found the existing record, so nothing was created:

```
app id            6798374814
bundleId          com.bty.BTYNorebangAdmin
name              "BTY Norebang"
removed           false
appStoreVersions  1 total — id f399d962-… · versionString "1.0" · platform ios
provider          31f93137-44e5-4a93-8fe8-e923e7768e2b
isOptedInToDistributeIosAppOnMacAppStore  true
```

So the app record and a 1.0 iOS version **exist**. Their *state* was not requested and remains
unknown (`appStoreState` was null in the response because it was not among the requested fields).

## 7. What is still NOT proven — do not read this as submission readiness

This slice proves **distribution signing and binary validation only.**

```
app version metadata completeness              UNKNOWN
screenshots                                    UNKNOWN
review information / demo account              UNKNOWN
App Privacy answers                            UNKNOWN
Paid Apps agreement                            UNKNOWN   ← gates ALL commerce
banking                                        UNKNOWN   ← gates ALL commerce
tax                                            UNKNOWN   ← gates ALL commerce
each IAP's review status and metadata          UNKNOWN
can the three first IAPs ship with this version UNKNOWN
```

`AUTOMATED_ASC_READBACK_UNAVAILABLE` still stands: no `AuthKey_*.p8`, no ASC API credentials, no
fastlane. The §6 readback was a by-product of the validation flow, not a general capability.

## 8. What this slice did NOT do

```
upload build 100                         NO   validation only; processing states null
submit the app for review                NO
submit any IAP                           NO
change ASC metadata                      NO   the only ASC call was a filtered GET
activate PASS_1H / write the catalog     NO   catalogActive 0, verified before and after
any commerce or Apple purchase action    NO
create/revoke a distribution certificate NO   0 local identities before and after
create/delete a provisioning profile     NO   6 before, 6 after, none re-dated
change project signing settings          NO
modify source, project or docs           NO   working tree unchanged
touch the pre-existing .xcscheme edit    NO
```

## 9. Hard-won notes

**A CLI failure and a GUI success are not a contradiction — they are a measurement of where the
credential lives.** `xcodebuild -exportArchive` cannot prompt, so a missing keychain credential
surfaces as "No Accounts" and then, misleadingly, as "no certificate with a private key". Reading
that second message as the cause would have concluded "distribution impossible" for the second
time in this build. The first conclusion of that kind (BUILD 26J, "0 distribution certificates")
was already wrong; this is the same mistake wearing a different error string.

**The absence of a local private key was the expected evidence, not a problem to fix.** The brief
said so in advance, and it held: cloud-managed signing leaves the keychain untouched. Had a
distribution identity appeared locally, that would have meant something *else* happened.

**Validation is a server verdict, so collect the server's words.** "Organizer said it passed" is an
attestation; `VERIFY SUCCEEDED with no errors` plus `processingState: null` in the delivery log is
a measurement, and it simultaneously proves the success and the non-delivery.

**A distribution artifact must be re-inspected, not assumed to inherit.** Re-signing rewrites
entitlements and the embedded profile. Checking `get-task-allow=false`, both entitlements, the
privacy manifest and the version in the *packaged IPA* — rather than in the archive — is what makes
the chain evidence instead of inference.

---

**BUILD 26T-R1B-R3 — PASS / CLOSED.** Cloud-managed distribution signing is proven available for
this account and machine; build 1.0 (100) passed Apple's pre-delivery validation with zero errors;
the artifact is correctly distribution-signed with both entitlements and the privacy manifest
intact. **Nothing was uploaded or submitted, no ASC metadata or IAP was touched, and `PASS_1H`
remains inactive.** ASC metadata, agreements and IAP readiness remain unmeasured and gate any
further step.
