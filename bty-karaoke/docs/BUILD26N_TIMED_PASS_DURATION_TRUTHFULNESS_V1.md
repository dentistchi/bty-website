# BUILD 26N — Timed Pass Duration Truthfulness

**Status: IMPLEMENTED — PHYSICAL GATES G1–G6 PENDING. NOT `PASS / CLOSED`.**

Every sentence the product shipped about a Timed Pass said when the clock **starts**. Not one said
what makes it **stop**. Nothing does. BUILD 26N adds the missing half, in both languages, on the
surfaces where it can still change a decision — and changes no behaviour whatsoever.

The code, the automated proof and both builds are complete. **The physical device gates are not
run**, because they require the Founder and the iPhone. Per §16 of the build contract this is
therefore not closure, and it is recorded as what it is rather than rounded up.

---

## 1. Verdict

| | |
|---|---|
| Implementation | **COMPLETE** |
| Automated tests | **COMPLETE** — host 2164 / 0, guest 854 / 0, 10/10 mutants killed |
| Debug + Release builds | **COMPLETE** — both `BUILD SUCCEEDED`, both carry build 95 |
| Production non-mutation | **COMPLETE — MEASURED LIVE**, not carried forward |
| Physical gates G1–G6 | **NOT RUN — PENDING FOUNDER + DEVICE** |
| **Overall** | **NOT `PASS / CLOSED`** |

---

## 2. The defect

The paid clock and the free meter are measured in **different units**, and only one of them was
ever explained.

| | Unit | Authority |
|---|---|---|
| FREE 900 s | **playback-consumption seconds** (`sum(lease_seconds)`) | `karaoke_free_minutes_entitlement_at_v2` |
| Timed Pass | **elapsed wall-clock from activation** | `timed_pass_expiry_math_chk` |

`timed_pass_expiry_math_chk` fixes `expires_at = activated_at + (duration_seconds +
carryover_seconds)` at the instant of activation, and no code path ever moves it. So a Timed Pass
keeps counting through a pause, an empty queue, backgrounding, force quit, device shutdown and
network loss — while the FREE meter rendered beside it ticks **only during playback**.

A Host who generalizes from FREE reads "1 hour" as an hour of singing. Measured before this build:
**420 localization keys, and not one disclosed it.** All five arming strings named only the start:

```
pass.selected.starts_on_first_play  [en] The %1$@ pass you selected starts when you play the first song.
pass.selected.detail                [en] Your %1$@ pass starts once the first song plays.
pass.available.not_started_notice   [en] Selecting a pass doesn't start it. Your time begins when the first song starts playing.
pass.action.select.supporting       [en] The pass you select starts when the next song first plays.
```

Track B0 §3 named this gap and marked closing it **non-optional** (FD-8).

---

## 3. Scope

**In scope.** Native SwiftUI presentation, the String Catalog, narrowly scoped native tests, the
build number, and this document.

**Explicitly NOT in scope, and not touched.** Server code · Worker code · Supabase migration ·
production DB mutation · `karaoke_product_catalog` · `is_active` · StoreKit · `Product.products(for:)` ·
`Transaction.currentEntitlements` · `Transaction.updates` · `purchase()` · restore purchases ·
payment CTA · price display · ASC product creation · entitlement issuance · timed-pass duration
math · carryover logic · switch logic · FREE meter behaviour · Guest behaviour · BUILD 26M
documentation.

---

## 4. Baseline

```
BUILD 26M         PASS / CLOSED, closure 3eec9375bb27437d03399c1e8db2a5f36d323d94
web HEAD/origin   3eec9375bb27437d03399c1e8db2a5f36d323d94   (0 0)
native HEAD/orig  9a2bc119015fa832972722ee3b4ae812e328014c   (0 0)
native build      CFBundleVersion 94 · MARKETING_VERSION 1.0
localization      420 keys
host tests        2116 passed / 0 failed
guest tests        854 passed / 0 failed
```

