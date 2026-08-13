# BUILD 26N — Timed Pass Duration Truthfulness

**Status: PASS / CLOSED — 2026-08-13**

Every sentence the product shipped about a Timed Pass said when the clock **starts**. Not one said
what makes it **stop**. Nothing does. BUILD 26N adds the missing half, in both languages, on the
surfaces where it can still change a decision — and changes no behaviour whatsoever.

The disclosure was then checked against reality on a physical device: the pass was observed
counting down with **no song playing** and **with the app closed**, exactly as the new copy claims.

---

## 1. Final verdict

`PASS / CLOSED`

| | |
|---|---|
| Implementation | COMPLETE — native commit `a131d600071927cdedce894cafd58ce0762fa5a2` |
| Native identity | **build 95** · MARKETING_VERSION **1.0** |
| Automated tests | host **2164 / 0**, guest **854 / 0**, **10/10** mutants killed |
| Builds | Debug **BUILD SUCCEEDED** · Release **BUILD SUCCEEDED** |
| Physical gates | **G1–G6 all PASS** on build 95, Founder-operated |
| Migration | **NONE** |
| Worker deploy | **NONE** |
| Commerce activation | **NONE** — 0 purchases · 0 paid grants · catalog 3 · `is_active` false ×3 |

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
`karaoke_product_catalog` · `is_active` · StoreKit · `Product.products(for:)` ·
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

Worker documentary baseline, carried and **never re-measured** — the two identities stay separate:

| | Value |
|---|---|
| Worker VERSION ID (Cloudflare deployment identity) | `05067bbc-82b6-4be5-8a5a-13fcff6223cf` |
| Served source (git commit) | `712fe5895abbad7c259f8e19306f60167a6bcec1` |

These are **not interchangeable**, and BUILD 26N deployed nothing, so neither value can have changed.

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

