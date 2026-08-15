# BUILD 26T-R1B-R5-R4 — Content Rights Preflight

**Verdict: `B. RIGHTS_ATTESTATION_NOT_SUPPORTED` — 2026-08-15.**

**No ASC Content Rights value changed. No code changed. No catalog activation. No build upload.
No submission. `PASS_1H` inactive.**

This compares the shipping implementation against the **current published** YouTube API Services
Terms, Developer Policies and Required Minimum Functionality, fetched during this preflight rather
than recalled. It is an engineering-to-policy comparison, **not legal advice** — the resolution
routes in §7 include one that only YouTube can grant and one that a lawyer should review.

> The attestation in question is: *"Yes, it contains, shows, or accesses third-party content, and I
> have the necessary rights."* The first half is plainly true. **The second half is what fails**,
> and it fails on the paid configuration being submitted, not on using YouTube at all.

---

## 1. The finding in one paragraph

BTY Norebang plays YouTube videos, and the 1h/4h/24h passes are what permit a song to start once
the daily free seconds run out. The meter is denominated in **the video's own duration** —
`authorizeStart` refuses when `songEndMs > pass expiry` or when `chargeSeconds > remainingFree`. On
the web surface the video plays in an **official embedded YouTube IFrame player**. The Developer
Policies say, verbatim: **"API Clients must not charge users to watch content in an embedded
YouTube player."** (III.F.3) and prohibit selling "access to any components of YouTube API Services
unless you obtain YouTube's prior written approval" (III.G.1.b). Selling timed playback allowance,
priced by the second of YouTube content, is the thing those clauses name.

---

## 2. §1 — Every third-party content/service in the shipping path

| Role | Provider | How it is used | Where |
|---|---|---|---|
| Search | **YouTube Data API v3** | `GET /api/youtube/search?q=&style=` → server-side call, API key held server-side and never exposed to a client | server |
| Metadata | **YouTube Data API v3** | videoId, title, channelTitle, thumbnail URL, duration | server |
| Thumbnails | **`img.youtube.com` / `i.ytimg.com`** | image URLs rendered directly by the device/browser; never re-hosted | client |
| Playback (web) | **YouTube IFrame Player API** | `https://www.youtube.com/iframe_api`, one `YT.Player`, `loadVideoById` | web `/r/[slug]/player` |
| Playback (iOS) | **youtube.com, externally** | `PlayHandoff` builds `https://www.youtube.com/watch?v={id}` and hands off to the system opener | native |
| Auth | Apple, Google Sign-In | identity only, no YouTube scopes | both |
| Infrastructure | Cloudflare, Supabase | hosting, KV cache, database | server |

No other content provider. No music/lyrics/audio source of any kind besides YouTube.

## 3. §2 — YouTube specifically

```
YouTube Data API v3            YES — search + metadata, server-side key
YouTube IFrame Player API      YES — the WEB player surface (/r/[slug]/player)
                               playerVars: autoplay 1, playsinline 1, rel 0, modestbranding 1
                               error 101/150/100 handled (embedding disabled / removed)
native embedded player         NO  — 0 references to WKWebView / SFSafariViewController
playback location              WEB: inside the app, in YouTube's own embedded player
                               iOS: HANDED OFF externally to YouTube; the app never plays it
download / proxy / re-host     NONE
transform / re-encode          NONE
audio separated from video     NONE — III.I.7 and III.I.8 are respected
stream interception            NONE — no ytdl-style extraction anywhere in the tree
```

**What is stored** (`karaoke_requests`, `karaoke_user_saved_songs`): `youtube_video_id`,
`youtube_title`, `youtube_channel_title`, `youtube_thumbnail_url`, and for saved songs a
title/artist/thumbnail snapshot. Titles are **displayed**, and a display helper splits a raw title
for presentation; the stored value is not rewritten to misattribute anything.

**Caching**: the KV search cache is keyed by biased query with a **1-hour TTL** — comfortably inside
III.E.4's 30-day ceiling and inside YouTube's own caching expectations.

**Attribution/branding**: the web player is the official IFrame player with `modestbranding: 1` and
`rel: 0`; the app does not draw its own controls over it. Native shows title/channel/thumbnail and
opens the real YouTube page for playback. See §6 for two branding items to verify separately.

## 4. §3 — The monetization boundary, stated exactly

This is the decisive section, so it is quoted from the domain rather than described.

`src/domain/playback-lease.ts` → `authorizeStart(...)`:

```
'pro'            → authorized (unlimited)
'free'           → chargeSeconds > remainingSeconds        → REFUSED  'insufficient_free'
'pass_active'    → songEndMs > pass expiry                 → REFUSED  'pass_insufficient'
'pass_selected'  → songEndMs > now + pass duration         → REFUSED  'pass_insufficient'
```

and `computeLeaseExtension` derives `chargeSeconds` from **`durationSeconds` — the length of the
YouTube video itself**.

Answering the four questions as asked:

```
What does a paid pass unlock?
    The ability to START a song, and to keep starting songs, for a wall-clock window.
    Denominated in seconds of video playback.

Does a free / inactive user still get the same third-party playback?
    ONLY within the daily free allowance. Once it is exhausted, /dj/start returns
    402 pass_insufficient (or insufficient_free) and NO video plays — web or native.

Does a pass gate YouTube audiovisual playback itself?
    YES. That is precisely and only what it gates.

Or does it charge for BTY functionality independent of third-party content?
    NO. The room, queue, QR, guest requests, saved songs and history all keep working
    with no pass. The single thing the money buys is playback time.
```

**There is no independent-value story available here.** The paid unit is the video.

## 5. §4–5 — The legal basis, compared against the current documents

### 5.1 What the terms DO grant