Worker documentary baseline, carried and **not** re-measured — the two identities stay separate:

| | Value |
|---|---|
| Worker VERSION ID | `05067bbc-82b6-4be5-8a5a-13fcff6223cf` |
| Served source (git commit) | `712fe5895abbad7c259f8e19306f60167a6bcec1` |

**BUILD 26N deployed nothing, so neither value can have changed.**

---

## 5. Changed files

```
BTYNorebangAdmin/Localizable.xcstrings       +34   two keys, en + ko
BTYNorebangAdmin/TimedPass.swift             +13   two TimedPassCopy accessors
BTYNorebangAdmin/TimedPassCardView.swift     +24   three render sites + one inspection note
BTYNorebangAdmin.xcodeproj/project.pbxproj    +2/-2  build 94 -> 95, both configurations
Tests/QueueContractTests.swift              +206/-9  the 26N block + three version pins
```

Five files. **No file outside the native repository was modified by the implementation.**

---

## 6. Founder-ratified wording (verbatim, as shipped)

**Full form** — `pass.wallclock.notice`

```
en  Once activated, your pass runs continuously until it expires, even if playback is paused or the app is closed.
ko  이용권이 시작되면 재생을 멈추거나 앱을 닫아도 만료될 때까지 시간이 계속 차감됩니다.
```

**Compact form** — `pass.wallclock.compact`

```
en  Time continues to run after activation, even when playback is paused.
ko  이용권이 시작되면 재생을 멈춰도 시간은 계속 차감됩니다.
```

Both verified **in the shipped bundles of both configurations**, not merely in the catalog source —
`Debug/BTYNorebangAdmin.app/{en,ko}.lproj/Localizable.strings` and the Release equivalents each
resolve all four strings verbatim.

The four forbidden implications (only singing time counts · the pass pauses with playback · closing
the app saves time · the timer freezes) are pinned as **negative** assertions, so wording that
drifts toward any of them fails rather than merely reading differently.

---

## 7. Surfaces — inspected before editing, no new screen invented

| Contract | Surface | Change |
|---|---|---|
| **A** pre-activation | `availableCard` — the card that owns the **Select** buttons | Full notice, rendered **above** the buttons |
| **A** pre-activation | `selectedCard` — armed, not yet started | Full notice, after "starts once the first song plays" |
| **B** ACTIVE | `activeCard` | **Compact** form, after the expiry line, subordinate styling |
| **C** access status / detail | `RootView.entitlementSheet` | **None needed** — it hosts `TimedPassCardView` verbatim, so A and B already reach it |
| **D** exhausted / expired | `expiredCard` | **Deliberately NONE** — see below |

**Why the disclosure sits above the Select buttons.** Below them it would arrive after the decision
it exists to inform. A test pins the ordering, and a mutant that moves it below the rows is killed.

**Why the ACTIVE card gets the compact form.** The remaining-time figure must stay dominant. A
mutant that swaps in the full notice is killed, and a separate assertion pins that the countdown is
still rendered first.

**Why surface D was left alone.** Its two sentences — *"Your pass has ended"* / *"You're back to
your original access."* — make **no claim about what was consumed**, so nothing there implies only
played-song time was spent. The smallest truthful change to copy that is already truthful is no
change, and a wall-clock warning delivered after expiry informs no decision. Recorded as an
inspected decision in the source, not an omission.

---

## 8. Static semantic non-change proof

The disclosure is only honest if the thing it describes is untouched.

**The complete set of lines this build REMOVES, across all five files:**

```
-  CURRENT_PROJECT_VERSION = 94;                    (x2, project.pbxproj)
-  three build-number pin assertions + their comment  (QueueContractTests.swift)
```

**That is all of them.** Every other change in the build is purely additive. No line of runtime
logic was removed or modified, so there is no semantic change to argue about.

