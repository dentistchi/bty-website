# BUILD 26T-R1B-R6-R1A §J — UI census + brand variant decision

**Status: §1 and §4 CLOSED. §2, §5–§15 HELD — 2026-08-15.**

**No UI changed. No asset downloaded. No native build minted (104 unchanged). No production DB
touched — the validated E1 migration remains unapplied. No ASC write. Nothing uploaded.**

---

## §4 — ATTRIBUTION_VARIANT = **DEVELOPED_WITH_YOUTUBE**

The official criterion, quoted from the current Branding Guidelines:

> **YouTube logo** — *"identifies a specific application feature or component that uses YouTube
> content… You should use a YouTube logo if your application would still be useful if you removed
> its YouTube functionality."*
>
> **developed with YouTube** — *"indicate that your application is entirely dependent on curating
> YouTube content or on its integration with YouTube. You should use a **developed with YouTube**
> logo if removing YouTube functionality from your application would render the application
> nonfunctional or not useful."*

Measured against the product on all four axes §4 names, rather than decided from wording:

```
search provider     YouTube Data API v3 — and a grep for any alternative provider
                    (spotify|soundcloud|vimeo|dailymotion|apple music|deezer) returns NOTHING
result identity     39 references to the YouTube video id across domain/lib; the video id IS the
                    song key, including the queue's own partial unique index
karaoke content     every playable item is a YouTube video; there is no other content source
playback            web = YouTube IFrame Player API · native = handoff to youtube.com/watch

remove YouTube  →   no search, no song identity, no content, no playback.
                    What remains is an empty queue with nothing queueable.
```

That is the guideline's own test for **nonfunctional**, so the *developed with YouTube* mark is the
correct variant. **`ATTRIBUTION_VARIANT = DEVELOPED_WITH_YOUTUBE`.**

One consequence worth carrying into §5/§6: the guidelines treat this mark differently from the
standard logo — *"You can change the color of the **developed with YouTube** logo as long as the
logo content is in one single color"* — whereas the standard logo's colours may not be changed.
Single-colour recolouring is therefore permitted for BTY's dark surface, and **only** that.

## §1 — shipping string census, classified

Regex over the shipped String Catalog returned 101 candidates; that is a *catch*, not a retirement
list — it includes `passcode`/`password` false positives. Classified:

```
A  RETIRED_PLAYBACK_AUTHORITY      81   admission.* (duration.too_long, pass_insufficient ×4,
                                        upgrade_required ×6, final_song_grace, use_another_pass),
                                        guest.duration.too_long.*, guest.submit.error.song_too_long,
                                        pass.* (remaining/expiry/carryover/select/switch/wallclock),
                                        entitlement.* (Access Status chip + hint),
                                        playback.lease.* ("외부 재생 시간 … 남음"), usage.*
B  HISTORICAL_FINANCIAL_FACT       10   commerce.completed/deferred/processing, deletion.consequence.*
C  SECURITY / AUTH — keep          19   auth.*, manager.passcode.*, connect_room.passcode.*,
                                        error.unauthorized   ← the "pass" substring false positives
D  INTERNAL_ONLY                    1   debug.local_harness.notice
E  UNCERTAIN — store surface       11   commerce.title/buy/unavailable/pass.1hour|4hour|24hour/…
F  TRUTHFUL API QUOTA — keep        1   admission.duration.quota_exceeded  ← this is YouTube's own
                                        Data API lookup limit, NOT a BTY playback quota
C (INDEPENDENT_BTY_VALUE)           0   ← the finding: nothing in this set survives as
                                        non-YouTube product value, which is exactly why PRO retires
```

### The uncertain group, stated rather than decided

Category **E** is the timed-pass store surface. Build 104 already compiles the Buy control out of
Release, so nothing there is purchasable — but the rows, prices and "Passes are not on sale right
now." still render. With FREE/PRO retired as playback authority and no purchasable product, the
question *"should the store surface appear in 1.0 at all"* is a product decision, not an
engineering one. **Reported, not changed.**

## Why §2 was not implemented in this pass

Retiring category A is ~81 shipped strings plus their view code across the entitlement sheet, the
pass card, the usage banner, the admission-failure notices and the guest duration copy — and §2 is
explicit that hiding a message while another path still implies the old contract is not acceptable.
That is a full slice of its own, it mints build 105, and it must not be half-done: a partially
retired quota UI is exactly the "hide the error, leave the contract" failure §2 forbids.

## What remains, and what each is waiting on

```
§2   PRO/FREE playback UX retirement    ~81 strings + view code; mints 105
§5   official asset acquisition         download from the YouTube brand site, record provenance
§6   attribution placement              depends on §5's asset and its official layout rules
§8–10 RMF structural repair             overlays out of the player rect, min-size pin, drop
                                        modestbranding — self-contained web work
§11  runtime Referer proof               needs a real browser session. Playwright IS available in
                                        this repo (playwright.config.ts + e2e/), so this is
                                        achievable — it needs the app running with a live player
§12  DOM overlay geometry proof          same Playwright route; getBoundingClientRect intersection
§15  screenshot recapture                cannot be judged until the UI is final
```

## OUTPUT

```
PRO_1_0                RETIRED_AS_PLAYBACK_AUTHORITY in SQL (E1, local) · HELD in UI
FREE_PLAYBACK_COPY     HELD — 81 strings identified, none changed
ATTRIBUTION_VARIANT    DEVELOPED_WITH_YOUTUBE   ← decided, on the guideline's own test
ATTRIBUTION            HELD — asset not yet acquired
RMF_SIZE               HELD        RMF_OVERLAYS   HELD
RMF_REFERER            HELD        RMF_MODESTBRANDING  HELD
BUILD                  104_UNCHANGED
PUBLIC_SCREENSHOTS     RECAPTURE_REQUIRED — the guest search screen will gain the attribution
                       mark, so the approved capture is already known to be pre-final. Not
                       recaptured, and NOT retouched, until the UI is final (§15).
R6_R1A                 HELD
CONTENT_RIGHTS         HELD — API-data retention R6-R1B still outstanding
```
