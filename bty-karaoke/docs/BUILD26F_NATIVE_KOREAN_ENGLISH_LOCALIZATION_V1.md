# BUILD 26F — NATIVE KOREAN / ENGLISH LOCALIZATION V1

## 1. Verdict

**BUILD 26F — PASS / CLOSED — 2026-08-08**

```text
Native iOS only. No server change. No Worker change. No database change.
No migration. No StoreKit scope change. No deployment.
MARKETING_VERSION 1.0 unchanged. CFBundleVersion 85 → 86.
```

All six physical-device gates were verified by the Founder on the shipped Native app, and the full
automated localization contract suite passes against the canonical commits.

Closure was **not** granted on the implementation commit alone. Final certification found that
ordinary Xcode builds re-extracted two punctuation-only accessibility format keys (`"%@, %@"` and
`"%@, %@, %@"`), leaving the repository user-facing correct but **not build-reproducibly
catalog-clean**. That defect was repaired before closure — see §8 in full.

**Document location note.** This closure was authorized for `bty-app/docs/`. That path does not hold
BUILD documentation — `bty-app/` is the Arena/Training-Center product and contains no `BUILD*.md` —
and the Native repository (`/Users/hanbit/Dev/bty-norebang-admin-ios`) has **no `docs/` directory at
all**. The canonical BUILD documentation directory for the Norebang product is `bty-karaoke/docs/`,
with direct precedent for a Native-only build in
`BUILD26D_NATIVE_IOS_GOOGLE_SIGNIN_VERIFICATION_V1.md`. No new documentation location was invented.

## 2. Canonical implementation identity

```text
Repository        /Users/hanbit/Dev/bty-norebang-admin-ios (dentistchi/bty-norebang-admin-ios)
Implementation    ca620e38bcfe47bd28934d1bce547cdad7bd1594   (main, pushed 0d8e593..ca620e3)
                  30 files changed, 8946 insertions(+), 616 deletions(-)  (26 Swift files)
Repair            30dbf403a042e7684f279dcccb2de8bf925521ff   (main, pushed ca620e3..30dbf40)
                  1 file changed, 5 lines — pre-closure catalog-extraction stabilization (§8)
Parent / baseline 0d8e593c1013b65aea7f6027f312d49d1390f129
CFBundleVersion   86
MARKETING_VERSION 1.0
```

## 3. Final automated verification

```text
Host suite                 1993 passed / 0 failed
Guest suite                 854 passed / 0 failed
Localization mutants         12 / 12 killed
Debug build                BUILD SUCCEEDED
Release build              BUILD SUCCEEDED

Localization catalog        403 keys
source language             en
locales                     en + ko
en missing                  0
ko missing                  0
placeholder mismatch        0

xcscheme SHA-256  32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
```

Verified against the committed blob, not merely against a working tree:

```text
git show ca620e38:BTYNorebangAdmin/Localizable.xcstrings
  total entries 403 · extractionState manual 403 · non-manual 0
```

### The pre-existing xcscheme diff — PRESERVED EXACTLY

`BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme` carried an
**uncommitted, pre-existing** diff when BUILD 26F began: the LaunchAction `buildConfiguration`
switched `Debug` → `Release`, plus two **disabled** `CommandLineArgument` rows
(`-BTYAPIBaseURL`, `http://192.168.68.54:3002`).

**That diff was NOT part of BUILD 26F.** It was not authored, absorbed, normalized, rewritten, or
staged. It remains uncommitted and byte-identical, before and after the commit:

```text
xcscheme staged in ca620e38   0 files
xcscheme SHA-256 (entry)      32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
xcscheme SHA-256 (post-commit) 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
```

### The 12 localization mutants

Each mutant was introduced, the suite run, and the source restored. All 12 were killed.

```text
M1  drop a Korean catalog value                    KILLED  1988 passed / 5 failed
M2  placeholder mismatch between en and ko         KILLED  1992 passed / 1 failed
M3  drop the English plural 'one' case             KILLED  1991 passed / 2 failed
M4  shorten a destructive (deletion) label         KILLED  1992 passed / 1 failed
M5  flip sourceLanguage to ko                      KILLED  1992 passed / 1 failed
M6  orphan a catalog key (declared, never used)    KILLED  1992 passed / 1 failed
M7  typo a key referenced from Swift               KILLED  1991 passed / 2 failed
M8  reintroduce a Korean literal into a shipped view KILLED 1991 passed / 2 failed
M9  re-pin ko_KR in a formatter                    KILLED  1991 passed / 2 failed
M10 restore the display-string surgery             KILLED  1989 passed / 4 failed
M11 untranslated Guest CTA (en left as Korean)     KILLED  Guest 853 passed / 1 FAILED
M12 drop a Guest key's Korean value                KILLED  Guest 852 passed / 2 FAILED
```