Searched, and confirmed unchanged: `duration_seconds` · `carryover_seconds` · `expires_at` ·
`timed_pass_expiry_math_chk` · `switch_timed_access_pass` · `select_timed_access_pass` ·
`karaoke_begin_song_v2` · every timed-pass RPC · FREE usage meter math. The only diff lines
mentioning any of these are **comments and two assertions that pin them**.

Pinned as regressions inside the 26N block itself:

```
26N-T9a  remaining is still the SERVER-projected value
26N-T9b  the carryover window is still server-authoritative with the honest fallback
26N-T9c  the card still derives no time from the device clock (no Date()/Date.now)
26N-T9d  BUILD 26M-R4's alert-based confirmation is unchanged
26N-T9e  BUILD 26M's single switch call site is unchanged
26N-T9f  BUILD 26M-R3's playing guard is unchanged
```

**The monorepo working tree was never touched by the implementation.** `bty-karaoke/` carried
exactly `M docs/BUILD17_TIMED_ACCESS_PASS.md`, `?? brand/`, `?? docs/TRACK_B0_…md` at start and at
finish; this document is the only addition.

---

## 9. Localization reconciliation

```
before   420 keys
added      2   pass.wallclock.notice · pass.wallclock.compact
after    422 keys        (reconciled exactly)
```

No key renamed, deleted or duplicated. Both new keys carry `en` **and** `ko` at
`state: translated`. The catalog's own guards still hold:

```
26F-16a  every key Swift reads exists in the catalog        unresolvable: []
26F-16b  every catalog key is actually read by the app      orphaned: []
26F-16c  the catalog covers the whole app                   422 keys
```

`26F-16b` matters here: a disclosure key that no surface renders would be caught as orphaned, so
"the string exists" cannot be mistaken for "the string ships".

---

## 10. Automated tests

```
host contract     2116 -> 2164 passed / 0 failed     (+48, no pre-existing coverage lost)
guest contract      854 ->  854 passed / 0 failed     (unchanged)
```

### 10.1 The gate set

| | Assertion |
|---|---|
| T1 | full + compact disclosure exist in **English**, verbatim, resolved through the shipped catalog |
| T2 | same in **Korean**, plus KO-specific checks (`계속`, `차감`, `앱을 닫아도`) |
| T3 | both **pre-activation** surfaces render it, and it precedes the Select buttons |
| T4 | the **ACTIVE** surface renders the compact form, after the countdown |
| T5 | removal from either pre-activation surface is detectable |
| T6 | removal from the ACTIVE surface is detectable |
| T7 | a one-language-only localization is detectable, **in both directions** |
| T8 | no purchase/payment symbol and no price literal was introduced |
| T9 | the entitlement semantics and the whole 26M switch contract are unchanged |

**Per-card slicing, not whole-file `contains`.** Each assertion reads the body of one specific card
declaration. A whole-file `contains` would let a single occurrence satisfy all three surfaces at
once — which is exactly what T5 and T6 hunt for.

**Why T7 tests for difference, not presence.** A key added in English only still *resolves* in
Korean: it falls through to the English value, nothing crashes, and a Korean Host silently reads
English. Requiring the two languages to **differ** is what detects that; requiring presence does not.

### 10.2 Mutation testing — 10/10 killed

| | Mutant | Killed by |
|---|---|---|
| M1 | disclosure removed from the AVAILABLE (select) card | T3c, T3e, T5 |
| M2 | disclosure removed from the SELECTED (armed) card | T3d, T5 |
| M3 | compact disclosure removed from the ACTIVE card | T4a, T4c, T6 |
| M4 | `ko` notice falls through to English | T2a, T2e, T7a |
| M5 | `ko` compact falls through to English | T2b, T7b |
| M6 | ACTIVE card uses the FULL notice (countdown no longer dominant) | T4a, T4b, T4c |
| M7 | disclosure moved **below** the selectable pass rows | T3e |
| M8 | build reverted to 94 in **one** configuration (Debug/Release split) | 26N-N, 26N-15f, 26N-17e |
| M9 | a price literal (`$1.99`) reaches the pass card | T8d |
| M10 | EN disclosure replaced by a false comfort ("pauses when playback stops… only counts singing time") | T1a, T1e |

