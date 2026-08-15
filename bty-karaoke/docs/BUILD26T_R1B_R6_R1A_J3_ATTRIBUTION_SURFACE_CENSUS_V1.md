# BUILD 26T-R1B-R6-R1A-J3 §A — attribution surface census

**Census complete. Placement NOT implemented. No build minted. 104 unchanged.**

§A requires this census *before* broad placement, and warns against classifying a surface merely
because it carries a `videoId`. That warning is load-bearing here: six surfaces carry one, and only
three have a live YouTube API presence.

## The discriminator, and why it is evidence rather than judgement

The schema answers it directly. `karaoke_user_saved_songs` stores:

```sql
-- Denormalized snapshots captured at save time (mutable across YouTube, so stored).
title_snapshot · artist_snapshot · thumbnail_url_snapshot
```

and `karaoke_requests` stores `youtube_title` / `youtube_channel_title` / `youtube_thumbnail_url`
the same way. Those surfaces render **BTY's own stored record of what was requested**, written once
and never refreshed from the API. A search results list, by contrast, renders **what the YouTube
Data API returned moments ago**. The first is BTY history that happens to be about a YouTube video;
the second is the API's presence in the product.

## Census

| # | Surface | Live API call | Renders | Mark required |
|---|---|---|---|---|
| 1 | **Native Guest search results** | `GuestRoomView.swift:995` → `api.guestSearch(...)` | live API items | **YES** |
| 2 | **Web Guest search results** | `src/app/r/[slug]/RequestForm.tsx` → `/api/youtube/search` | live API items | **YES** |
| 3 | **Web Host add-song sheet** | `src/app/r/[slug]/dj/DjAddSongSheet.tsx:49` → `/api/youtube/search` | live API items | **YES** |
| 4 | Saved songs ("내 노래") | none — reads `*_snapshot` columns | BTY stored record | no |
| 5 | Queue / request rows | none — reads `youtube_*` columns | BTY stored record | no |
| 6 | Resolved / history rows | none — same stored columns | BTY stored record | no |

**Three surfaces require the mark. Three carry a videoId and do not** — which is exactly the
distinction §A asked to be drawn rather than assumed. The host add-song sheet is the one a
guest-only reading would have missed: it is a *host* surface that performs its own API search.

## Placement contract for those three (agreed, not yet built)

```
asset        brand/youtube/source/developed-with-youtube-sentence-case-light.png
             OFFICIAL_UNMODIFIED · 700×250 · sha256 b0a3ef70…
             white ink, 17.4:1 on BTY navy
geometry     aspect ratio preserved; scaled only
spacing      ordinary BTY layout spacing — labelled BTY DESIGN SPACING, explicitly NOT an
             official YouTube clear-space measurement, because none is published for this lockup
prominence   subordinate to BTY's own headings; never combined with the BTY product name
placement    adjacent to the results list each surface renders
```

**No invented numbers.** Per the Founder's §A resolution this build does not claim a 20dp minimum,
triangle-derived clear space, or icon-height clear space for the *developed with YouTube* lockup —
none of those is established for it.

## Destination (§C) — proposed, for approval with the placement

```
native   https://www.youtube.com  via the existing SystemURLOpener external handoff
         (PlayHandoff's validated-URL pattern; no embedded player is invented for attribution)
web      https://www.youtube.com  ordinary navigation, target=_blank + rel="noopener noreferrer"
```

Individual result cards keep their own watch links, separate from the branding link — §C requires
that separation and the current code already has it.

A note on the web `rel`: `noopener` is a security requirement, and `noreferrer` on the *branding
link* does not affect the embedded-player Referer that §H measures, which is a different request.
Recorded so the two are not conflated during the RMF proof.

## What remains in J3

```
§B/§C  build the placement on surfaces 1–3          not started
§D     asset-integrity proof through the pipeline    not started
§E/§F  RMF repair + size pinning                     not started
§G/§H  Playwright size / overlay / Referer proofs    not started
§I     player parameter + autoplay audit             partially measured in R6-R1 (modestbranding,
                                                     single player) — not re-proven at runtime
§K–§N  build 105, physical matrix, notes, screenshots  gated on all of the above
```

## OUTPUT

```
ATTRIBUTION_SURFACES   3 require the mark (native guest search · web guest search · web host
                       add-song sheet); 3 videoId-bearing surfaces do NOT (saved songs, queue
                       rows, history) because they render stored BTY snapshots, not API data
ATTRIBUTION            HELD — placement not implemented
RMF_SIZE               HELD      RMF_OVERLAYS          HELD
RMF_REFERER            HELD      RMF_MODESTBRANDING    HELD
PRO_1_0                RETIRED_AS_PLAYBACK_AUTHORITY
FREE_PLAYBACK_COPY     RETIRED
STORE_SURFACE_1_0      RETIRED
BUILD                  104_UNCHANGED — correctly not minted; §K forbids 105 before
                       attribution and all four RMF gates pass
PHYSICAL_105_UI        HELD      APP_REVIEW_NOTES      HELD (v2 drafted)
PUBLIC_SCREENSHOTS     HELD      R6_R1A                HELD
CONTENT_RIGHTS         HELD — R6-R1B retention outstanding
```