The YouTube API Services Terms grant a licence to use the API Services and the embedded player in
a compliant API Client. Sections 16.2/16.3 are explicit that this is a *narrow* grant — "no rights
or licenses are granted to reproduce or distribute audiovisual content". BTY reproduces and
distributes nothing, so the search, metadata, thumbnail and playback-handoff uses sit inside the
grant.

### 5.2 The two clauses the paid configuration collides with

**Developer Policies III.F.3 — verbatim:**

> **"API Clients must not charge users to watch content in an embedded YouTube player."**

The web surface is an embedded YouTube player. Once free seconds are gone, a pass is what lets the
video start. That is charging a user to watch content in an embedded YouTube player. The stated
exception in III.F.3 covers functionality "not specific to YouTube API Services, such as login or
age verification" — a paid allowance **measured in seconds of the video** is specific to watching
the content, and does not fit it.

**Developer Policies III.G.1 — verbatim in relevant part:**

> Developers may not "**sell, lease, or sublicense YouTube API Services or audiovisual content**",
> nor "**sell YouTube API Services or access to any components of YouTube API Services unless you
> obtain YouTube's prior written approval**".

This one reaches the **native** surface too, where III.F.3's "embedded player" wording does not
literally apply because playback is handed off to YouTube. The product still sells timed access to
a capability whose unit of account is YouTube playback, and the search/metadata that makes it
usable is API Data.

**III.G.2 does not rescue it.** The permitted commercial uses are selling the API Client itself,
ad-enabled clients, and promoting your own uploads. Selling an API Client would be selling the app
(a one-off app price, or a subscription to BTY features) — not selling playback time. The
ad-permission in III.G.1.d carries an independent-value test that §4 shows is not met.

### 5.3 Where the implementation is already clean

Recorded so the remediation is not scoped wider than it needs to be:

```
server-side API key, never exposed to a client                    ✓
no download, proxy, re-host, re-encode or stream extraction       ✓
audio never separated from video (III.I.7 / III.I.8)              ✓
official IFrame player on web; external handoff on iOS            ✓
search cache 1h TTL, well inside III.E.4's 30 days                ✓
no ads placed on or around YouTube content                        ✓
no incentives/rewards for watching (III.F.3 incentive ban)        ✓
public privacy policy discloses the YouTube API Services use      ✓
```

## 6. Two secondary items, flagged not concluded

Neither changes the verdict; both should be checked when the primary issue is resolved.

1. **API Data retention beyond 30 days.** III.E.4 caps stored API Data at 30 calendar days.
   `karaoke_requests` and `karaoke_user_saved_songs` keep `youtube_title`, `youtube_channel_title`
   and `youtube_thumbnail_url` indefinitely as event history. The usual remedy is to keep the
   **video ID** (an identifier, retained) and let the cached metadata expire or refresh inside the
   window. This is a data-retention fix, not an architecture one.
2. **Player-overlay and branding review (RMF).** RMF forbids overlays, frames or visual elements
   in front of any part of the embedded player, requires a minimum player size, and forbids player
   modifications. Also note `modestbranding` has been deprecated by YouTube and no longer removes
   branding, so nothing should depend on it. The player surface should be reviewed against RMF
   directly.

## 7. §Verdict — `B. RIGHTS_ATTESTATION_NOT_SUPPORTED`

Not because YouTube is used, and not because a key works — the Founder's warning was the right one.
Because the **submitted configuration** (the app plus three IAPs whose only function is to lift a
playback gate) is charging users for YouTube playback, and the terms that grant the right to use
YouTube at all prohibit exactly that.

An attestation of "I have the necessary rights" made while the monetization contradicts the licence
granting those rights would not be truthful.

> **Timing nuance the Founder should hold onto.** In *today's* production state the verdict would
> be different: `PASS_1H` is inactive, nothing is purchasable, and a free daily allowance is not a
> charge. The problem is not the live service — it is what is about to be submitted.

### The smallest resolutions, in ascending cost

**R1 — Decouple the meter from the content (smallest architectural fix).**
Stop denominating the paid unit in video seconds, and stop letting entitlement decide whether a
video may start. Sell BTY's own service instead — room capacity, concurrent guests, event history,
branding, saved-song library, multi-room — and let playback stay available to everyone. Concretely:
`authorizeStart` must not return `pass_insufficient` / `insufficient_free` as a *playback* refusal.
This is the only route that removes both III.F.3 and III.G.1 exposure without asking anyone's
permission. It is also a real product change: playback time is currently the entire value of a
pass, so pricing and positioning move with it.

**R2 — Obtain YouTube's prior written approval.** III.G.1.b names this route explicitly for selling
access. It changes no code. It is not in BTY's gift and should not be assumed.

**R3 — Ship without paid passes.** Remove the three IAPs from the submission and keep the free
allowance. Attestation becomes supportable immediately; revenue does not exist.

### What this preflight recommends before any ASC Content Rights write

```
1  do NOT set Content Rights to "I have the necessary rights" in the submitted configuration
2  decide between R1 / R2 / R3 — it is a product-and-legal decision, not an engineering one
3  have counsel review this comparison; III.F.3 and III.G.1 are quoted verbatim above
4  fix the 30-day API Data retention item (§6.1) regardless of which route is chosen
5  review the web player against RMF (§6.2) regardless of which route is chosen
```

Also worth stating plainly: **this reaches further than the ASC checkbox.** The same finding bears
on whether the three IAPs should be submitted at all, which is upstream of BUILD 26T-R2/R3
activation. Activating commerce would move the violation from "about to be submitted" to "live".

---

**BUILD 26T-R1B-R5-R4 — `B. RIGHTS_ATTESTATION_NOT_SUPPORTED`.**
No ASC write, no code change, no activation, no upload, no submission. `PASS_1H` inactive.