Every mutant was applied to the real file, run against the real suite, then reverted with the
file's SHA-256 re-verified byte-identical. M8 deliberately mutates **one** configuration only,
because that is the failure mode a `contains`-style pin survives — the BUILD 26J lesson.

### 10.3 A test that was wrong, recorded as wrong

The no-price assertion failed **twice on correct code** before it was right. `card.contains("$")`
and then "`$` followed by a digit" both match Swift's closure shorthand `$0`, which the 26M-R4
dismissal binding legitimately uses.

That is a broken assertion, not a finding, and weakening it to pass would have been the wrong
repair. It was replaced by extracting the card's **string literals** and inspecting those — which
is both correct and strictly stronger, since a price can only reach a Host through a literal. A
non-vacuity check pins that the extractor actually found literals, so an extractor returning
nothing cannot pass by finding nothing. M9 proves the final form fires.

---

## 11. Builds

```
Debug     ** BUILD SUCCEEDED **     iPhone 17 Pro simulator
Release   ** BUILD SUCCEEDED **     iPhone 17 Pro simulator
```

Verified in the **built products**, not only in the project file:

| | Debug | Release |
|---|---|---|
| `CFBundleVersion` | **95** | **95** |
| `CFBundleShortVersionString` | 1.0 | 1.0 |
| bundled `.lproj` | `en`, `ko` | `en`, `ko` |
| all four disclosure strings | verbatim | verbatim |

```
project.pbxproj:  CURRENT_PROJECT_VERSION = 95;  x2      94: 0 remaining
                  MARKETING_VERSION = 1.0;       x2
```

Both configurations matter independently: the bare-`swiftc` contract suite does **not** compile
SwiftUI views, so it cannot catch a view-level compile error on its own — the 26M §5 lesson.

**Build 93 remains burned** by BUILD 26M's physical G3 failure. **94 is superseded, not burned.**

---

## 12. Physical gates — NOT RUN

**G1–G6 require the physical iPhone running build 95 and the Founder operating it. They were not
performed, and nothing below is claimed as evidence.**

| Gate | State | What it still requires |
|---|---|---|
| **G1** KO pre-activation | **PENDING** | Korean device; arming surface; disclosure visible **before** confirming; no purchase affordance |
| **G2** EN pre-activation | **PENDING** | Same through the 26F language seam; equivalent **meaning**, not merely English text |
| **G3** ACTIVE surface | **PENDING** | Compact disclosure visible; remaining time still server-authoritative; countdown not obscured |
| **G4** Pause truthfulness | **PENDING** | Record remaining → stop playback → wait → refresh → confirm it decreased by wall-clock |
| **G5** App-close truthfulness | **PENDING** | Record → background/close → wait → reopen → confirm it advanced toward expiry |
| **G6** No commerce surface | **PENDING** on device (statically pinned by T8) | No price, Buy, purchase CTA, StoreKit or restore UI on any touched surface |

### 12.1 Live pass state for G3/G4/G5 — measured, and time-sensitive

Measured read-only at **2026-08-13 01:22:10Z**, gate account `1a0be5e8`:

```
ACTIVE     1   c81a120c-6350-4ec9-82ea-f86bf95f3681  (#9d116d4a)
           ONE_HOUR · duration 3600 · carryover 0
           activated 2026-08-13 00:42:55.667Z
           expires   2026-08-13 01:42:55.667Z
           remaining 1245 s  (~20m 45s)  — genuinely valid, not a lazy-expiry leftover
AVAILABLE 14 · SELECTED 0 · EXPIRED 3 · REVOKED 5
```