Both verified **in the shipped bundles of both configurations** —
`{Debug,Release}/BTYNorebangAdmin.app/{en,ko}.lproj/Localizable.strings` each resolve all four
strings verbatim — and then observed on the physical device in §12.

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
still rendered first. G3 confirmed the intent held on a real screen.

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
-  CURRENT_PROJECT_VERSION = 94;                      (x2, project.pbxproj)
-  three build-number pin assertions + their comment  (QueueContractTests.swift)
```

**That is all of them.** Every other change is purely additive. No line of runtime logic was
removed or modified, so there is no semantic change to argue about.

Searched and confirmed unchanged: `duration_seconds` · `carryover_seconds` · `expires_at` ·
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

§12.3 then proves the same thing behaviourally: the gate pass ran `3600 = 3600 + 0` with the
expiry fixed at activation, exactly as before this build.

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
Debug     ** BUILD SUCCEEDED **
Release   ** BUILD SUCCEEDED **
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
**95 is the accepted closing build.**

---

## 12. Physical gates — Founder-operated on build 95

All six PASS. Every gate below is **Founder-operated physical-device evidence**; no simulator or
automation evidence is used or implied anywhere in this build.

| Gate | Result | Evidence |
|---|---|---|
| **G1** | **PASS** | KO pre-activation |
| **G2** | **PASS** | EN pre-activation |
| **G3** | **PASS** | ACTIVE surface |
| **G4** | **PASS** | No-playback truthfulness |
| **G5** | **PASS** | App-close truthfulness |
| **G6** | **PASS** | No commerce surface |

### 12.1 G1 / G2 — the disclosure arrives before the decision

**G1 (Korean).** Before the pass-selection buttons, the screen carried both halves of the truth
together:

```
선택한 이용권은 다음 노래가 처음 재생될 때 시작됩니다.
이용권이 시작되면 재생을 멈추거나 앱을 닫아도 만료될 때까지 시간이 계속 차감됩니다.
```

**G2 (English).** Before **Select This Pass**:

```
The pass you select starts when the next song first plays.
Once activated, your pass runs continuously until it expires, even if playback is paused or the app is closed.
```

The pairing is the point: the pre-existing sentence states the start, the new sentence states that
nothing stops it, and both are on screen **before** the Host commits. G2 was checked for equivalent
**meaning**, not merely for the presence of English text. No price / Buy / Purchase / Restore /
Apple commerce UI on either screen.

### 12.2 G3 — the ACTIVE surface, with the timer still dominant

```
ACTIVE 1-hour pass
59:47 remaining
expiry shown as 8:00 PM
compact disclosure rendered:  이용권이 시작되면 재생을 멈춰도 시간은 계속 차감됩니다.
```

The countdown remained visually dominant — the compact form did its job.

### 12.3 The pass used, and its server truth

Measured read-only after the gates:

```
grant            e59e46a1-8eef-44b3-bb0c-860e7ccf0f4a
account          1a0be5e8
pass_type        ONE_HOUR      duration_seconds 3600      carryover_seconds 0
source_type      MANUAL_PROMOTIONAL   is_paid false   apple_purchase_id NULL
created_at       2026-08-12 18:29:33.853068Z   <- PRE-EXISTING, not created for this build
selected_at      2026-08-13 01:59:38.027414Z   (18:59:38 PDT)
activated_at     2026-08-13 02:00:05.045993Z   (19:00:05 PDT)
expires_at       2026-08-13 03:00:05.045993Z   (20:00:05 PDT)  <- the "8:00 PM" G3 displayed
window           3600 s == 3600 + 0            timed_pass_expiry_math_chk holds exactly
```

**The expiry was fixed at activation and never moved** — which is the whole claim the new copy
makes.

### 12.4 G4 / G5 — every device reading reconciles to that one expiry

The physical figures are not merely plausible; each one back-computes to the **same** absolute
server expiry of `20:00:05 PDT`, monotonically, including across the app close/reopen:

| Gate | Device showed | at | Implied device clock | Δ from previous |
|---|---|---|---|---|
| G3 | 59:47 | ~7:00 | 19:00:18 | — |
| **G4** | 56:36 | 7:03 | 19:03:29 | +191 s |
| **G4** | 56:05 | 7:04 | 19:04:00 | **+31 s** |
| **G5** | 54:39 | 7:05 | 19:05:26 | +86 s |
| **G5** | 53:59 | 7:06 | 19:06:06 | +40 s |

**G4 — no-playback truthfulness.** The device displayed `재생 중인 곡이 없어요` ("no song is
playing") while the same pass stayed ACTIVE, and **31 seconds of pass time elapsed with nothing
playing**. Stopping playback does not stop expiry, exactly as disclosed.

**G5 — app-close truthfulness.** The Founder closed the app and reopened build 95. The remaining
time had advanced from `56:05` to `54:39`, and continued to `53:59`. The pass progressed toward the
**same absolute expiry** while the app was closed, exactly as disclosed.

This is wall-clock behavioural proof, not a stopwatch precision test; millisecond equality is
neither required nor claimed. What is claimed — and what the table shows — is that five independent
device readings are consistent with one fixed server `expires_at` and never with a paused clock.

**The disclosure now has physical evidence behind it, not just a constraint definition.**

### 12.5 G6 — no commerce surface

Across the inspected Korean and English pre-activation surfaces and the ACTIVE surface: no price,
no Buy, no Purchase, no Restore, no StoreKit UI, no Apple payment affordance. Static assertion T8
was already green; **physical inspection is what closes the gate**, because a static pin proves
only that symbols are absent from source, not that a screen is clean.

---

## 13. Production mutation — stated precisely, in two separate parts

**This gate session was NOT production-byte-identical, and this document does not claim it was.**
The two kinds of change are recorded separately because collapsing them is how implementation drift
gets hidden behind authorized test activity.

### A — Implementation / deployment mutation: **NONE**

```
migration              NONE
Worker deploy          NONE           (Worker version ID and served source unchanged, §4)
catalog change         NONE
commerce change        NONE
new grant issued       NONE
server semantic change NONE
```

### B — Physical-gate test mutation: **authorized, and exactly this much**

```
one PRE-EXISTING AVAILABLE 1-hour pass  e59e46a1  was SELECTED by the Host
it became ACTIVE when a song was started
one song was started for the gate
runtime/audit state advanced accordingly
```

This is authorized physical test activity, not implementation drift.

**The complete audit delta, measured** — exactly three rows, all on the gate account, all explained:

```
01:59:38.027Z  HOST             SELECTED   AVAILABLE -> SELECTED   e59e46a1
02:00:05.038Z  SYSTEM           EXPIRED    ACTIVE    -> EXPIRED    c81a120c
02:00:05.038Z  SYSTEM/dj_start  ACTIVATED  SELECTED  -> ACTIVE     e59e46a1
```

The last two share one timestamp — one transaction. `c81a120c` is BUILD 26M's ACTIVE pass reaching
its natural expiry; expiry is lazy with no background job, so the flip was recognised at this
authoritative check rather than at `01:42:55Z` when the window actually ran out.

**No `ISSUED` action appears. `timed_access_pass_grants` stayed at 53 rows before and after —
zero new grants were issued for this test**, as §11 of the build contract required.

### 13.1 Commerce invariant — freshly measured after the gates

Measured `2026-08-13 02:08:56Z` via the Management API using the Keychain PAT that the
`supabase-karaoke` wrapper injects:

| | Value | Expected |
|---|--:|--:|
| `karaoke_apple_purchases` | **0** | 0 |
| paid grants (`is_paid`) | **0** | 0 |
| `karaoke_product_catalog` rows | **3** | 3 |
| catalog rows with `is_active` | **0** | false ×3 |
| `timed_access_pass_grants` | **53** | 53 (unchanged) |
| `timed_access_pass_audit` | 149 → **152** | +3, itemised above |

Per-product, measured — under the ratified 26L §5 meaning of `is_active` (operational authorization
to accept **new paid transactions** and turn a verified transaction into entitlement processing):

| product_code | storekit_product_id | seconds | is_paid | is_active |
|---|---|--:|---|---|
| PASS_1H | `com.btydaily.norebang.pass.1hour` | 3600 | true | **false** |
| PASS_4H | `com.btydaily.norebang.pass.4hour` | 14400 | true | **false** |
| PASS_24H | `com.btydaily.norebang.pass.24hour` | 86400 | true | **false** |

**The commerce invariant holds exactly. No value differs.** Nothing was modified to make it match.

Migration ledger, read-only: fully paired through `20260814120000` (the 26M R3 guard), nothing
pending. BUILD 26N created no migration.

> **A 403 that was not a permissions fact.** Bare `supabase migration list --linked` returned
> `403 "Your account does not have the necessary privileges"`. That is the known wrong-credential
> signature, not an access-control finding: the bare CLI fell back to a stored login for a
> different account. Re-running through the `supabase-karaoke` wrapper — which injects the correct
> Keychain PAT — succeeded immediately. Recorded so it is never again written up as a permissions
> problem.

### 13.2 The gate pass came from the 15-grant cohort — recorded, not resolved

`e59e46a1` was created at `2026-08-12 18:29:33.853Z`, inside the window BUILD 26M §11 describes:
15 grants issued between `18:29:23.575Z` and `18:29:34.220Z` under the shared identifier `bty_mgr`,
**provenance UNRESOLVED**.

Current measured state of that cohort:

```
cohort            15   (18:29:23.575476Z .. 18:29:34.220047Z)
still untouched   13   AVAILABLE, updated_at = created_at
consumed           2   c81a120c  (BUILD 26M G9 reload proof, now EXPIRED)
                       e59e46a1  (BUILD 26N physical gates, now ACTIVE)