Baseline re-confirmed green after restoration: Host `1993 passed, 0 failed`; Guest `ALL 854 PASSED`.

## 4. Device gates — Founder-verified

### G1 English Host Full Flow — **PASS**

The Founder verified the shipped Native app in English across the Host flow, search, queue,
playback, FREE / Pass, Account, Login Methods and Delete Account. **No Korean leakage observed**
outside the approved untranslated visual/product tokens and server-owned content (§7).

### G2 Korean Host Full Flow — **PASS**

The Founder switched the Native app to Korean and verified the same critical Host flow. **No
localization regression and no layout regression observed.**

### G3 Native Host / Guest Locale Independence — **PASS**

Host and Native Guest presentation languages are independently controlled by each device/app
language, **not** by the room or by the Host's language. A Korean Host and an English Native Guest
each see their own language in the same room.

> **Authority boundary — recorded separately.** QR **Browser** Guest localization is **BUILD 26G**
> and is **not** Native BUILD 26F authority. 26G's rule (Guest's own browser language, explicit
> Guest choice first, Host language never participating) governs the Web surface. This build makes
> no claim over it, and the two builds must not be cited for one another.

### G4 Language Transition / Persistence — **PASS**

The Founder verified `English → Korean → English` with app restarts and confirmed:

```text
authentication / state preserved across the transitions and restarts
the selected locale rendered consistently after each restart
no stale Korean copy leaked after returning to English
no Korean 오전 / 오후 leaked into English
```

### G5 High-Risk Layout — **PASS**

High-risk English localization surfaces were verified: entitlement chip · TimedPass card · Delete
Account · Queue rows · Guest search/request rows · First Room CTA · Login Methods.

```text
no clipping · no overlap · no hidden actions · no broken wrapping
no tiny forced-text workaround regression
```

### G6 Unsupported Locale + Final Regression — **PASS**

Unsupported-locale fallback to English was verified, together with a normal karaoke Guest lifecycle
— room entry, search, request/queue, playback progression. **No localization-related runtime
regression observed.**

## 5. IMPORTANT IMPLEMENTATION CORRECTION — catalog drift, found and repaired

**During final pre-commit verification the Host suite FAILED.** `Localizable.xcstrings` had drifted
from **403 to 419 keys**. This was not smoothed over, and the failure is recorded here in full.

**Root cause.** Xcode **auto-extracts** every SwiftUI `Text("literal")` into the String Catalog at
build time. Sixteen non-manual entries had accumulated across earlier builds — including approved
visual/product tokens that must never be translated:

```text
BTY Norebang · GUEST · LIVE · NOW SINGING · %@ %@   (and 11 more)
```

Two contracts failed exactly as designed:

```text
26F-2   every catalog entry has Korean — missing: ["%@ %@", …]
26F-16b orphaned keys: [… "BTY Norebang", "GUEST", "LIVE", "NOW SINGING" …]
```

**Repair.** 22 shipped sites across 8 files were changed to `Text(verbatim:)`, at exactly the places
where the string is an intentionally non-localized visual/product token:

```text
ContentView.swift 3 · HostViews.swift 4 · QueueView.swift 2 · RootView.swift 3
RoomSelectionView.swift 2 · NowPlayingView.swift 1 · TimedPassCardView.swift 1
GuestRoomView.swift 6                                              = 22 sites
```

**After regeneration:**

```text
catalog returned to 403 keys
a Debug rebuild produced 0 non-manual catalog entries
all localization contracts passed again
```

**This repair is part of canonical BUILD 26F commit `ca620e38`.**

### Two secondary findings from the same repair

**(a) `Button("X") { … }` cannot take `verbatim`.** The shorthand initializer accepts only a
`LocalizedStringKey`. A scripted edit stripped the label and left `Button { … }` with no label at
all. It was repaired to the explicit form and is recorded so the trap is not repeated:

```swift
Button {
    // Unrouted since the Host account flow replaced it (see RootView).
} label: {
    Text(verbatim: "Connect Room")
}
```

