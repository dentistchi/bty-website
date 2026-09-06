#!/usr/bin/env python3
"""
Export the FOUNDER-APPROVED S1 monoline glyph to `teams/manifest/outline.png`. Slice TQ-4.5.

★ THIS IS AN EXPORTER, NOT A GENERATOR.

Four packages were published and each failed on the Founder's real iPhone:

  1.0.6  the original asset — almost entirely anti-aliasing
  1.0.7  rasterised once from the master vector                     DEVICE: still muddy
  1.0.8  pixel-hinted, 22px optical box, weight corrected           DEVICE: still muddy
  1.0.9  internal negative space opened where the loops merge       DEVICE: still muddy

What that sequence established is that the master's woven trefoil cannot be made to read at
20-24px by ANY transformation of itself. The Founder then selected a small-size glyph by eye —
`BTY_Teams_S1_Monoline.svg`, vendored beside this file — and that file is now the design
authority for the Teams outline icon. The master remains authoritative for `color.png`, the web,
and every large-format use; it is not touched here.

So this file does exactly one thing: it converts that SVG to a 32x32 transparent PNG. There is no
optical box, no pixel hinting, no erosion, no dilation, no coverage remap, no re-stroking. Those
were the previous four attempts, and they are the reason this one is deliberately plain.

★ WHY DISC STAMPING IS EXACT AND NOT AN APPROXIMATION.

The glyph is one `<polyline>` with `stroke-linecap="round"` and `stroke-linejoin="round"`. A
round-capped, round-joined stroke IS the Minkowski sum of the path with a disc of radius w/2 — so
sampling the path densely and stamping that disc reproduces the SVG's own stroke geometry rather
than imitating it. Every attribute below is read FROM the file; nothing about the glyph is decided
here.

Deterministic: same input, same bytes out. No network, no font, no external binary.
"""
import os, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(HERE, "BTY_Teams_S1_Monoline.svg")
TARGET = os.path.join(ROOT, "teams/manifest/outline.png")

CANVAS = 32          # Microsoft's required outline size, and the SVG's own viewBox
SUPERSAMPLE_SS = 16  # part of the reproducible-bytes contract
STEP = 0.02          # path resampling pitch in canvas px; well below one hi-res cell (1/16)


def read_glyph(svg_text):
    """Points, stroke width and colour — all taken FROM the approved file."""
    view = re.search(r'viewBox="([\d.\s-]+)"', svg_text)
    if not view or [float(v) for v in view.group(1).split()] != [0.0, 0.0, 32.0, 32.0]:
        raise SystemExit("approved S1 must declare viewBox '0 0 32 32' — refusing to guess")
    els = re.findall(r"<(path|polyline|polygon|rect|circle|line|ellipse)\b", svg_text)
    if els != ["polyline"]:
        raise SystemExit("approved S1 must be exactly one <polyline>, found %r — refusing to guess" % els)
    if re.search(r'fill="(?!none)', svg_text):
        raise SystemExit("approved S1 must be stroke-only (fill=none) — refusing to guess")
    stroke = re.search(r'stroke="([^"]+)"', svg_text).group(1).upper()
    if stroke not in ("#FFF", "#FFFFFF", "WHITE"):
        raise SystemExit("approved S1 must be white; Teams applies its own tint — refusing to guess")
    for cap in ("stroke-linecap", "stroke-linejoin"):
        if re.search(cap + r'="([^"]+)"', svg_text).group(1) != "round":
            raise SystemExit("disc stamping is exact only for round %s — refusing to guess" % cap)
    width = float(re.search(r'stroke-width="([\d.]+)"', svg_text).group(1))
    pts = [tuple(float(v) for v in p.split(",")) for p in
           re.search(r'points="([^"]+)"', svg_text).group(1).split()]
    return np.array(pts, dtype=float), width


def resample(pts, step):
    """Densify the polyline so the stamped discs overlap continuously."""
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        d = float(np.hypot(*(b - a)))
        n = max(1, int(np.ceil(d / step)))
        for i in range(1, n + 1):
            out.append(a + (b - a) * (i / n))
    return np.array(out)


def build(canvas=CANVAS, ss=SUPERSAMPLE_SS):
    pts, width = read_glyph(open(SOURCE, encoding="utf8").read())
    dense = resample(pts, STEP)
    n = canvas * ss
    yy, xx = np.mgrid[0:n, 0:n]
    # centre of each hi-res cell, in the SVG's own coordinate space
    cx = (xx + 0.5) / ss
    cy = (yy + 0.5) / ss
    r = width / 2.0
    covered = np.zeros((n, n), dtype=bool)
    # Chunked so the point cloud never materialises as one huge array.
    for i in range(0, len(dense), 256):
        chunk = dense[i:i + 256]
        for px, py in chunk:
            np.logical_or(covered, (cx - px) ** 2 + (cy - py) ** 2 <= r * r, out=covered)

    # ONE area-average. No contrast remap: hinting would be an optical modification of an
    # approved design, and this slice is not permitted to make one.
    cov = covered.reshape(canvas, ss, canvas, ss).mean(axis=(1, 3))
    rgba = np.zeros((canvas, canvas, 4), np.uint8)
    rgba[..., 0:3] = 255                       # white only; Teams applies the selected tint
    rgba[..., 3] = np.round(cov * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


if __name__ == "__main__":
    img = build()
    img.save(TARGET, "PNG", optimize=True)
    print("wrote %s  (%dx%d) from %s" % (TARGET, img.size[0], img.size[1], os.path.basename(SOURCE)))
