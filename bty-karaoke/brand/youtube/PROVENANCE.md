# "developed with YouTube" — official brand asset provenance

**BUILD 26T-R1B-R6-R1A-J §E/§F. Acquired 2026-08-15T17:56:03Z.**

## Variant decision (§4, closed in the census doc)

`ATTRIBUTION_VARIANT = DEVELOPED_WITH_YOUTUBE`, on the guideline's own test — *"use a developed
with YouTube logo if removing YouTube functionality from your application would render the
application nonfunctional or not useful."* Removing YouTube from BTY Norebang leaves no search, no
song identity, no content and no playback: an empty queue with nothing queueable.

## Source

```
guideline page   https://developers.google.com/youtube/terms/branding-guidelines
official files   https://developers.google.com/static/youtube/images/
                   developed-with-youtube-sentence-case-light.png     ← acquired
                   developed-with-youtube-sentence-case-dark.png      ← acquired for comparison
acquired         2026-08-15T17:56:03Z, HTTP 200, direct from the guideline page's own links
```

Both official variants were downloaded so the choice could be made by looking rather than by
guessing at the filename.

## The two variants, measured

```
…-light.png   700 × 250, PNG, RGBA, 3,271 B
              sha256 b0a3ef7015b44b4ecb579248409a6435…
              ink is PURE WHITE (255,255,255) across all 5,976 mark pixels
              → the LIGHT-COLOURED mark, i.e. the one intended for DARK backgrounds

…-dark.png    700 × 250, PNG, RGBA, 3,271 B
              sha256 89ee273e5ba7963078a91b0e4ec2e3ce…
              near-black ink → for LIGHT backgrounds
```

"light"/"dark" names the **mark's own colour**, not the background it sits on — worth stating,
because picking by filename intuition selects the wrong one.

## Chosen shipping asset

```
developed-with-youtube-sentence-case-light.png        OFFICIAL_UNMODIFIED
```

BTY's surface is dark navy (`#0D1B2A`). Measured contrast of the white mark on it:

```
white (255,255,255) on navy (13,27,42)   →   17.4 : 1     (WCAG AA needs 4.5:1)
```

So the officially supplied variant already has ample contrast and fits the UI unchanged. Per §F's
ordering — *"If an official supplied asset already has sufficient contrast and fits the UI: prefer
it unchanged"* — **no recolouring is performed**, even though the guidelines would permit a
single-colour adaptation of this particular mark.

```
FINAL SHIPPING ASSET STATUS:  OFFICIAL_UNMODIFIED
```

## Handling rules observed

```
not redrawn · not recoloured · not distorted · geometry untouched · not recreated as SVG
not sourced from a third-party package · not a screenshot of the logo
resizing permitted only within the official sizing rules
```

The untouched source copies live in `brand/youtube/source/` and must not be edited. Any shipping
copy is a resize of that file, and its SHA-256 must be recorded next to it when it is created.

## Still to do (not done in this pass)

```
minimum-size + clear-space figures   the guideline page defers these to the YouTube brand site;
                                     they must be read there before a shipping size is fixed
shipping copy + placement            §G, per-surface, adjacent to each YouTube API implementation
link destination                     §H
brand tests                          §K
```
