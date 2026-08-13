# BUILD 26M — Timed Pass Continuation / Switching

**Status: PASS / CLOSED — 2026-08-13**

A Host holding an ACTIVE Timed Access Pass with too little time left for the next song could not
use the other passes they already owned. The pass they were holding was the only pass the product
would let them spend. BUILD 26M gives them a way across, and — after the Founder withdrew the
original forfeiture rule — it carries their remaining time with them.

The build took four revisions because the first three were each proven wrong by a physical device,
not by a test. That history is kept here in full; the intermediate failures are the useful part.

---

## 1. The defect

On a physical device: ACTIVE pass with **2m 01s** left, next song **3m 46s**. The server correctly
refused the start with `pass_insufficient`. The Host owned other passes. The product offered no way
to reach them, and the card told the Host to "pick a shorter one" while their unused passes sat
invisible behind it.

**Ratified model (Model B):** an explicit, confirmed switch that ends the running pass and arms
another. Not a silent swap, and not `/select` — switching ends something the Host is in the middle
of using, so it gets its own verb, its own confirmation, and its own copy.

---

## 2. Revision history — what each one got wrong

| Rev | Change | How it was proven wrong |
|---|---|---|
| **R1** | Switch with residual **forfeiture** | Founder withdrew forfeiture after physical use: destroying paid-for time to change passes is the wrong product. |
| **R2** | **Carryover** — residual MOVES to the target | Physical run exposed that switching *during playback* revoked the ACTIVE pass and moved all residual, leaving ACTIVE = 0 while the song kept playing. |
| **R3** | Switching **forbidden while a song is PLAYING**, server-authoritative | Physical G3 on build 93: the confirmation presented only "Switch and Keep My Time". No explicit Cancel was visible. |
| **R4** | Explicit **Cancel** in the confirmation (native-only) | — closed. |

R1's forfeiture evidence is **not rewritten**. It remains valid historical test evidence for the
rule that was in force when it was gathered.

---

## 3. R2 — the carryover contract (ratified)

> **Switching does NOT discard residual entitlement.** The authoritative remaining time on the
> current ACTIVE pass is **moved** to the target.

```
target effective window = base duration + carryover_seconds
```

The **base product duration stays canonical and is never inflated** — a 1-hour pass is always
`duration_seconds = 3600`. Carry lives in its own column, so "how much time is left" and "what
product did the Host buy" never get confused with each other.

`timed_pass_expiry_math_chk` enforces `expires_at = activated_at + (duration_seconds +
carryover_seconds)`, which is what makes the arithmetic non-bypassable rather than merely intended.

Carry is a **MOVE, never a COPY**: the target is assigned onto a row proven to hold
`carryover_seconds = 0`, so carry can never accumulate or exist twice.

**Live production examples:**

| Case | base | carry | effective window |
|---|---|---|---|
| FOUR_HOURS | 14400 | 242 | **14642** |
| ONE_HOUR | 3600 | 14405 | **18005** |
| R3 fresh gate | 3600 | 223 | **3823** |
| G10-C | 3600 | 535 | **4135** |

**Migration:** `20260813120000_karaoke_timed_pass_carryover_v1.sql`
**SHA-256:** `867fe03cd5d557e52ca57c584ed18c36cf9e0e574906a48e0656d1a8ec4fca67`

---

## 4. R3 — the playing-switch guard

Switching mid-song moved the entire residual to a pass that had not started, leaving the rest of
that song covered by nothing. The carryover arithmetic was right; the *permission* was wrong.

`switch_timed_access_pass` now refuses with `song_playing` when any room owned by the account has a
`playing` request. The API maps it to **409** (the request is well-formed; the account state simply
forbids it now). The refusal happens before every write in the function, so a refused switch
mutates nothing at all.

### Lock ordering — stated precisely

```
switch_timed_access_pass :  account lock  →  timed-pass lock
karaoke_begin_song_v2    :  account lock  →  room lock
```

The **shared account-level advisory lock, taken FIRST by both**, is what closes the race. The
timed-pass key alone would **not** exclude `karaoke_begin_song_v2` — a song start could commit
between the check and the revoke, reopening the exact gap being closed. Nothing acquires the
timed-pass key before the account key, so no lock cycle exists.

`select_timed_access_pass` is deliberately **not** guarded: arming coexists with an ACTIVE pass, the
playing song stays covered, and forbidding it would remove a harmless capability for no safety gain.