```

Three things must not be misread:

1. **This does not resolve their provenance.** Who issued them remains unknown; `bty_mgr` is a
   shared-passcode identity that structurally cannot name a person, and
   `timed_access_pass_audit.metadata` was NULL on all 15. **They are still not attributed to the
   Founder.**
2. **What IS attributable** is the *use*: the `SELECTED` and `ACTIVATED` rows above are the
   Founder's gate session on the device. Issue-time actor context remains absent.
3. **BUILD 26M is not rewritten.** Its §11 snapshot ("all 15 remain untouched") was accurate when
   measured; two have since been consumed by ordinary, documented use — one by 26M's own §7.3
   activation and one here. The change is the passage of time, not a correction, and it is recorded
   in this document rather than by editing a closed one.

A first measurement of this cohort returned **14**, not 15. That was a boundary artifact of the
query — an exclusive upper bound at `18:29:34` clipped the row created at `18:29:34.220`. Widening
the window returned all 15. Recorded because a count that disagrees with a closed build's record
must be diagnosed as a possible measurement fault before it is reported as a data discrepancy.

---

## 14. Explicit non-commerce statement

**BUILD 26N sells nothing and moves no money.**

No StoreKit import, no `.storekit` file, no `Product.products(for:)`, no
`Transaction.currentEntitlements`, no `Transaction.updates`, no `purchase()`, no restore, no price,
no currency, no purchase CTA, no App Store Connect product, no catalog mutation, no `is_active`
change, no entitlement issuance. The existing negative commerce contracts were **preserved, not
weakened**, and T8 adds new ones over the touched sources. G6 confirmed it on the device.

The disclosure explains **time**, never money. `karaoke_apple_purchases` is still empty and paid
transaction processing is still off.

---

## 15. Commits

```
implementation  a131d600071927cdedce894cafd58ce0762fa5a2
                feat(karaoke-ios): BUILD 26N — disclose timed-pass wall-clock duration
                native repo, 5 files, staged by explicit path

