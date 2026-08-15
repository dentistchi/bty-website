# App Store product-page screenshots — FINAL, Release build 106

**`PUBLIC_SCREENSHOTS = FINAL_RECAPTURED_NOT_UPLOADED` — 2026-08-15. Not uploaded to ASC.**

Captured on the physical iPhone from **Release build 106**, the build whose UI passed the physical
gate: FREE/PRO/store surface retired, `Waiting` rendering horizontally, and the official
*developed with YouTube* mark legible above live search results.

## The set

| Deliverable | Source | Captured | Content |
|---|---|---|---|
| `01-host-dj-queue.png` | `IMG_2408.PNG` | 12:36 | Host tab · BTY Demo Room · Ready *Amazing Grace* · Play First Song |
| `02-guest-song-search.png` | `IMG_2409.PNG` | 12:38 | Guest tab · LIVE · 0 songs waiting · Karaoke · **mark above results** |
| `03-guest-turn-ready.png` | `IMG_2407.PNG` | 12:35 | Guest tab · Your turn is coming up · Ready · **mark above live results** |

## Verification — every file

```
dimensions        1320 × 2868   native iPhone 17 Pro Max, an accepted 6.9" size
PNG colortype     2 (RGB, NO alpha)  →  ASC's alpha prohibition satisfied at source
normalization     NOT REQUIRED — unlike the earlier IAP asset, these arrived alpha-free
deliverable       BYTE-IDENTICAL to its source (same SHA-256), so "unmodified" is provable
                  rather than asserted
EXIF              ImageDescription/Orientation/DateTime only — NO GPS IFD, no Make/Model/Software
```

```
01-host-dj-queue.png      source == deliverable
  dc8b21f626afdd30cd20e81433d2b8f17f35b97d5dbad48144e94e69d30d1eb2
02-guest-song-search.png  source == deliverable
  e7daf2138ba6d83c3497996e2a276fb832812a0e1b4a7395df323c26351e7f15
03-guest-turn-ready.png   source == deliverable
  6149c244cbdbab81e523e3a8361b1eeac857faed81558839f98a1a8d81fb8c16
```

## Content checks — each image inspected, not assumed

```
prior-app return indicator   ABSENT — no "◀ btyARENA"; this is what disqualified the first attempt
top safe-area layout         normal on all three; none scrolled under the status bar
DEBUG / internal text        none
retired quota / pass UI      none — no FREE 15m, no PRO, no Access Status, no Buy a pass,
                             no product cards, no "not on sale", no 15-minute ceiling
private data                 none — the only name shown is the review account's own "Guest"
developed with YouTube       PRESENT on 02 and 03, above the live YouTube API results.
                             ABSENT on 01, correctly: the host queue renders BTY's stored
                             request snapshots, not live API data.
```

That last line is the census (`J3 §A`) showing up in the artifacts: the mark appears exactly where
the API has a presence and nowhere else, and the screenshots are consistent with the code.

## Historical assets preserved, not overwritten

```
historical/build-103/          the earlier approved set + its untouched sources
historical/build-103/source/
```

Build-103 captures predate the retirement and the attribution mark, so they could not be reused —
but they are evidence of an approved state and were moved, never deleted or overwritten in place.
The build-105 physical captures were rejected as product-page assets (return indicator, scrolled
safe area) and remain the Founder's own device evidence rather than repo artifacts.

## Not uploaded

Correct order remains: apply E1 to production under its own authorization, then the ASC metadata,
notes and screenshots. Until E1 is applied the shipped binary and the server contract disagree.