**Migration:** `20260814120000_karaoke_timed_pass_switch_playing_guard_v1.sql`
**SHA-256:** `283ecffadc59874727327fd483fa1299cab27c7d6d7d0cd99bb0b19d3dcbf966`

---

## 5. R4 — the explicit-Cancel native repair

### Root cause (not what it looked like)

Build 93 **already declared** a `.cancel` button, and its string resolved in both languages. The
failure was the presentation component: `confirmationDialog` renders its `.cancel` only where the
presentation has a slot for one — adapted as an anchored popover it **drops the button entirely**
and treats tapping outside as the cancel. So the one confirmation in the product that ends a pass
mid-use offered a single visible action, and backing out meant guessing at a gesture.

A second, independent weakness: the cancel label read **"Keep Current Pass" / "현재 이용권 유지"**,
which does not read as cancellation even when rendered.

### Repair

- `confirmationDialog` → **`.alert`**, which renders every button it is given, in every presentation
- decision extracted into **`PassSwitchConfirmation`** (a value type in `TimedPass.swift`) —
  **resolution consumes the pending target**, making Confirm and Cancel mutually exclusive and
  unrepeatable however the presentation delivers taps
- Cancel returns **no pass id**, so it has no argument with which to reach the network
- **system / tap-outside dismissal routes to cancel**, never to a switch
- explicit **`Cancel` / `취소`**
- **Confirm is the only call site of the switch callback** (exactly one, pinned by test)

Preserved unchanged: the carryover body and its server-derived total, `role: .destructive` on
Confirm, and the entire R3 playing guard.

### Verification

```
Host contract tests      2116 passed / 0 failed
Guest contract tests      854 passed / 0 failed
Debug build              BUILD SUCCEEDED
Release build            BUILD SUCCEEDED
Localization keys        420 intact; shipped bundle carries Cancel / 취소
Mutants killed           7 of 7
```

Mutant **M1 restores the exact build-93 defect** (`.alert` → `confirmationDialog`) and is caught.
The Debug/Release builds matter independently: the bare-swiftc suite does not compile SwiftUI
views, so it cannot catch a view-level compile error on its own.

**Native commit:** `9a2bc119015fa832972722ee3b4ae812e328014c`
**CFBundleVersion:** `94` · **MARKETING_VERSION:** `1.0`

> **Build 93 is burned** and must never be used as R4 evidence.

---

## 6. Server identity — two different things

| | Value |
|---|---|
| **Worker VERSION ID** (Cloudflare deployment identity) | `05067bbc-82b6-4be5-8a5a-13fcff6223cf` |
| **R3 served source/build identity** (git commit) | `712fe5895abbad7c259f8e19306f60167a6bcec1` |

These are **not interchangeable**. `712fe589…` is a git commit in this repository
(`fix(karaoke): BUILD 26M-R3 — refuse active-pass switch while song is playing`); it is **not** a
Worker version ID and must never be recorded as one. The live deployment at 100% traffic is
`05067bbc-…`, uploaded 2026-08-12T17:04:16Z and promoted 17:05:02Z.

**G10-B's carried-forward evidence is anchored to `05067bbc-82b6-4be5-8a5a-13fcff6223cf`**, and is
valid because **R4 was native-only** — no migration, no Worker deployment, no change to server
authority after the R3 G10-B proof.

---

## 7. Gate ledger

| Gate | Result | Evidence |
|---|---|---|
| **G1** | PASS | ACTIVE residual insufficient for the pinned long song; the alternative pass was surfaced in the same card that reported the shortfall |
| **G2** | PASS | Alternative-pass selection through the normal product path |
| **G3** | **FAIL on build 93 → PASS on build 94** | See below — a real gate failure |
| **G4** | PASS | source ACTIVE → REVOKED/`switched_pass`; target AVAILABLE → SELECTED; carry moved exactly once; target activation clock stayed NULL |
| **G5** | PASS | The pinned blocked request subsequently started through the normal product path |
| **G6** | PASS | SELECTED activation occurred at the actual song start |
| **G7** | PASS | expiry window = base duration + carryover, exactly |
| **G8** | PASS | exactly one ACTIVE, no residual SELECTED after activation |
| **G9** | PASS | Final build-94 physical reload — see §7.3 |
| **G10-A** | PASS | Build 94 physical UI while PLAYING — switch controls absent, explanatory copy visible |
| **G10-B** | PASS (carried forward) | See §9 |
| **G10-C** | PASS | See §7.2 |
| **Final activation sanity** | PASS | See §7.2 |

