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

★ WHY THE FOOTPRINT SHRANK (TQ-4.1) — AND WHY THE EARLIER REASONING WAS WRONG.

TQ-4 kept the mark at the shipped 26x24 footprint and argued the measurements refused shrinking:
at 24px a 23px mark left the same one-pixel channels as a 25.5px one, so it "bought nothing".
Published as 1.0.7 and looked at on the real device, that reasoning FAILED. The icon changed
rendering state and still read muddier than Activity / Chat / Files.

What the earlier analysis never measured was apparent WEIGHT against the icons beside it. Measured
at 24px in ink pixels: Activity 83, Chat 104, Files 117 — and BTY 1.0.6 at 183, 1.0.7 at 135. The
mark was simply heavier than its neighbours, and a heavier mark of three interlocking rings turns
into a mass rather than a symbol. At a 22px optical box it lands at 108, inside the neighbour band.

★ WHAT PIXEL HINTING IS HERE, AND WHAT IT IS NOT.

Not a hinting engine. Two deterministic steps: the mark box is placed on INTEGER pixel boundaries
so extrema fall on the grid rather than straddling it, and coverage is then remapped around the
0.5 midpoint so fractional pixels resolve toward ink or paper instead of sitting grey. Geometry is
untouched — every curve is still the master's, to the character.

The edge-to-core ratio falls from 1.90 (1.0.7) to 0.55, with all four enclosed negative regions
still intact at 24, 22 and 20px.

★ WHAT THIS DOES NOT CLAIM. It does not claim to fix the device. A DPR-3 app bar renders around 72
physical pixels from a 32px asset, so some resampling softness is structural and outside this
file. 32x32 is Microsoft's documented contract for the outline icon and is not negotiable here.
"""
import re, sys, os
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svg_path import parse  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BTY_Master_plain.svg")
TARGET = os.path.join(ROOT, "teams/manifest/outline.png")

ARTBOARD = 1024.0    # the master's viewBox; the frame path spans it, the lobes do not
CANVAS = 32          # Microsoft's required outline size. Not negotiable, not guessed.
MARK_W = 22.0        # optical box (Slice TQ-4.1); see "WHY THE FOOTPRINT SHRANK" above
SUPERSAMPLE_SS = 16  # hi-res factor before the single area-average
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

    # ONE resample, area-average: alpha is exact coverage. No blur, no feather, no second pass.
    px = big.load()
    alpha = Image.new("L", (canvas, canvas), 0)
    ap = alpha.load()
    for cy in range(canvas):
        for cx in range(canvas):
            hit = 0
            for sy in range(cy * ss, (cy + 1) * ss):
                for sx in range(cx * ss, (cx + 1) * ss):
                    if px[sx, sy] > 127:
                        hit += 1
            cov = hit / float(ss * ss)
            if contrast > 0:
                # HINT: resolve fractional coverage toward ink or paper instead of leaving it grey.
                cov = min(1.0, max(0.0, (cov - 0.5) * (1.0 + contrast) + 0.5))
            ap[cx, cy] = int(round(cov * 255))

    out = Image.new("RGBA", (canvas, canvas), (255, 255, 255, 0))
    out.putalpha(alpha)
    p2 = out.load()
    for y in range(canvas):
        for x in range(canvas):
            p2[x, y] = (255, 255, 255, p2[x, y][3])  # pure white everywhere; Teams applies the tint
    return out


if __name__ == "__main__":
    img = build()
    img.save(TARGET, "PNG", optimize=True)
    print("wrote %s  (%dx%d)" % (TARGET, *img.size))