**This is exactly the 26M §13 final state.** An already-paid-for ACTIVE window existed, which is
precisely the condition §11 G5 asks for — G3/G4/G5 could have been observed **without issuing any
new grant**. It expires at `01:42:55Z`, so by the time this is read the window has very likely
closed. **No grant was issued to extend it**; §11 forbids manufacturing one without authorization,
and that instruction was followed.

### 12.2 A global count that is not a discrepancy

A repository-wide query returns `ACTIVE 2 / AVAILABLE 23`, against 26M §13's `ACTIVE 1 /
AVAILABLE 14`. **These do not conflict — 26M §13 was account-scoped.** Scoped to the gate account
the numbers match 26M exactly (above).

The second global ACTIVE row is on a **different** account and is a lazy-expiry leftover:

```
acd206b3-cb61-4cd7-980d-5d6ea4d80feb   account 2e2dd139
ONE_HOUR · activated 2026-08-01 00:40:02Z · expires 2026-08-01 01:40:02Z
still_valid = false — 12 days past expiry, still reading ACTIVE
```

Expiry is lazy with no background job (26L §6 recorded the same phenomenon at 9 days). **This row
predates BUILD 26N by twelve days, was not touched, and is recorded as an observation only** — not
a finding, not a defect claim, and not this build's to clean up.

---

## 13. Production non-mutation — MEASURED THIS SESSION

Measured live via the Management API using the Keychain PAT that the `supabase-karaoke` wrapper
injects. **These are freshly measured values, not the carried documentary baseline.**

| | Before work `01:22:10Z` | After work `01:23:30Z` | Expected |
|---|--:|--:|--:|
| `karaoke_apple_purchases` | **0** | **0** | 0 |
| paid grants (`is_paid`) | **0** | **0** | 0 |
| `karaoke_product_catalog` rows | **3** | **3** | 3 |
| catalog rows with `is_active` | **0** | **0** | 0 |
| `timed_access_pass_grants` | **53** | **53** | 53 |
| `timed_access_pass_audit` | **149** | **149** | — |
| grants ISSUED during this session | — | **0** | 0 |

Per-product, measured — the ratified 26L §5 meaning of `is_active` (operational authorization to
accept **new paid transactions** and turn a verified transaction into entitlement processing):

| product_code | storekit_product_id | seconds | is_paid | is_active |
|---|---|--:|---|---|
| PASS_1H | `com.btydaily.norebang.pass.1hour` | 3600 | true | **false** |
| PASS_4H | `com.btydaily.norebang.pass.4hour` | 14400 | true | **false** |
| PASS_24H | `com.btydaily.norebang.pass.24hour` | 86400 | true | **false** |

Migration ledger, read-only: fully paired through `20260814120000` (the 26M R3 guard), **nothing
pending, no new migration**. BUILD 26N created none.

> **A 403 that was not a permissions fact.** Bare `supabase migration list --linked` returned
> `403 "Your account does not have the necessary privileges"`. That is the known wrong-credential
> signature, not an access-control finding: the bare CLI fell back to a stored login for a
> different account. Re-running through the `supabase-karaoke` wrapper — which injects the correct
> Keychain PAT — succeeded immediately. Recorded so it is never again written up as a permissions
> problem.

**Documentary vs measured, stated explicitly.**

| Fact | Source |
|---|---|
| Commerce counts, catalog `is_active`, grant/audit totals, live pass state, migration ledger | **MEASURED THIS SESSION** |
| Worker VERSION ID `05067bbc-…` and served source `712fe589…` | **CARRIED DOCUMENTARY** — not re-measured. BUILD 26N deployed nothing, so neither can have changed. |

---

## 14. Explicit non-commerce statement

**BUILD 26N sells nothing and moves no money.**

No StoreKit import, no `.storekit` file, no `Product.products(for:)`, no
`Transaction.currentEntitlements`, no `Transaction.updates`, no `purchase()`, no restore, no price,
no currency, no purchase CTA, no App Store Connect product, no catalog mutation, no `is_active`
change, no entitlement issuance. The existing negative commerce contracts were **preserved, not
weakened**, and T8 adds new ones over the touched sources.

The disclosure explains **time**, never money. `karaoke_apple_purchases` is still empty and paid
transaction processing is still off.

---

## 15. Commits

```
implementation   a131d60  feat(karaoke-ios): BUILD 26N — disclose timed-pass wall-clock duration
                          (native repo — 5 files, staged by explicit path)
