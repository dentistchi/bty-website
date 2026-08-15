# BUILD 26T-R1B-R6-R1A-J2 §A — brand spec gate: **HELD**

**Nothing was changed. No UI retired, no mark placed, no build minted, no production write.**

§A is a gate: fix the rendered logo dimensions only from the *current official* specification for
**the exact "developed with YouTube" mark**, and *"if the live official specification cannot be
resolved unambiguously: HELD on shipping placement rather than guessing."* It does not resolve.

## What was attempted, and what each returned

```
1  developers.google.com/youtube/terms/branding-guidelines
     → "Any YouTube logo or YouTube Icon that you display must meet the minimum size requirements
        provided on the YouTube brand site."
     It DEFERS the figures. It does not state them.

2  the three brand-site URLs the guidelines link to
     www.youtube.com/yt/brand/using-logo.html   HTTP 200 → https://brand.youtube/
     www.youtube.com/yt/brand/downloads.html    HTTP 200 → https://brand.youtube/
     www.youtube.com/about/brand-resources/     HTTP 200 → https://brand.youtube/
     All three collapse to one destination.

3  brand.youtube
     A JavaScript-driven asset browser. Extraction yields asset FILENAMES and thumbnails only —
     logos, icons, colour variants, podcast badging, naming, swag — and no specification text:
     no minimum size, no clear space, no aspect-ratio rule, no background restriction.

4  targeted search restricted to official domains
     Returns figures — a 20dp/20px digital minimum, and clear space "equal to or greater than the
     height of the icon" — but they are stated for the **YouTube Logo / Logo Icon**, and the
     result set mixes official pages with third-party videos.
```

## Why (4) is not good enough to ship on

The figures found describe the **YouTube logo and logo icon**. The mark BTY must display is the
different **developed with YouTube** lockup — a wordmark-plus-logotype whose proportions are not
the icon's, and whose clear-space rule ("equal to the height of the icon") does not have an obvious
referent on a lockup that is mostly text.

Applying an icon's minimum to a different mark is precisely the inference §A forbids, and it is the
same conflation §G separately warns about ("do not confuse logo minimum size with player minimum
size"). The 700×250 source PNG cannot supply it either — §A rules that out explicitly.

So the honest state is: **the numbers exist somewhere official, and I could not reach them from
here.**

## What this blocks, and what it does not

```
BLOCKED   §E placement (a rendered size cannot be fixed without the minimum)
          §I brand tests 5 and 6 (minimum size, clear space) have nothing to assert against
          §L build 105 as specified — it is expected to ship the mark
          §M physical proof item "mark present, correct appearance/clear space"
          §N final screenshots — they must show the final branding

NOT BLOCKED (but deliberately not landed alone, see below)
          §B/§C Category A + E retirement — it depends on no brand figure
```

## Why the retirement was not landed on its own

§B/§C could technically proceed. It was not started because the Founder's own framing governs:
*"EXECUTE the remaining §J body as ONE complete shipping-contract slice. Do not land or commit a
user-visible partial retirement state."* Landing the retirement now would mint build 105 whose
§M matrix explicitly requires observing *"Developed with YouTube mark present where expected"* —
an item that cannot pass while §A is held. That is a half-landed slice by the Founder's own
definition, and a build 105 that has to be superseded immediately.

## What resolves this — any one is sufficient

```
1  the Founder opens brand.youtube in a real browser and supplies the developed-with-YouTube
   minimum size and clear-space rule (a screenshot of the spec panel is enough)
2  a direct URL to the specification page/PDF that states it for THIS mark
3  Founder authorization to adopt a stated, conservative interpretation — e.g. treat the
   lockup's minimum height as the icon rule's 20dp applied to the lockup's YouTube logotype,
   with clear space equal to that logotype's height — recorded as an ASSUMPTION rather than as
   a measured official figure
```

Option 3 is available immediately and is honest as long as it is labelled an assumption; §A's bar
is that it must not be *presented* as the official rule.

## OUTPUT

```
BRAND_MIN_SIZE_CLEAR_SPACE   HELD  ← the gate
ATTRIBUTION                  HELD  (placement blocked by the gate)
PRO_1_0                      HELD  (SQL retired locally; UI not landed)
FREE_PLAYBACK_COPY           HELD
STORE_SURFACE_1_0            HELD
APP_REVIEW_NOTES             v2 drafted, not final — it must be re-read against a shipping UI
                             that does not exist yet
ATTRIBUTION_VARIANT          DEVELOPED_WITH_YOUTUBE
ATTRIBUTION_ASSET            PASS — OFFICIAL_UNMODIFIED (acquired, provenance recorded)
RMF_SIZE / OVERLAYS / REFERER / MODESTBRANDING    HELD
BUILD                        104_UNCHANGED
PHYSICAL_105_UI              HELD
PUBLIC_SCREENSHOTS           HELD — FULL_RECAPTURE_REQUIRED once the final UI exists
R6_R1A                       HELD
CONTENT_RIGHTS               HELD — R6-R1B API-data retention outstanding
```
