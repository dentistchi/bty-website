/**
 * THE TEAMS APP-BAR ICON — now a FOUNDER-SELECTED DESIGN, not an algorithmic result. Slice TQ-4.5.
 *
 * ★ WHAT THESE GATES USED TO GUARD, AND WHY THAT ENDED.
 *
 * Four packages were published and every one failed on the Founder's real iPhone:
 *
 *   1.0.6  the original asset — 12 opaque pixels of 453, essentially all anti-aliasing
 *   1.0.7  rasterised once from the master; edge-to-core 36.75 -> 1.90      DEVICE: still muddy
 *   1.0.8  pixel-hinted, 22px optical box, weight into the neighbour band   DEVICE: still muddy
 *   1.0.9  internal negative space opened where the loops merge             DEVICE: still muddy
 *
 * Each fixed the thing the previous one was blamed on, and each still read soft beside Activity,
 * Chat and Files. That is what established the real finding: the master's woven trefoil cannot be
 * made legible at 20-24px by ANY transformation of itself, because three interlocking lobes at
 * that size merge no matter how they are rasterised, hinted, weighted or opened.
 *
 * The Founder then selected a small-size glyph BY EYE — `BTY_Teams_S1_Monoline.svg` — and that
 * file is now the design authority for this icon. The master is unchanged and still authoritative
 * for `color.png`, the web, and every large-format use.
 *
 * ★ SO THE GATES CHANGED SHAPE, DELIBERATELY.
 *
 * They no longer assert an optical box, an apparent-weight band, or an edge-to-core ceiling. Those
 * were the previous four attempts' own success criteria and all four passed them on the way to
 * failing on a phone. What is guarded now is the ASSET CONTRACT — that the shipped PNG is the
 * approved SVG, unmodified, in the shape Teams requires — plus the package identity around it.
 *
 * Edge-to-core is deliberately UNBOUNDED here: this export applies no contrast hinting, because
 * hinting would be an optical modification of a design that was approved as drawn.
 */
/**
 * THE TEAMS APP-BAR ICON, HELD TO OPTICAL QUALITY AND NOT ONLY TO THE MANIFEST. Slice TQ-4.
 *
 * ★ THE DEFECT THE PREVIOUS AUDIT COULD NOT SEE.
 *
 * TQ-3 audited this asset and passed it: 32×32, transparent background, white silhouette, mark
 * centred, inside every documented bound. All true, and all irrelevant to how it looked. On the
 * Founder's iPhone the BTY knot in the native Teams bottom bar read soft and muddy beside Activity,
 * Chat, Calendar and More — which are crisp. Manifest compliance and optical quality are different
 * properties and only the first had ever been measured.
 *
 * MEASURED on the shipped asset: of 453 visible pixels, **12** were fully opaque and 441 were
 * semi-transparent — **36.75 anti-aliased pixels per solid one**, across 127 alpha values, with an
 * 81-pixel halo below alpha 32. That is not a mark with an anti-aliased edge; it is a mark made
 * almost entirely OF edge, the signature of a raster resampled from another raster. Tinted purple
 * and scaled by the host, it could only ever look like a smudge.
 *
 * The repair rasterises the SAME canonical trefoil from `public/brand/bty-knot-mono-white.svg`
 * once, by supersampling and area-averaging, at a width chosen to reproduce the shipped icon's
 * footprint EXACTLY (bbox 26×24, margins 3/3/4/4). Same mark, same size, same place — actually
 * drawn. No new logo, no redraw, no reinterpretation.
 *
 * These gates are the acceptance criteria, expressed as arithmetic.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decodePng, alphaOf, pngSize } from "./decodePng";

const OUTLINE = join(process.cwd(), "teams/manifest/outline.png");
const img = decodePng(readFileSync(OUTLINE));
const alpha = alphaOf(img);
const { width: W, height: H, data } = img;

const visible = () => {
  const out: { x: number; y: number; a: number; rgb: [number, number, number] }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 0) out.push({ x, y, a: data[i + 3], rgb: [data[i], data[i + 1], data[i + 2]] });
    }
  }
  return out;
};

const bbox = () => {
  const v = visible();
  const xs = v.map((p) => p.x), ys = v.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** Interior low-alpha runs bounded on BOTH sides by mark — the trefoil's visible separations. */
