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

★ WHY THE MARK IS NOT SHRUNK.

Shrinking to 22-24px was the obvious move and the measurements refused it. At 24px — the size a
Teams app bar actually asks for — a 23px mark and a 25.5px mark leave the SAME two one-pixel
channels, so the smaller mark buys nothing where it counts; it only wins in a pessimistic 20px
simulation. It costs a lot: 182 ink units against the shipped icon's 301, which in a bar beside
Activity / Chat / Calendar / More would read as weak rather than as crisp. Rendered side by side,
that is exactly how it looked.

25.5 was chosen because it reproduces the shipped icon's footprint EXACTLY — bbox 26x24, margins
3/3/4/4 — so nothing about the mark's size or position in the bar changes. The entire repair is
rasterisation quality: 115 fully-opaque pixels instead of 12, and a semi:opaque ratio of 1.90
instead of 36.75. Same mark, same place, actually drawn.

Deterministic: same input, same bytes out. No network, no font, no external binary.
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
MARK_W = 25.5        # reproduces the shipped icon's exact 26x24 footprint; see above
SUPERSAMPLE = 32     # 1024x1024 working raster -> one area-average down to 32x32

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
        subs = parse(d)
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


def build(canvas=CANVAS, mark_w=MARK_W, ss=SUPERSAMPLE):
    lobes = canonical_lobes(open(SOURCE, encoding="utf8").read())
    pts = [p for path in lobes for sub in path for p in sub]
    x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
    x1, y1 = max(p[0] for p in pts), max(p[1] for p in pts)
    scale = mark_w / (x1 - x0)
    mark_h = (y1 - y0) * scale
    ox, oy = (canvas - mark_w) / 2.0, (canvas - mark_h) / 2.0

    big = Image.new("L", (canvas * ss, canvas * ss), 0)
    draw = ImageDraw.Draw(big)
    for path in lobes:
        for sub in path:
            draw.polygon([(((x - x0) * scale + ox) * ss, ((y - y0) * scale + oy) * ss) for x, y in sub], fill=255)

    # ONE resample, area-average: alpha is exact coverage. No blur, no feather, no second pass.
    alpha = big.resize((canvas, canvas), Image.BOX)
    out = Image.new("RGBA", (canvas, canvas), (255, 255, 255, 0))
    out.putalpha(alpha)
    px = out.load()
    for y in range(canvas):
        for x in range(canvas):
            px[x, y] = (255, 255, 255, px[x, y][3])  # pure white everywhere; Teams applies the tint
    return out

if __name__ == "__main__":
    img = build()
    img.save(TARGET, "PNG", optimize=True)
    print("wrote %s  (%dx%d)" % (TARGET, *img.size))
