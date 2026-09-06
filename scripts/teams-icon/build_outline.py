#!/usr/bin/env python3
"""
Build `teams/manifest/outline.png` from the CANONICAL BTY vector. Slice TQ-4.

★ WHY THIS SCRIPT EXISTS RATHER THAN A HAND-EDITED PNG.

The shipped outline icon passed every manifest check — 32x32, transparent, white, mark centred —
and still looked soft in the real Teams app bar on the Founder's iPhone. Manifest compliance and
optical quality are different properties, and only the first one was ever measured.

MEASURED on the shipped asset: of 453 visible pixels, exactly **12** were fully opaque and 441 were
semi-transparent — 36.75 anti-aliased pixels for every solid one, spread across 128 distinct alpha
values with an 81-pixel sub-alpha-32 halo. That is not an icon with an anti-aliased edge; it is an
icon made almost entirely OF edge. It is the signature of a raster that was resampled from another
raster (the 192px colour art), not of a vector rasterised once.

This script rasterises the three canonical trefoil lobes from the Founder's master
`BTY_Master_plain.svg` (vendored beside this file) directly, ONCE, by supersampling and
area-averaging. Same geometry, same brand mark — no redraw, no reinterpretation, no new logo. The result at the same mark width has 117 opaque pixels instead of
12, and a semi:opaque ratio of 1.86 instead of 36.75.

★ THE EXACT-MASTER APPROACH IS DEVICE-EXHAUSTED (TQ-4.2).

Three packages were published and looked at on the Founder's iPhone:

  1.0.6  the original asset — 12 opaque pixels of 453, essentially all anti-aliasing
  1.0.7  rasterised once from the master; edge-to-core 36.75 -> 1.90.        DEVICE: still muddy
  1.0.8  pixel-hinted, 22px box, weight corrected into the neighbour band.   DEVICE: still muddy

1.0.8 fixed apparent weight, edge-to-core AND optical box, and produced no device-level clarity.
At that point the remaining defect could no longer be rasterisation, resolution or size: it is that
three interlocking lobes, at 20-24px, MERGE. The crossings close up and the mark reads as one soft
mass. Preserving the master's geometry literally is what fails.

★ WHAT THIS DOES INSTEAD — OPTICAL SIZING, THE TYPOGRAPHIC KIND.

The master stays authoritative for the colour icon, the web and every large use. This file derives a
SMALL-SIZE COMPANION from it, by one deterministic operation:

    envelope    = closing(mask, R)        bridges the inter-lobe channels; outer silhouette intact
    internal_bg = envelope AND NOT mask   the enclosed holes AND the crossing channels, nothing else
    result      = mask AND NOT dilate(internal_bg, r)

It only ever REMOVES ink, and only ink that faces an internal opening. So the outer silhouette is
preserved EXACTLY, every internal opening and crossing widens by r, and strokes thin only on their
inner-facing side — reducing local thickness precisely where the loops collide. It is not a uniform
erosion, which thins the outside too and turns the mark skeletal.

★ WHY box 26 AND r 0.30, MEASURED NOT PREFERRED.

Opening the gaps inside 1.0.8's 22px box was tried first and cannot work: there is no room, so the
gaps only widen by breaking the rings. The working direction is the opposite of shrinking — a
LARGER box gives the structure room, and the inner-side opening pulls weight back down.

Across a box x radius sweep, r = 0.30 at box 26 gave the highest gap contrast (194 at 24px against
1.0.8's 183) while keeping the interlocking-ring topology intact. Stronger openings score WORSE:
r = 0.45 drops to one enclosed region at 24px and r = 0.65 to zero — the rings are breaking, which
is visible as a wiry, un-BTY mark. More opening is not monotonically better.

Apparent weight at 24px is 122 against a mock neighbour band of 83-117. That band is measured from
APPROXIMATED Activity / Chat / Files glyphs, not real Teams assets, and 122 is 4% over its top —
against 1.0.6 at 183 and 1.0.7 at 135. Closed rings were judged worth 4% on an approximate ceiling.

★ WHAT THIS STILL DOES NOT CLAIM. It does not claim the device will pass. 32x32 is Microsoft's
documented contract for the outline icon and this file stays inside it.
"""
import re, sys, os
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svg_path import parse  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BTY_Master_plain.svg")
TARGET = os.path.join(ROOT, "teams/manifest/outline.png")

ARTBOARD = 1024.0    # the master's viewBox; the frame path spans it, the lobes do not
CANVAS = 32          # Microsoft's required outline size. Not negotiable, not guessed.
MARK_W = 26.0        # optical box (TQ-4.2 B1); see above
R_ENVELOPE = 3.2     # canvas px — must exceed the widest inter-lobe channel so the closing bridges it
R_OPEN = 0.30        # canvas px — how far each INTERNAL opening is widened
SUPERSAMPLE_SS = 16  # hi-res factor; part of the reproducible-bytes contract
HINT_CONTRAST = 1.10 # coverage remap strength; 0 = plain area-average
FLATTEN_STEPS = 96   # segments per Bezier; part of the reproducible-bytes contract, do not lower