**(b) The catalog is a BUILD ARTIFACT as well as a source file.** It must be re-verified after every
Xcode build, never only after editing it. This is the durable lesson of §5 — and §8 is the proof that
one pass of it was not enough: the same mechanism resurfaced through a different overload and had to
be closed at the compiler, not at the file.

## 6. Architecture

```text
Localizable.xcstrings   the single real shipped localization catalog
                        symbolic semantic keys · en source language · en + ko
                        unsupported locale → English
L10n.swift              the Bundle seam — ZERO user-facing copy inside it
app runtime             resolves through Bundle.main
standalone tests        inject the compiled REAL localization bundle
Tests/run.sh            compiles the actual String Catalog with xcstringstool
                        no separate Swift translation dictionary exists
```

### Why the seam exists

`Tests/run.sh` compiles the app sources with bare `swiftc` into a plain executable, so `Bundle.main`
has no `.lproj` and `String(localized:)` silently returns **the key**. Hundreds of Korean-bearing
assertions would have started comparing against English and "passing" for the wrong reason.

`xcrun xcstringstool compile Localizable.xcstrings` produces real `en.lproj` / `ko.lproj` (`.strings`
**and** `.stringsdict`) with no Xcode build. Both runners build that into an `L10n.bundle` and export
`BTY_L10N_BUNDLE`, so **tests assert the SHIPPED en and ko values**. `L10n` holds only
`bundle` / `localeOverride` plus formatter helpers — no copy. (Its six Hangul-bearing lines are
doc comments citing rendered examples, not strings.)

`bundle.localizedString(forKey:)` + `String(format:locale:)` resolves plurals from `.stringsdict`;
`String(localized: "key \(arg)")` does **not** — interpolation becomes part of the key. That was a
proven dead end and is recorded so it is not retried.

### Repaired localization-hostile constructions

```text
UsageProjection display-string surgery   accessibilityLabel cut "FREE · " back out of its own
                                          title with replacingOccurrences — string surgery on
                                          display copy. Now carries remainingPhrase as a value.
AdmissionCopy fragment concatenation     passInsufficient / upgradeRequired were '+'-joined
                                          Korean fragments → whole-sentence templates.
Korean copula handling                   returned Korean words from Swift → key-suffix selection.
VoiceOver FREE-prefix surgery            removed with the UsageProjection repair above.
Korean-width Guest CTA reservation       GuestResultCardLayout.ctaWidth was a FROZEN KOREAN
                                          measurement → ctaReservedWidth(labels:) measures the
                                          CURRENT language (en 151pt vs ko floor 132pt), which
                                          preserves the BUILD 20M-NATIVE-R2 state-stable footprint
                                          in both languages.
```

### Locale corrections

```text
three ko_KR-pinned formatters removed          0 ko_KR pins remain in the app
locale-aware time formatting                   setLocalizedDateFormatFromTemplate("jmm")
English cannot receive Korean 오전 / 오후        asserted by contract, verified on device (G4)
English plurals correct                        10 substitution entries; en declares one + other
English ordinals correct                       NumberFormatter .ordinal → 1st / 2nd / 3rd / 4th
Korean 번째 semantics preserved                  ko renders 1번째; GuestCopy.ordinalSuffix deleted
                                               rather than translated
```

Two locale traps are recorded because each is a real defect class:

- `DateComponentsFormatter` must use **`.dropLeading`, not `.dropAll`**. `.dropAll` silently deletes
  the trailing zero unit, which broke BUILD 24 §8 (`13분 0초` → `13분`, re-hiding 59s of change) and
  R3.1-A's `1시간 0분`. Caught by the existing suite.
- ICU separates the time from AM/PM with **U+202F (narrow no-break space)**. Assertions normalize it
  rather than pinning the codepoint.

### Korean 받침 (batchim) handling

```text
grammatical variant selection is ALLOWED
no branching on the current language
English catalog values remain complete English sentences
```

`koreanCopula(after:)` — which returned Korean words from Swift — became
`koreanBatchimVariant(after:)`, returning a **key suffix** (`batchim` / `no_batchim`). The two Korean
entries differ only by 이에요 / 예요; **both English entries are the same complete sentence.** Nothing
in the app branches on language.

## 7. Preserved / intentional exemptions

### Approved untranslated visual / product tokens

```text
NOW SINGING · UP NEXT · HOST · GUEST · LIVE
BTY NOREBANG · BTY Norebang · My Norebang · Norebang
```

### Other preserved facts

