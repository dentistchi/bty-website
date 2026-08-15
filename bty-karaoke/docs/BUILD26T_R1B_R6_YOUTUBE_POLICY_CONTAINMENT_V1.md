# BUILD 26T-R1B-R6 — YouTube Policy Containment / App Store 1.0 Free-Only

**Status: PART 1 CLOSED (containment shipped, build 104). PARTS 2–4 HELD.
Content Rights verdict: `E. MULTIPLE_YOUTUBE_COMPLIANCE_GAPS` — 2026-08-15.**

**No catalog write. No purchase. No IAP submission. No build upload. No ASC write.
`PASS_1H` / `PASS_4H` / `PASS_24H` remain `is_active = false`.**

---

## PART 1 — PAID PLAYBACK CONTAINMENT — CLOSED

### 1.1 The gate census (§C), classified

| Gate | Where | Class |
|---|---|---|
| FREE daily allowance vs `chargeSeconds` | `authorizeStart` → `insufficient_free` | **A. YOUTUBE_PLAYBACK_SPECIFIC** |
| Active pass window vs song end | `authorizeStart` → `pass_insufficient` | **A** |
| Selected-pass activation window | `authorizeStart` → `pass_insufficient` | **A** |
| `durationSeconds` unresolved → fail closed | `authorizeStart` → `duration_unknown` | **A** |
| Lease union / carryover math | `computeLeaseExtension` | **A** (it is the meter) |
| PRO entitlement | `authorizeStart` case `pro` | **A** (it exempts from the meter) |
| Event must be live; room must exist | start/dj routes | B. NORMAL_BTY_APP_FUNCTIONALITY |
| Queue position / one playing song | queue lifecycle | B |
| Host device token, account membership | `authorizeDj` / `authorizeAdmin` | C. SECURITY / AUTH |
| Guest capability token (ready/cancel) | request routes | C |
| Rate limits (HMAC IP pseudonym) | `makeLimiter` | C |

**The five explicit answers:**

```
1. What prevents song start when FREE 15 minutes are exhausted?
   authorizeStart returns insufficient_free (402 / pass_insufficient at the route). Nothing plays.

2. Any other way to play that same YouTube result through the BTY client afterwards?
   NO. Every playback path — native external handoff and the web player — is downstream of
   the same /dj/start authorization.

3. Is the FREE allowance itself measured using YouTube video duration?
   YES. chargeSeconds comes from computeLeaseExtension(..., durationSeconds, ...), and
   durationSeconds is the video's own length. MAX_LEASE_SECONDS is even pinned to the FREE
   daily limit.

4. Does any gate require entitlement solely because the next video is LONGER than the
   remaining allowance?
   YES — exactly that. 'free': chargeSeconds > remaining → refuse. 'pass_active':
   songEndMs > expiry → refuse. The whole video must fit.

5. Which gates survive if all pass/commerce code were removed?
   The FREE meter would survive, because it is not commerce — it is the same duration-based
   authorization with a free quota. That is why §E is a separate finding and not solved here.
```

### 1.2 What was implemented, and why compile-time

`karaoke_product_catalog.is_active = false` is a **server** state. An operator could flip it and
an already-shipped binary would begin selling, with no new App Store review. Containment therefore
had to be a property of the binary:

```
ReleaseCommerceCapability.paidPurchaseCompiledIn   #if BTY_PAID_PASSES → true, else false
BTY_PAID_PASSES defined for DEBUG ONLY             Release declares NO compilation conditions
PassPurchaseService.buy                            Product.purchase is INSIDE #else — not compiled
CommercePurchaseAuthority.authorize                build guard FIRST, before any server fact
CommerceStartAuthority.decide / take               same guard — the last door before a charge
TimedPassStoreView                                 Buy control ABSENT, not disabled
```

The architecture is **preserved, not deleted** — it still compiles and is still exercised under
the flag, so BUILD 26L–26T history and evidence remain intact and a future compliant monetization
can re-enable it deliberately.

**Two questions were split rather than one masking the other.** `authorize` / `decide` / `take`
answer *"may THIS BINARY charge anyone"*; `catalogGate` / `decideCatalogGate` / `takeCatalogGate`
expose the dual gate so the BUILD 26T-R1A/R2 pre-charge contract keeps its own tests instead of
being silently short-circuited by the build refusal. A guard asserts production never uses the
test seam.

### 1.3 Release artifact evidence — with a control that fires

```
CFBundleVersion 104

symbol                          DEBUG (paid compiled in)   RELEASE (1.0 submission)
StoreKit7ProductV8purchase                 2                        0
PurchaseResult                             6                        0
"8purchase" (mangled)                     24                        0
```

**The first control I tried proved nothing and is recorded because of it.** `nm -u | grep -i
purchase` returned **0 for both** configurations — it would have "confirmed" the gate while
measuring nothing at all. A negative gate is worthless without a control that fires; the symbols
above are the measurement that discriminates.