def canonical_lobes(svg_text):
    """
    The three knot paths from the Founder's master — selected by GEOMETRY, never by fill.

    ★ WHY NOT BY FILL ANY MORE.

    The earlier source (`public/brand/bty-knot-mono-white.svg`) marked the knot `fill="#FFFFFF"`
    and neutralised its frame with `fill="none"`, so picking the white paths happened to work. In
    `BTY_Master_plain.svg` EVERY element is `fill="white"` — the two background rects, the frame,
    and the knot alike. The old selector would match nothing here, and the obvious repair of
    "rasterise every path" would silently include the frame, which is a full-canvas square with a
    rounded-rectangle hole punched in it. The Teams icon would become a white plate.

    So the frame is identified by what it IS: a path whose bounding box covers essentially the whole
    1024x1024 artboard. The knot lobes each occupy a fraction of it. `<rect>` elements are ignored
    outright — a background plate is never part of a transparent outline icon.

    MEASURED: the three lobes that survive here are BYTE-IDENTICAL to the three the previous source
    supplied, so this changes the provenance of the geometry and not the geometry itself.
    """
    ds = re.findall(r'<path[^>]*\bd="([^"]+)"', svg_text)
    lobes, frames = [], 0
    for d in ds:
        subs = parse(d, steps=FLATTEN_STEPS)
        pts = [p for sub in subs for p in sub]
        if not pts:
            continue
        w = max(p[0] for p in pts) - min(p[0] for p in pts)
        h = max(p[1] for p in pts) - min(p[1] for p in pts)
        if w >= ARTBOARD * 0.95 and h >= ARTBOARD * 0.95:
            frames += 1          # the background/frame treatment — never the mark
            continue
        lobes.append(subs)
    if frames != 1:
        raise SystemExit("expected exactly 1 frame path, found %d — refusing to guess" % frames)
    if len(lobes) != 3:
        raise SystemExit("expected 3 canonical knot paths, found %d — refusing to guess" % len(lobes))
    return lobes


def _shift(a, s, axis):
    """Translate a boolean field, filling vacated cells with False (outside the mark)."""
    out = np.zeros_like(a)
    if s == 0:
        return a.copy()
    if axis == 0:
        if s > 0: out[s:, :] = a[:-s, :]
        else:     out[:s, :] = a[-s:, :]
    else:
        if s > 0: out[:, s:] = a[:, :-s]
        else:     out[:, :s] = a[:, -s:]
    return out


def _square_dilate(m, R):
    out = m
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for s in range(-R, R + 1):
            acc |= _shift(out, s, axis)
        out = acc
    return out


def _square_erode(m, R):
    out = m
    for axis in (0, 1):
        acc = np.ones_like(out)
        for s in range(-R, R + 1):
            acc &= _shift(out, s, axis)
        out = acc
    return out


def _disc_dilate(m, r):
    out = m.copy()
    R = int(np.floor(r))
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            if (dx or dy) and dx * dx + dy * dy <= r * r:
                out |= _shift(_shift(m, dy, 0), dx, 1)
    return out


def open_internal_negative_space(mask, ss):
    """The optical-sizing operation described at the top of this file."""
    R = int(round(R_ENVELOPE * ss))
    envelope = _square_erode(_square_dilate(mask, R), R)
    internal = envelope & ~mask
    if not internal.any():
        raise SystemExit("no internal negative space found — refusing to guess")
    return mask & ~_disc_dilate(internal, R_OPEN * ss)


def build(canvas=CANVAS, mark_w=MARK_W, ss=SUPERSAMPLE_SS, contrast=HINT_CONTRAST):
    lobes = canonical_lobes(open(SOURCE, encoding="utf8").read())
    pts = [p for path in lobes for sub in path for p in sub]
    x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
    x1, y1 = max(p[0] for p in pts), max(p[1] for p in pts)
    scale = mark_w / (x1 - x0)
    mark_h = (y1 - y0) * scale
    # PIXEL GRID: integer offsets, so the mark box starts on a pixel boundary rather than between two.
    ox, oy = round((canvas - mark_w) / 2.0), round((canvas - mark_h) / 2.0)

    big = Image.new("L", (canvas * ss, canvas * ss), 0)
    draw = ImageDraw.Draw(big)
    for path in lobes:
        for sub in path:
            draw.polygon([(((x - x0) * scale + ox) * ss, ((y - y0) * scale + oy) * ss) for x, y in sub], fill=255)

    mask = np.array(big) > 127
    mask = open_internal_negative_space(mask, ss)

    # ONE resample, area-average: alpha is exact coverage. No blur, no feather, no second pass.
    cov = mask.reshape(canvas, ss, canvas, ss).mean(axis=(1, 3))
    if contrast > 0:
        # HINT: resolve fractional coverage toward ink or paper instead of leaving it grey.
        cov = np.clip((cov - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0)
    rgba = np.zeros((canvas, canvas, 4), np.uint8)
    rgba[..., 0:3] = 255                      # pure white everywhere; Teams applies the tint
    rgba[..., 3] = np.round(cov * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


# ── RETIRED (Slice TQ-4.5) ────────────────────────────────────────────────────
# This script produced the 1.0.7, 1.0.8 and 1.0.9 outline icons. All three FAILED on the Founder's
# real iPhone, which is what established that the master's woven trefoil cannot be made legible at
# 20-24px by any transformation of itself. The shipped icon now comes from a Founder-selected
# small-size glyph via `export_s1.py`.
#
# The file is kept because the reasoning in it is the record of why this icon took five attempts,
# and deleting that would leave the next person to rediscover it. But it must never again overwrite
# an approved design, so the entry point refuses.
RETIRED = True

if __name__ == "__main__":
    raise SystemExit(
        "build_outline.py is RETIRED (TQ-4.5).\n"
        "It generated the 1.0.7 / 1.0.8 / 1.0.9 icons, all of which failed on device.\n"
        "teams/manifest/outline.png is now exported from the Founder-approved S1 glyph:\n"
        "    python3 scripts/teams-icon/export_s1.py"
    )