```text
Preview-only Korean literals remain exempt ONLY at exact #Preview scope
  (Direction1View / Direction2View / Direction3View + GuestPreviewMock in GuestRoomView.swift,
   reachable solely from the three #Preview declarations)
dead ContentView.swift was neither translated nor deleted
stable server / error identifiers remain untranslated
presentation copy is localized
MARKETING_VERSION remained 1.0
server / runtime unchanged
migrations unchanged
StoreKit scope unchanged
existing xcscheme bytes unchanged
```

**One precision on `ContentView.swift`, recorded so the record is exact.** The file is dead — nothing
in the app or tests references it. Its copy was **not translated and the file was not deleted**, as
required. It was, however, **touched** by the §5 extraction repair: its three literals
(`BTY Norebang`, `Admin Console`, `Connect Room`) were wrapped in `Text(verbatim:)` so Xcode cannot
extract them into the catalog, and the `Button` was restructured for the reason in §5(a). Copy
unchanged, semantics unchanged, file retained.

## 8. Pre-closure reproducibility defect — discovered, and repaired before closure

**This was found while certifying the closure, and it was repaired rather than documented away.**

```text
ca620e38   the main BUILD 26F implementation commit
30dbf403a042e7684f279dcccb2de8bf925521ff   the pre-closure reproducibility repair
```

### 8.1 The defect

`ca620e38` was **user-facing correct** — the committed artifact contained exactly
`403 total / 403 manual / 0 non-manual` and every shipped string was localized. But the repository
was **not build-reproducibly catalog-clean**: an ordinary Xcode build re-extracted two keys into the
source catalog.

```text
committed  ca620e38   403 total · 403 manual · 0 non-manual
after an ordinary Xcode build   405 total · 403 manual · 2 non-manual
the two keys:  "%@, %@"   "%@, %@, %@"     (en only, state "new")
entries whose content differs: 0      entries missing: 0
```

Measured consequence against the drifted tree — exactly two contracts fail, both naming only the two
copy-free keys:

```text
1991 passed, 2 failed
FAILED: 26F-2:   every catalog entry has Korean — missing: ["%@, %@", "%@, %@, %@"]
FAILED: 26F-16b: every catalog key is actually read by the app — orphaned: ["%@, %@", "%@, %@, %@"]
```

**Root cause.** Five shipped `.accessibilityLabel("\(a), \(b)")` sites in `GuestRoomView.swift`. A
string *literal with interpolation* selects the `accessibilityLabel(_ key: LocalizedStringKey)`
overload, so the compiler extracts a **punctuation-only join key**. Every one of the app's other
~50 `accessibilityLabel` call sites passes a `String` value, selects the `StringProtocol` overload,
and is never extracted — these five were the only literal-form sites in the app.

### 8.2 The repair — commit `30dbf403a042e7684f279dcccb2de8bf925521ff`

```text
GuestRoomView.swift:2119   .accessibilityLabel("\(d.title), \(cta.label)")
GuestRoomView.swift:2478   .accessibilityLabel("\(GuestCopy.noRequestTitle), \(GuestCopy.noRequestBody)")
GuestRoomView.swift:2612   .accessibilityLabel("\(NowSingingCopy.upNextSubtitle), \(d.title), \(song.guestName)")
GuestRoomView.swift:3060   .accessibilityLabel("\(line1), \(GuestCopy.arrivalLine2)")
GuestRoomView.swift:3084   .accessibilityLabel("\(GuestCopy.successBannerLine1), \(line2)")
```

each wrapped in the explicit `Text` overload:

```swift
.accessibilityLabel(Text(verbatim: "\(GuestCopy.noRequestTitle), \(GuestCopy.noRequestBody)"))
```

`Text(verbatim:)` takes a `String`, so the interpolation is ordinary `String` interpolation. **The
spoken label is byte-identical** — the same already-localized `GuestCopy` / `NowSingingCopy` values
joined by the same `", "`. **No new key was introduced for punctuation.** No visible copy changed, no
`GuestCopy` / `NowSingingCopy` semantics changed. The commit is 1 file, 5 lines.

### 8.3 Reproducibility proof — and the false proof that was rejected first

**A CLI measurement of the source catalog is NOT a proof, and was discarded.** `xcodebuild` does not
write extracted strings back into `Localizable.xcstrings`; only an Xcode.app IDE build performs that
sync. The first attempt — restore the catalog, run Debug and Release, re-measure — returned
`403 / 403 / 0` at every step, but a **negative control** (reverting one site to the literal form and
rebuilding) *also* returned `403 / 403 / 0`. The instrument was blind, so the result was vacuous and
is recorded here rather than quietly replaced.