record           this document (monorepo, docs-only, separate commit)
```

**No `git add .` / `git add -A` was used.** Files were staged by explicit path in both repositories.
BUILD 26M documentation was not amended.

**Neither commit has been pushed.** §16 ties `HEAD`/`origin` parity to `PASS / CLOSED`, and this
build is not closed; pushing is left as an explicit Founder decision.

---

## 16. Preserved pre-existing state

```
native   M BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
           sha256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
           VERIFIED IDENTICAL before and after — NOT modified, NOT cleaned, NOT staged
```

This is the Founder's physical-device gate rig. Its hash is byte-identical to the value recorded
since `ec05d999` (Track B0 §6) and re-confirmed at 26L §3.

```
monorepo  M bty-karaoke/docs/BUILD17_TIMED_ACCESS_PASS.md
          ?? bty-karaoke/brand/
          ?? bty-karaoke/docs/TRACK_B0_APP_STORE_COMMERCE_PREFLIGHT_V1.md
          + ~70 modified / ~150 untracked unrelated Arena/Foundry paths
```

All untouched, unstaged, and uncleaned.

---

## 17. What must happen next

1. Install **build 95** on the physical iPhone.
2. Run **G1–G6** honestly. A failure is recorded as `FAIL` → repair commit → **new build number**
   (95 would be burned, following the BUILD 26M build-93 precedent) → repeat the affected gate.
3. Only then may this document be revised to `PASS / CLOSED`, and only then does the push /
   `HEAD`-parity step apply.

---

## 18. Deferred — untouched by BUILD 26N

None of the following is completed, advanced, or implied by this build:

- **Track B Slice 3** — server Apple transaction verification endpoint (26L §25)
- **App Store Connect product creation** — still zero IAP products; Product ID and purchase type are
  immutable once created, so this stays a deliberate, separately authorized console action
- **BUILD 18C G4** — grant `room_id`/`event_id` + auto-revert on event close
- **BUILD 18C G6** — promotional unactivated expiry (Welcome 30d / Referral 90d)
- **BUILD 18C G7** — promotional taxonomy / eligibility versioning
- **Pass issuance actor attribution** — `timed_access_pass_audit.metadata` is still unpopulated on
  the ISSUE path, and `bty_mgr` is still a shared-passcode identity that cannot name a person
  (26M §11)

---

## 19. What this build should be remembered for

- **Saying when something starts is not the same as saying what it costs.** The arming copy was
  accurate for two years and still left the Host with the wrong model, because the FREE meter
  standing next to it obeys the opposite rule.
- **A test that fires on `$0` is a broken test, not a finding.** Two versions of the no-price
  assertion failed on correct code. The repair was to test the user-visible surface — the string
  literals — not to loosen the assertion until it went quiet.
- **Slice the source per surface.** A whole-file `contains` would have let one disclosure satisfy
  three cards at once, and every removal mutant would have survived.
- **A global count is not an account-scoped count.** `ACTIVE 2` looked like drift against 26M's
  `ACTIVE 1` until it was scoped; the extra row was a twelve-day-old lazy-expiry leftover on another
  account. Scope the query before reporting the discrepancy.
- **An unrun gate is not a passed gate.** Everything automatable here is green, and that is still
  not closure.
