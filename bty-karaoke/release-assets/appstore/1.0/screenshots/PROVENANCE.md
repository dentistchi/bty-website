# App Store 1.0 — Public Screenshot Provenance

**Current deliverables: Release build 109**, Founder-approved after physical inspection
(`PHYSICAL_109_VISUAL = PASS`, BUILD 26T-R1B-R6-R1B-R13). **Not uploaded to App Store Connect.**

---

## Why build-106 assets were replaced

Builds 107 and 108 changed the visible Host and Guest compositions, and 107/108 also carried a
real Guest status-bar occlusion defect found by physical inspection — not by any test. The
build-106 captures were therefore no longer truthful product screenshots of the shipping binary.
They are preserved, not deleted, under `historical/build-106/`.

---

## Deliverables

The originals are RGB with **no alpha channel**, so no normalization, compositing, cropping,
resizing, retouching or re-encoding was performed. Each deliverable is a **byte-for-byte copy** of
its source, verified with `cmp`.

| Deliverable | Source | Dimensions | Format | Normalized | SHA-256 (source **and** deliverable) |
|---|---|---|---|---|---|
| `01-host-dj-queue.png` | `IMG_2422.PNG` | 1320×2868 | PNG, RGB, no alpha | NO | `032a9349a49df16a793c6ac56ba912c7fa971d07bebc06fb3b3978c5834f304d` |
| `02-guest-song-search.png` | `IMG_2423.PNG` | 1320×2868 | PNG, RGB, no alpha | NO | `bedf454dc825ad5dcd236bd8fe3d790ed7ed2ef1dfab122ec1d0f40fee781520` |
| `03-guest-turn-ready.png` | `IMG_2421.PNG` | 1320×2868 | PNG, RGB, no alpha | NO | `c427e58afdd541d5f69fe682be2be4d5fbeac807d846686a69380f1a52b443a4` |

**source == deliverable: YES** for all three (identical SHA-256; `cmp` reports no difference).

Untouched originals: `source/build-109/`.

### These are the ORIGINAL iPhone captures
The ChatGPT-uploaded copies (942×2048 RGBA) were **not** used and are not present in this tree.
Native dimensions 1320×2868 confirm these came off the device.

---

## Metadata review

Every file carries `sRGB`, `eXIf` (250 B), `pHYs` and `iTXt` (931 B) chunks. Both metadata-bearing
chunks were decoded rather than assumed:

- **eXIf IFD0 tags:** `ImageDescription = "Screenshot"`, `Orientation = 1`, `XResolution`,
  `YResolution`, `ResolutionUnit`, `DateTime`, `ExifIFDPointer`.
- **GPS IFD (0x8825): ABSENT** in all three. Spotlight also reports null latitude/longitude.
- **iTXt:** Adobe XMP containing only `exif:UserComment = "Screenshot"`, `xmp:ModifyDate` and
  `tiff:Orientation`.

No location, device serial, owner name, or account identifier is present. The only timestamp is
the capture time, which already matches the visible status-bar clock.

---

## Content verification (each image inspected, not inferred)

| Check | 01 Host | 02 Guest search | 03 Guest turn ready |
|---|---|---|---|
| Status bar clean, no occlusion | ✅ 8:36 | ✅ 8:37 | ✅ 8:36 |
| Header below the safe area (the R12 repair, at rest) | ✅ | ✅ | ✅ |
| "Developed with YouTube" | absent — **correct**, this is not a live-API surface | ✅ present | ✅ present |
| FREE / PRO / Access Status / Buy Pass / store UI | ✅ none | ✅ none | ✅ none |
| DEBUG / internal text | ✅ none | ✅ none | ✅ none |
| Private user information | ✅ none (guest name is literally "Guest") | ✅ none | ✅ none |
| Prior-app return indicator | ✅ none | ✅ none | ✅ none |

Composition matches the Founder-approved description for each slot: Host queue with
*No song is playing* / *Amazing Grace · Traditional · Guest* / Ready / Play First Song;
Guest clean search with *Pick your song for today* / Karaoke selected / live results;
Guest turn-ready with *Your turn is coming up* / Ready / *You're up very soon*.

---

## Historical

- `historical/build-106/` — the superseded build-106 deliverables and their originals.
  `01` `dc8b21f6…`, `02` `e7daf213…`, `03` `6149c244…`
- `historical/build-103/` — earlier assets, retained.

Superseded, never deleted: each remains the evidence of what a given build actually looked like.

---

## Holds

Not uploaded to App Store Connect. Build 109 not uploaded. No ASC metadata written, no Content
Rights interaction, no IAP activation, no Add for Review, no submission.