### 7.1 G3 — a real failure, recorded as one

The **build 93 physical gate failed**. The confirmation presented only "Switch and Keep My Time"
with no explicit Cancel affordance. This was not smoothed over, not reinterpreted as "tapping
outside counts", and not downgraded to a cosmetic issue. It blocked closure, produced revision R4,
and burned a build number.

On **build 94** (22/22 proof, read-only):

- the explicit **Cancel** button was **visibly observed** on the physical device
- pressing it was a **true no-op**: source stayed ACTIVE with carry 223 and identical
  `activated_at`/`expires_at`; target stayed AVAILABLE with carry 0; SELECTED remained 0;
  `switched_pass` audit stayed 4
- **every grant row other than the source was byte-identical** (SHA-256 over all columns), and
  **zero** pass-audit rows were written — a switch necessarily writes a SELECTED + REVOKED pair, and
  none appeared

### 7.2 G10-C and activation sanity

The **same pinned target `e6ff1a75`** (`58970c95-bb2e-4fbc-b29b-9080414fa767`) that the server
refused with `409 song_playing` during playback **succeeded once playback ended**. That pairing is
what proves the R3 guard is bound to **PLAYING state**, not to the pass or the account.

```
source  4b2da8ec   ACTIVE → REVOKED, revoke_reason = switched_pass
target  e6ff1a75   AVAILABLE → SELECTED, activated_at NULL, expires_at NULL
carried 535 s == floor(19:24:23.801Z − 19:15:28.401576Z)     ← authoritative remaining at commit
window  3600 + 535 = 4135 s
audit   exactly ONE host_switch pair, both rows sharing one timestamp (one transaction)
        switched_pass 4 → 5 · no duplicate switch · 53 grants, none created
```

The carried value is the source's authoritative remaining **at the commit instant** — not the
source's own `carryover_seconds` (223), which correctly did **not** propagate. Propagating it would
have been double counting.

**Final activation sanity** — the same grant SELECTED → ACTIVE on the next song start:

```
activated_at 19:20:42.290206Z  ==  request started_at 19:20:42.290206Z   (microsecond identical)
expires_at − activated_at = 4135 s = 3600 + 535        not 3600, not 4670
audit: SYSTEM/dj_start ACTIVATED SELECTED→ACTIVE
carry present exactly once in live entitlement state
```

### 7.3 G9 — final reload, and an honest note about which grant

The final build-94 reload proof (17/17) was performed on grant
**`c81a120c-6350-4ec9-82ea-f86bf95f3681` (`#9d116d4a`)**, **not** on `e6ff1a75`.

This must not be misrepresented. The sequence, from the audit trail:

```
2026-08-12 19:20:42Z  ACTIVATED  SELECTED→ACTIVE     e6ff1a75
2026-08-13 00:39:54Z  EXPIRED    ACTIVE→EXPIRED      e6ff1a75   ← natural expiry, revoke_reason NULL
2026-08-13 00:42:24Z  SELECTED   AVAILABLE→SELECTED  9d116d4a   ← ordinary /select, NOT a switch
2026-08-13 00:42:55Z  ACTIVATED  SELECTED→ACTIVE     9d116d4a
```

`e6ff1a75`'s 4135s window ran out at 20:29:37Z and the row flipped to EXPIRED by lazy expiry hours
later. `9d116d4a` was then armed by a **normal selection** — there is **no** `host_switch` audit
after G10-C — and activated by the next song start.

**`9d116d4a` is part of the G9 reload proof only. It is not part of the carryover switch proof.**
It carries `carryover_seconds = 0` and was never involved in a switch. It is also one of the 15
grants of unresolved provenance described in §11.

G9 proved: ACTIVE persisted across close/reopen, countdown persisted and matched server truth,
SELECTED = 0, no phantom armed pass, playback coherent, old source still REVOKED and not
resurrected, no AVAILABLE grant holding carry, commerce untouched.

### 7.4 Countdown investigation — DISPLAY GRANULARITY, NOT A DEFECT

A physical screenshot reading "1h 4m left" raised a suspected frozen countdown. It was not.