### 1.4 Tests (§J)

```
R6-1        this configuration has no paid purchase authority compiled in
R6-2 ×3     ACTIVE catalog + Apple offering + signed in + valid owner ref → STILL refused
            ← this is "an accidental is_active=true cannot make 1.0 purchasable"
R6-3 ×2     the just-in-time start authority refuses on the same grounds
R6-4        the build refusal PRECEDES every server / identity / in-flight check
R6-5..R6-7  Product.purchase is compile-gated, still present for a future build, inside #else
R6-8        the Buy button is inside the flag — absent in 1.0
R6-9..R6-11 the flag appears exactly once, on the DEBUG line; Release declares none
R6-12 ×5    commerce architecture preserved
26T-R1B-R6  production never uses the gate-only test seam
```

Mutation results:

```
capability leaks true into Release          kills 7
authorize() skips the build guard           kills 4
just-in-time authority skips the guard      kills 2
```

**That mutation run also caught a real defect in my own work**: the R6 block had been appended
*after* the suite's summary/exit, so its failures printed but were never counted — the first two
mutants killed **zero** tests until it was moved. Recorded because "the tests pass" was, briefly,
meaningless.

Regressions green: guest suite **984**, queue-contract **2771**. R5-R1 (guest name), R5-R2
(Karaoke default) and R5-R3 (results UX) all still pass; room/queue/guest-request contracts
unchanged. No production catalog write was issued and no historical purchase or grant row was
touched.

---

## PART 2 — FREE PLAYBACK METER — **REQUIRES A FOUNDER DECISION (HALT)**

**Finding: the free meter is the same duration-based authorization, minus the money.**
`chargeSeconds` is the video's length; exhausting the daily quota refuses playback of a YouTube
video. §E is explicit that this must not be left merely because no money changes hands, and it is
right: this is a Playback Integrity question (III.F.3's subject is *charging*, but the
"conditioning playback on something YouTube-specific" concern is the same family).

**Verdict: UNCERTAIN, leaning REQUIRES REMOVAL — and I am not deciding it.** Removing
duration-based start authorization entirely would delete the FREE-minutes product contract
(B2/BUILD 20M lease, usage banner, carryover, PRO exemption, the `/dj/usage` projection, and the
entire metering rationale). That is unambiguously a major product contract change, so per §E this
**HALTS** with the alternatives rather than coding one.

```
E1  REMOVE the meter entirely — playback is never conditioned on time. Maximum policy safety.
    Cost: the FREE/PRO distinction loses its mechanism; BUILD 20M's lease integrity work
    becomes inert; "what does PRO buy" needs a new answer before this can ship.

E2  KEEP the meter but stop denominating it in VIDEO DURATION — e.g. meter session wall-clock
    or song COUNT, neither of which is a property of the YouTube content. Playback would still
    be conditioned, but on a BTY resource rather than on the video's length.
    Cost: smaller code change than E1; still conditions playback, so it does not fully remove
    the Playback Integrity question.

E3  KEEP as-is for 1.0 on the basis that no charge occurs, and revisit with counsel.
    Cost: ships a known-uncertain interpretation, which is what §E warns against.
```

My recommendation is **E2 as the smallest change that removes the YouTube-specific coupling**, with
E1 as the conservative answer if counsel reads Playback Integrity strictly. **Founder decision
required before any code.**

---

## PART 3 — API DATA RETENTION — **NONCOMPLIANT (HALT on a migration)**

| Field | Table / cache | Source | Class | Timestamp | Refresh | Deletion | Stale in UI? |
|---|---|---|---|---|---|---|---|
| `youtube_video_id` | `karaoke_requests` | Data API v3 | Non-Authorized | `created_at` | none | account/room lifecycle only | n/a |
| `youtube_title` | `karaoke_requests` | Data API v3 | Non-Authorized | `created_at` | **none** | **none** | **YES** |
| `youtube_channel_title` | `karaoke_requests` | Data API v3 | Non-Authorized | `created_at` | **none** | **none** | **YES** |
| `youtube_thumbnail_url` | `karaoke_requests` | Data API v3 | Non-Authorized | `created_at` | **none** | **none** | **YES** |
| `search_query` | `karaoke_requests` | user input | not API Data | `created_at` | n/a | n/a | n/a |
| `video_id` | `karaoke_user_saved_songs` | Data API v3 | Non-Authorized | `created_at` | none | cascade on account delete | n/a |
| `title_snapshot` | `karaoke_user_saved_songs` | Data API v3 | Non-Authorized | `created_at` | **none** | cascade only | **YES** |
| `artist_snapshot` | `karaoke_user_saved_songs` | Data API v3 | Non-Authorized | `created_at` | **none** | cascade only | **YES** |
| `thumbnail_url_snapshot` | `karaoke_user_saved_songs` | Data API v3 | Non-Authorized | `created_at` | **none** | cascade only | **YES** |
| `duration_seconds` | `karaoke_video_durations` | Data API v3 | Non-Authorized | **no fetch timestamp at all** | **none** | **none** | n/a |
| `ytq:<query>` | Cloudflare KV | Data API v3 | Non-Authorized | KV TTL | expiry = refresh | automatic | no |