function interiorChannels(a: number[], size: number, clear = 64, ink = 128): number[] {
  const runs: number[] = [];
  for (const axis of [0, 1]) {
    for (let i = 0; i < size; i++) {
      let seenInk = false, run = 0;
      for (let j = 0; j < size; j++) {
        const v = axis === 0 ? a[j * size + i] : a[i * size + j];
        if (v >= ink) {
          if (seenInk && run > 0) runs.push(run);
          seenInk = true; run = 0;
        } else if (seenInk && v < clear) run++;
      }
    }
  }
  return runs;
}

describe("★ 1–4 shape, transparency and colour purity", () => {
  it("1 — is exactly 32 × 32", () => {
    expect({ w: W, h: H }).toEqual({ w: 32, h: 32 });
  });

  it("2 — the background is genuinely transparent, not white-on-white", () => {
    const clear = alpha.filter((a) => a === 0).length;
    expect(clear).toBeGreaterThan(W * H * 0.4);
    // all four corners must be fully clear — a plate or rounded mask would show here
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
      expect(alpha[y * W + x], `corner ${x},${y}`).toBe(0);
    }
  });

  it("3 — every visible pixel is pure white (Teams applies its own tint)", () => {
    const wrong = visible().filter((p) => p.rgb[0] !== 255 || p.rgb[1] !== 255 || p.rgb[2] !== 255);
    expect(wrong.map((p) => `${p.x},${p.y}=${p.rgb.join(",")}`)).toEqual([]);
  });

  it("4 — no RGB colour fringe: exactly one colour among visible pixels", () => {
    const colours = new Set(visible().map((p) => p.rgb.join(",")));
    expect([...colours]).toEqual(["255,255,255"]);
  });
});

describe("★ 5–6 no shadow, no glow, no colour fringe", () => {
  it("5 — no pixel outside the glyph's own bounding box carries ink", () => {
    const b = bbox();
    expect(visible().filter((p) => p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1)).toEqual([]);
  });

  it("6 — a stroked glyph, not a plate: most of the canvas is empty and the mark is a line", () => {
    /*
      Edge-to-core is NOT bounded here, and that is the point. The 1.0.8 and 1.0.9 assets scored
      0.55 and 0.51 on it — the best numbers in the whole arc — and both failed on the device. This
      export applies no contrast hinting at all, because hinting would optically modify a design the
      Founder approved as drawn. What is worth asserting is only that the thing is a stroke.
    */
    const ink = visible().length;
    expect(ink).toBeGreaterThan(150);
    expect(ink, "an outline icon must not become a filled plate").toBeLessThan(32 * 32 * 0.45);
  });
});