- **Server clock exact:** three samples, 27s elapsed → 27s decrease, monotonic, **zero drift**;
  `remainingSeconds` matched `expires_at − now` at every sample
- **Native ticker updates every second:** 1-second display task advancing from a *monotonic* anchor,
  re-anchored to server truth on every poll; it is suspended only by screen-left/background, and
  presenting the Access Status sheet does **not** suspend it
- **The formatter hides seconds at ≥ 1 hour, deliberately:**
  `allowedUnits = s >= 3600 ? [.hour, .minute] : (s >= 60 ? [.minute, .second] : [.second])`
- **The screenshot was mathematically correct:** at 12:25:20 PDT the true remaining was
  `1h 4m 17s`, which the formatter renders "1h 4m". Measured against the real formatter, the flip
  to "1h 3m" occurs at `3839s` — i.e. 12:25:37.29 PDT, **17 seconds after** the screenshot

Below 3600s the formatter emits seconds again and the display visibly ticks — subsequently confirmed
on the physical device.

---

## 8. R2 wrong-version deployment incident — disclosed

During the R2 deploy the promotion version ID was selected by a shell fallback
(`grep -B4 … | head -1`) instead of the value returned by `versions upload`. This promoted the
**wrong** Worker version to 100% traffic.

```
wrong version      82af291a…   promoted 2026-08-12 04:29:22Z
corrective version b6892130…   promoted 2026-08-12 04:30:05Z
exposure           ~43 seconds
```

The wrong version was an Aug 3 build. Caught by the immediate post-deploy probe and corrected.
**No proven data damage.** The incident is corroborated independently by the Cloudflare deployment
history, which shows both promotions 43 seconds apart.

### Procedural repair (permanent)

> The promotion version ID **MUST** be the exact value returned by `versions upload`.
> **No** grep, head, listing order, fallback, "first result", or "latest result" may select it.

---

## 9. G10-B — carried forward, with disclosed synthetic auth

G10-B proved the server refuses a **stale-client** switch during playback. It is carried forward
rather than re-run because **R4 was native-only and the server authority did not change** — same
Worker version `05067bbc-…`, same migrations, same RPC.

```
POST /api/host/timed-passes/switch   →   HTTP 409  {"ok":false,"error":"song_playing"}
```

Zero entitlement mutation: the **whole grants table byte-identical** (SHA-256 over every column of
all 38 rows as they stood then), the playing request byte-identical, `switched_pass` unchanged,
ACTIVE source not revoked, target still AVAILABLE with carry 0.

### Disclosed Founder-authorized harness artifact

**Harness session `5321ae4c-c46c-4159-b2db-7d24d4066c16`.**

**Why it existed:** `karaoke_host_sessions` stores only `sha256(token)`, so the device's real token
is unrecoverable, and the live web Host auth path was fail-closed. No genuine off-device Bearer
token was obtainable. Build 93's UI also removes the tap action entirely while playing, so the
device itself cannot originate a stale-client request — which is precisely what made this gate need
an off-device client.

Exactly **one** short-lived Host session was minted for the Founder-authorized gate.

- **The auth origin was synthetic. The refusal path was NOT.**
- The request travelled the real chain: **route → `authorizeHost` → `switchTimedPass` → RPC**
- **No direct RPC call was made.**
- Minting changed no entitlement state; the session was alive **~2 seconds**, then revoked
- Replaying the same token after revocation returned **`HTTP 401 {"error":"Unauthorized"}`** —
  the real proof it is dead, since `authorizeHost` re-resolves `status='active'` on every call
- Live session count returned to its pre-gate value

---

## 10. Commerce non-regression

```
karaoke_apple_purchases   0
paid grants               0
karaoke_product_catalog   3 rows
```

**Every** physical BUILD 26M gate used `MANUAL_PROMOTIONAL`, `is_paid = false` grants with no Apple
purchase linkage. **No paid commerce was exercised at any point.** The BUILD 26L commerce ledger
remains untouched and unproven in live purchase terms — as intended; it was built with zero live
purchase behaviour change.

---

## 11. Unrelated concurrent production mutation — provenance unresolved

Between **2026-08-12 18:29:23Z and 18:29:34Z**, **15 grants** were issued to the gate account by a
path unrelated to BUILD 26M.