The valid instrument is the compiler's own extraction output, `*.stringsdata`, which lists every
extracted key with its source line before any sync occurs.

```text
Builds        iPhone 17 simulator, iOS 26.5, clean build folder
Debug         ** BUILD SUCCEEDED **     catalog after: 403 total / 403 manual / 0 non-manual
Release       ** BUILD SUCCEEDED **     catalog after: 403 total / 403 manual / 0 non-manual

Extraction layer (GuestRoomView.stringsdata, Debug):
  repaired                      "%@, %@" extracted: False   "%@, %@, %@" extracted: False
  NEGATIVE CONTROL, 1 site reverted, rebuilt
                                "%@, %@" extracted: True    ← instrument proven sensitive
  repair restored, rebuilt      "%@, %@" extracted: False
```

The cause is removed at the compiler, so no sync of any kind — CLI or IDE — can reintroduce the keys.

**Recorded limitation, honestly.** The compiler still extracts 21 literals from `GuestRoomView.swift`
lines 3165–3246 — all inside `Direction1View` / `Direction2View` / `Direction3View`, reachable only
from the three `#Preview` declarations at lines 3253–3255. These are the §7 preview-scope exemption.
Measured evidence that they do **not** reach the catalog: the drift that started this repair added
*only* the two accessibility keys, while preview-scope strings extracted in the very same build
(`BTY NOREBANG` at line 3229, `NOW PLAYING · %@` at 3165) were **not** added. Preview-scope
extraction is therefore not synced, and no claim beyond that measurement is made here.

### 8.4 Verification after the repair

```text
Host suite                 1993 passed / 0 failed
Guest suite                 854 passed / 0 failed
Localization mutants         12 / 12 killed  (identical kill profile to §3)
catalog                     403 total · 403 manual · 0 non-manual · sourceLanguage en · en + ko
en missing 0 · ko missing 0 · placeholder mismatch 0
CFBundleVersion 86 · MARKETING_VERSION 1.0   (project.pbxproj byte-identical to ca620e38)
xcscheme SHA-256  32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
```

`Localizable.xcstrings` was **not** re-staged: after the repair its bytes are already identical to
the canonical committed blob, so the repair commit is exactly one file. The pre-existing xcscheme
diff was again left unstaged and unmodified.

### 8.5 Device gates

**G1–G6 remain PASS from Founder physical-device verification and were not repeated.** The repair
changes only which `accessibilityLabel` overload the compiler selects for punctuation-only
composition; the spoken labels, the visible copy and every localized value are unchanged.

## 9. Scope boundaries

**Included:** Native iOS Host and Guest presentation copy · String Catalog · locale-aware formatting
· plurals and ordinals · 받침 variant selection · layout hardening for English · test harness
localization support · CFBundleVersion increment.

**Excluded:** QR Browser Guest localization (**BUILD 26G**) · any server, Worker, database or
migration change · StoreKit and pricing copy scope · Android · in-app language selector (explicitly
out of scope — device language is the only authority) · the app display name "BTY Norebang Admin",
which remains deferred from BUILD 26H · any language beyond ko and en.

## 10. Rollback

```text
git revert 30dbf403a042e7684f279dcccb2de8bf925521ff     (repair only — restores the §8 defect)
git revert ca620e38bcfe47bd28934d1bce547cdad7bd1594     (implementation; or reset to 0d8e593c)
```

Native-only, no deployment and no migration, so rollback is a source revert plus a rebuild. Nothing
in Web, the Worker, the database or StoreKit depends on this commit, and no other build depends on
CFBundleVersion 86.

## 11. Related builds

```text
BUILD 26E   canonical account ownership + account deletion authority — its deletion strings are
            asserted bilingual and not shortened by this build's contracts
BUILD 26G   QR Web Guest Korean/English localization — the Web surface; separate authority (G3)
BUILD 26H   QR → Native Guest handoff — required NO Native change; CFBundleVersion stayed 86
BUILD 24    §8 live clock truth — protected by the .dropLeading formatter decision (§6)
BUILD 20M   NATIVE-R2 state-stable CTA footprint — preserved by ctaReservedWidth(labels:) (§6)
```

---

**BUILD 26F — PASS / CLOSED**