describe("★ 7–8 it is the approved S1, exported and not reinterpreted", () => {
  const SVG = "scripts/teams-icon/BTY_Teams_S1_Monoline.svg";
  const svgText = readFileSync(join(process.cwd(), SVG), "utf8");

  it("1 — the approved S1 SVG exists at its frozen path", () => {
    expect(svgText.length).toBeGreaterThan(1000);
  });

  it("2 — the approved S1 SVG is FROZEN at its Founder-supplied bytes", () => {
    const sha = createHash("sha256").update(readFileSync(join(process.cwd(), SVG))).digest("hex");
    expect(sha).toBe("25e704aae326db51eb927257ae15d646b1746a53a2946541eb362453c7b1cede");
  });

  it("★ the approved file is a single white round-joined polyline on no background", () => {
    // Everything the exporter relies on being true of the source, asserted independently of it.
    expect(svgText).toContain('viewBox="0 0 32 32"');
    expect((svgText.match(/<(path|polyline|polygon|rect|circle|line|ellipse)\b/g) ?? [])).toEqual(["<polyline"]);
    expect(svgText).toContain('fill="none"');
    expect(svgText).toContain('stroke="#FFFFFF"');
    expect(svgText).toContain('stroke-linecap="round"');
    expect(svgText).toContain('stroke-linejoin="round"');
    expect(svgText).toContain('stroke-width="1.75"');
  });

  it("★ 8 — outline.png is EXPORTED from S1, never routed through the master pipeline", () => {
    const exp = readFileSync(join(process.cwd(), "scripts/teams-icon/export_s1.py"), "utf8");
    const code = exp.replace(/"""[\s\S]*?"""/g, "").replace(/^\s*#.*$/gm, "");
    expect(code).toContain("BTY_Teams_S1_Monoline.svg");
    expect(code).toContain("teams/manifest/outline.png");
    // None of the four failed transformations may appear in the export path.
    for (const forbidden of ["erode", "dilate", "closing", "envelope", "HINT_CONTRAST", "contrast", "MARK_W", "BTY_Master_plain"]) {
      expect(code, `the exporter must not ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("★ the retired master pipeline can no longer overwrite the approved asset", () => {
    /*
      `build_outline.py` produced 1.0.7, 1.0.8 and 1.0.9 and is kept for provenance — the reasoning
      inside it is the record of why this icon took five attempts. But a script that still writes to
      `teams/manifest/outline.png` is a loaded footgun beside an approved design, so its entry point
      refuses.
    */
    const old = readFileSync(join(process.cwd(), "scripts/teams-icon/build_outline.py"), "utf8");
    expect(old).toContain("RETIRED");
    expect(old).toContain("export_s1.py");
  });

  it("★ 7 — the exported geometry lies within the SVG stroke's own bounds", () => {
    /*
      The glyph is one round-capped, round-joined polyline, so its stroke IS the Minkowski sum of
      the path with a disc of radius w/2. The inked pixels must therefore fall inside the path's
      extent grown by that radius — proof the export reproduced the stroke rather than reshaping it.
    */
    const pts = (svgText.match(/points="([^"]+)"/) ?? [])[1].trim().split(/\s+/)
      .map((p) => p.split(",").map(Number) as [number, number]);
    const w = 1.75 / 2;
    const minX = Math.min(...pts.map((p) => p[0])) - w, maxX = Math.max(...pts.map((p) => p[0])) + w;
    const minY = Math.min(...pts.map((p) => p[1])) - w, maxY = Math.max(...pts.map((p) => p[1])) + w;
    const b = bbox();
    expect(b.x0).toBeGreaterThanOrEqual(Math.floor(minX));
    expect(b.x1).toBeLessThanOrEqual(Math.ceil(maxX));
    expect(b.y0).toBeGreaterThanOrEqual(Math.floor(minY));
    expect(b.y1).toBeLessThanOrEqual(Math.ceil(maxY));
  });
});

describe("★ the package around it is unchanged", () => {
  it("the colour icon and the manifest are untouched by this slice", () => {
    // color.png is 8-bit RGB with no alpha (colour type 2), which decodePng refuses on purpose.
    const colour = pngSize(readFileSync(join(process.cwd(), "teams/manifest/color.png")));
    expect({ w: colour.width, h: colour.height, type: colour.colorType }).toEqual({ w: 192, h: 192, type: 2 });
    const m = JSON.parse(readFileSync(join(process.cwd(), "teams/manifest/manifest.json"), "utf8"));
    expect(m.icons).toEqual({ color: "color.png", outline: "outline.png" });
    expect(m.id).toBe("374ec662-0deb-4e0b-8514-e38a035a349e");
    expect(m.version).toBe("1.0.10");
    expect(m.bots[0].botId).toBe("820f231b-9dbb-4c84-94c5-65bc43d35d91");
    expect(m.staticTabs[0].contentUrl).toBe("https://arena.btydaily.com/teams");
    // color.png must be byte-identical to what has shipped since 1.0.6.
    const colourSha = createHash("sha256").update(readFileSync(join(process.cwd(), "teams/manifest/color.png"))).digest("hex");
    expect(colourSha).toBe("e23c9df31ecd5cfe8a8727952da882ab29367d294b7a1e62a14d01588bdb847a");
    expect(m.composeExtensions[0].commands.map((c: { id: string }) => c.id)).toEqual(["saveToBty", "trackWithBty"]);
  });
});