```
ONE_HOUR · MANUAL_PROMOTIONAL · is_paid = false · carryover 0
issued_by_manager = bty_mgr · no Apple purchase linkage
15 audit rows, exactly 1:1 with the grants, action ISSUED, NULL → AVAILABLE
15 DISTINCT idempotency keys ⇒ 15 separate operations, not one deduplicated retry
all 15 remain untouched: updated_at = created_at, never selected/activated/revoked
```

**Provenance: UNRESOLVED.** The evidence proves only that they were issued through the manager path
under the **shared identifier `bty_mgr`**, which cannot distinguish who acted. These are **not**
attributed to the Founder. `timed_access_pass_audit.metadata` was **NULL on all 15**, and no table
records issue-time actor context.

Recorded as: **unrelated concurrent production mutation, provenance unresolved.**
These rows were **not** deleted, normalized, revoked, consumed, or cleaned up.

### Observability gap (not a closure blocker)

`timed_access_pass_audit.metadata` **exists** but the ISSUE path does not populate sufficient
actor/request context (person, session, IP, device, request id) for per-actor attribution. Worth
closing in future work; it did not block BUILD 26M.

---

## 12. Deferred — explicitly outside this build

**BUILD 18C G4 / G6 / G7 remain DEFERRED.** BUILD 26M did **not** complete them, and their deferred
state is **not** a BUILD 26M failure: the canonical BUILD 26M contract never required them. The
boundary is recorded here so a future reader does not mistake silence for completion.

---

## 13. Final production state (post-song, read-only, 19/19 clean)

```
playing (this account)      0
final request 71fae889      completed, completed_at 2026-08-13T00:52:20.977545Z
open metering segments      0 on this account
ACTIVE                      1  —  c81a120c-… (#9d116d4a)
SELECTED                    0  —  no resurrection
duration 3600 · carry 0 · window 3600 · activated/expires untouched by Song Done
server                      TIMED_ACCESS, remaining matches expires_at − now exactly
host_switch audit           none since the final activation
AVAILABLE                   14, max carry 0  ·  no live grant holds carry
grants total                53 — nothing created, revoked, or cleaned up
commerce                    0 purchases · 0 paid grants · catalog 3
```

The song was ended through the normal **Song Done** product path — `completed_at` is set and the
metering segment closed cleanly. It was **not** SQL-completed, and no pass state was hand-mutated.

The ACTIVE pass keeps burning wall-clock after the song ends. That is **by design**: a Timed Pass
burns wall-clock, unlike the FREE meter which only ticks during playback.

---

## 14. Migration identities

| Migration | SHA-256 |
|---|---|
| `20260811120000_karaoke_commerce_ledger_foundation_v1.sql` (BUILD 26L) | `4dc147d249e9d38853dc960ff20e368671889acb3951564ee3de7f3992884328` |
| `20260812120000_karaoke_timed_pass_switch_v1.sql` (R1 — superseded in part by R2) | `b89b616e44dad0463564e435f61bae91685b27f88a7df2a26bd18782b1e83556` |
| `20260813120000_karaoke_timed_pass_carryover_v1.sql` (R2) | `867fe03cd5d557e52ca57c584ed18c36cf9e0e574906a48e0656d1a8ec4fca67` |
| `20260814120000_karaoke_timed_pass_switch_playing_guard_v1.sql` (R3) | `283ecffadc59874727327fd483fa1299cab27c7d6d7d0cd99bb0b19d3dcbf966` |

R4 added **no migration**.

---

## 15. What this build should be remembered for

- **A confirmation with only one visible action is not a confirmation.** The Cancel button existed,
  was localized, and was declared correctly — and still never appeared, because the component gets
  to decide whether to render it. Declaring an affordance is not the same as shipping one.
- **A physical device found what 2091 passing tests did not.** Three of four revisions were driven
  by device evidence. The tests were not wrong; they were testing the layer the defect wasn't in.
- **Carry must move, never copy, and the base duration must stay canonical.** Keeping residual in
  its own column is what lets "time remaining" and "product purchased" stay separable under a CHECK
  constraint rather than under convention.
- **The account-level lock is what closes the race**, not the resource-specific one. A lock that
  names the thing you are protecting is not automatically the lock that excludes the writer you are
  racing.
- **Take the deploy identifier from the tool that produced it.** A 43-second wrong-version exposure
  came from a shell fallback picking a plausible-looking ID.