interim docs    c8fe504bf16cabb53e6e8c53fafca4e10381e873
                docs(karaoke): BUILD 26N — implemented, physical gates G1–G6 PENDING
                monorepo, docs-only — RETAINED, not amended

closure         docs(karaoke): BUILD 26N — PASS / CLOSED
                monorepo, docs-only, this document
```

Neither earlier commit was amended. The pending→closed transition is a **new** commit, so the
interval during which the gates were genuinely unrun stays visible in history. No `git add .` or
`git add -A` was used in either repository. BUILD 26M documentation was not rewritten.

---

## 16. Preserved pre-existing state

```
native   M BTYNorebangAdmin.xcodeproj/xcshareddata/xcschemes/BTYNorebangAdmin.xcscheme
           sha256 32b3247e521d95769aba3d0a407c449f38c82f3cee1fa7e1a5aff898f947aa1e
           VERIFIED IDENTICAL throughout — NOT modified, NOT cleaned, NOT staged
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

## 17. Deferred — untouched by BUILD 26N

None of the following is completed, advanced, or implied by this build:

- **Track B Slice 3** — server Apple transaction verification endpoint (26L §25)
- **App Store Connect product creation** — still zero IAP products; Product ID and purchase type are
  immutable once created, so this stays a deliberate, separately authorized console action
- **BUILD 18C G4** — grant `room_id`/`event_id` + auto-revert on event close
- **BUILD 18C G6** — promotional unactivated expiry (Welcome 30d / Referral 90d)
- **BUILD 18C G7** — promotional taxonomy / eligibility versioning
- **Pass issuance actor attribution** — `timed_access_pass_audit.metadata` is still unpopulated on
  the ISSUE path, and `bty_mgr` is still a shared-passcode identity that cannot name a person
  (26M §11). §13.2 above is a fresh reminder that this gap is still open.

---

## 18. What this build should be remembered for

- **Saying when something starts is not the same as saying what it costs.** The arming copy was
  accurate for two years and still left the Host with the wrong model, because the FREE meter
  standing next to it obeys the opposite rule. Correct sentences can still add up to a false one.
- **The gate that mattered was the one that checked the claim against reality.** T1–T8 prove the
  sentence ships; only G4 and G5 prove the sentence is *true*. Thirty-one seconds with nothing
  playing, and eighty-six more with the app closed, are what turned a constraint definition into
  evidence.
- **A test that fires on `$0` is a broken test, not a finding.** Two versions of the no-price
  assertion failed on correct code. The repair was to test the user-visible surface — the string
  literals — not to loosen the assertion until it went quiet.
- **Slice the source per surface.** A whole-file `contains` would have let one disclosure satisfy
  three cards at once, and every removal mutant would have survived.
- **Diagnose a surprising count before reporting it.** A global `ACTIVE 2` against 26M's
  account-scoped `1`, and a cohort of `14` against a recorded `15`, were both **measurement
  artifacts** — wrong scope and an exclusive bound. Either one, reported as a finding, would have
  manufactured a discrepancy in a closed build's record.
- **Separate authorized test mutation from implementation drift, explicitly.** This session did
  change production state: one pre-existing pass was armed and activated, and one song was played.
  Saying "no production mutation" would have been simpler and false.