**Compliant:** the KV search cache (1-hour TTL) and `search_query` (not API Data).

**Noncompliant:** every stored title / channel / thumbnail, retained indefinitely with no refresh
and no expiry, against III.E.4's 30-day ceiling on Non-Authorized API Data. §F's warning was
warranted — **video IDs are not treated here as exempt**; they are listed as API Data and included
in the remediation scope pending an explicit policy basis either way.

**`karaoke_video_durations` has no fetch/refresh timestamp at all**, so its age is not merely
non-compliant — it is **unknowable**.

**Measurement gap, stated plainly: maximum age in production was NOT measured.** This session holds
no production database credential, and §B/§F authorize read-only inspection but the credential does
not exist here. The ages are therefore *unbounded by schema*, which is the finding; the *actual*
maximum is unmeasured and should be read off production before remediation is sized.

**Smallest migration (proposed, NOT applied) — HALT for approval:**

```sql
-- one column per table, unambiguous semantics: when this row's YouTube metadata was last
-- fetched from the Data API. NOT created_at (which means "when the request happened") and
-- NOT updated_at (which moves for unrelated edits).
alter table public.karaoke_requests
  add column if not exists youtube_metadata_fetched_at timestamptz;
alter table public.karaoke_user_saved_songs
  add column if not exists youtube_metadata_fetched_at timestamptz;
alter table public.karaoke_video_durations
  add column if not exists youtube_metadata_fetched_at timestamptz;
```

Backfill must **not** invent a value — leaving it NULL means "provenance unknown", which is the
truth for existing rows and lets a sweeper treat them as due for refresh-or-clear. The sweeper
(refresh from the API, or null the metadata and keep the ID) is a follow-up slice, not this one.

---

## PART 4 — BRANDING / RMF — **GAPS**

**Compliant / no gap found:**

```
official IFrame Player API on web (no custom player, no stream extraction)
native playback opens the real YouTube page — the strongest possible attribution
player error 101/150/100 handled honestly (embedding disabled / removed)
no ads on or around YouTube content · no watch incentives
no audio/video separation
privacy policy and terms disclose YouTube API Services use and link YouTube ToS
```

**Gaps:**

```
G1  NO visible "YouTube" source attribution on the guest search-results surface. Results show
    title / channel / thumbnail / duration with no indication the data or the video comes from
    YouTube. RMF and Branding Guidelines expect the source to be identifiable where API data is
    displayed. Smallest fix: a per-surface attribution line; per-result if required.
G2  `modestbranding: 1` is DEPRECATED and no longer removes branding. Nothing should depend on
    it; it should be removed or knowingly retained as inert.
G3  Embedded-player size and the overlay prohibition are NOT verified. RMF requires a minimum
    player size and forbids overlays/frames in front of any part of the player, including
    controls. The player surface has not been measured against either.
G4  HTTP Referer / app-identifier behaviour not audited.
G5  "Made For Kids" handling not audited for embedded playback.
```

Per §G, **no visual branding was changed** — the gaps are reported, not patched.

---

## PART 5 — CONTENT RIGHTS

# `E. MULTIPLE_YOUTUBE_COMPLIANCE_GAPS`

The three outcomes are kept separate exactly as §H requires:

```
1  PAID PLAYBACK CONTAINMENT      CLOSED  — build 104, mechanically enforced, mutation-tested
2  YOUTUBE API DATA / RMF         OPEN    — Part 3 (retention) and Part 4 (branding/RMF)
3  ASC CONTENT RIGHTS             HELD    — not touched, and must stay untouched
```

Closing the paid-pass containment removed the *charging* collision (III.F.3 / III.G.1) from the 1.0
submission. It did **not** make the attestation supportable: the free meter still conditions
playback on video duration (Part 2), stored API Data still exceeds the 30-day ceiling with no
refresh provenance (Part 3), and source attribution plus the RMF player review are open (Part 4).

**Do not check the ASC Content Rights box.**

---

## Founder decisions required

```
1  Part 2 — choose E1 / E2 / E3 for the free playback meter        (blocks a compliant 1.0)
2  Part 3 — approve the three-column migration + a refresh sweeper (blocks rights attestation)
3  Part 4 — approve an attribution surface + an RMF player review  (blocks rights attestation)
```

Build 104 is installed on the device and **not uploaded**. Nothing added for review, nothing
submitted, no IAP submitted, `PASS_1H` / `PASS_4H` / `PASS_24H` inactive.
